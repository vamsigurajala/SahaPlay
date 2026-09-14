// webauthnRoutes.test.js
//
// server.js's five /api/auth/webauthn/* routes are thin composition of
// webauthnRp.js (WebAuthn crypto/challenge verification) +
// deviceCredentialsStore.js (Postgres row storage) — both already have
// their own focused unit tests. This file exercises that COMPOSITION,
// reproducing each route handler's exact logic (including its authorization
// checks) against a fake pool + a real WebAuthn emulator, the same way
// server.js itself would call these two modules — without booting the
// full Express app / a live Postgres connection (server.js is a large
// monolith that opens a real DB pool at import time, so — same as every
// other file in this test directory — the logic under test is exercised
// directly rather than via an HTTP round trip).

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.WEBAUTHN_RP_ID = 'localhost';
process.env.WEBAUTHN_ORIGIN = 'http://localhost';

const { default: WebAuthnEmulator, AuthenticatorEmulator } = require('nid-webauthn-emulator');
const rp = require('../lib/webauthnRp');
const {
  DeviceCredentialsStoreError,
  insertCredential,
  getCredentialById,
  listCredentialsForAccount,
  updateCounterAndLastUsed,
  deleteCredential,
} = require('../lib/deviceCredentialsStore');

const ORIGIN = 'http://localhost';

function makeFakePool() {
  const rows = [];
  let nextId = 1;
  return {
    async query(sql, params) {
      const s = sql.trim().toUpperCase();
      if (s.startsWith('INSERT INTO DEVICE_CREDENTIALS')) {
        const [account_id, credential_id, public_key, counter, transports, device_type, backed_up] = params;
        if (rows.some(r => r.credential_id === credential_id)) {
          const err = new Error('duplicate key'); err.code = '23505'; throw err;
        }
        const row = { id: nextId++, account_id, credential_id, public_key, counter, transports, device_type, backed_up, created_at: new Date(), last_used_at: null };
        rows.push(row);
        return { rows: [row], rowCount: 1 };
      }
      if (s.startsWith('SELECT') && s.includes('WHERE CREDENTIAL_ID = $1')) {
        const row = rows.find(r => r.credential_id === params[0]);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      if (s.startsWith('SELECT') && s.includes('WHERE ACCOUNT_ID = $1')) {
        const matched = rows.filter(r => r.account_id === params[0]);
        return { rows: matched, rowCount: matched.length };
      }
      if (s.startsWith('UPDATE DEVICE_CREDENTIALS')) {
        const row = rows.find(r => r.credential_id === params[1]);
        if (row) { row.counter = params[0]; row.last_used_at = new Date(); }
        return { rows: [], rowCount: row ? 1 : 0 };
      }
      if (s.startsWith('DELETE FROM DEVICE_CREDENTIALS')) {
        const idx = rows.findIndex(r => r.account_id === params[0] && r.credential_id === params[1]);
        if (idx === -1) return { rows: [], rowCount: 0 };
        rows.splice(idx, 1);
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`unrecognized query: ${sql}`);
    },
  };
}

// ─── Route re-implementations, mirroring server.js's handlers exactly ────
// `user` stands in for req.user (the authenticateToken-verified session) —
// accountId is ALWAYS user.id, never something the "request body" supplies,
// reproducing the exact structural guarantee server.js's real routes give.

async function routeRegisterOptions(pool, user) {
  const existing = await listCredentialsForAccount(pool, user.id);
  return rp.buildRegistrationOptions({ accountId: user.id, username: user.username, excludeCredentialIds: existing.map(c => c.credentialId) });
}

async function routeRegisterVerify(pool, user, response) {
  const info = await rp.verifyRegistration({ accountId: user.id, response });
  await insertCredential(pool, {
    accountId: user.id,
    credentialId: info.credential.id,
    publicKey: info.credential.publicKey,
    counter: info.credential.counter,
    transports: response.response?.transports,
    deviceType: info.credentialDeviceType,
    backedUp: info.credentialBackedUp,
  });
  return { verified: true, credentialId: info.credential.id };
}

async function routeAuthOptions(pool, user) {
  const creds = await listCredentialsForAccount(pool, user.id);
  if (creds.length === 0) { const e = new Error('no creds'); e.status = 404; e.code = 'NO_CREDENTIALS'; throw e; }
  return rp.buildAuthenticationOptions({ accountId: user.id, allowCredentialIds: creds.map(c => c.credentialId) });
}

async function routeAuthVerify(pool, user, response) {
  const credential = await getCredentialById(pool, response.id);
  if (!credential || credential.accountId !== user.id) {
    const e = new Error('account mismatch'); e.status = 403; e.code = 'ACCOUNT_MISMATCH'; throw e;
  }
  const info = await rp.verifyAuthentication({ accountId: user.id, response, credential });
  await updateCounterAndLastUsed(pool, credential.credentialId, info.newCounter);
  return { verified: true };
}

async function routeForget(pool, user, credentialId) {
  return { deleted: await deleteCredential(pool, { accountId: user.id, credentialId }) };
}

function freshEmulator() {
  return new WebAuthnEmulator(new AuthenticatorEmulator({ hmacSecret: 'hmac-secret-mc' }));
}

describe('webauthn routes — composed authorization behavior', () => {
  let pool;
  beforeEach(() => { pool = makeFakePool(); rp._resetChallengesForTests(); });

  test('authenticated registration: register-options -> real create() -> register-verify persists a row bound to the caller\'s own account', async () => {
    const alice = { id: 1, username: 'alice' };
    const emulator = freshEmulator();
    const options = await routeRegisterOptions(pool, alice);
    const response = emulator.createJSON(ORIGIN, options);
    const result = await routeRegisterVerify(pool, alice, response);
    assert.strictEqual(result.verified, true);
    const stored = await listCredentialsForAccount(pool, 1);
    assert.strictEqual(stored.length, 1);
    assert.strictEqual(stored[0].accountId, 1);
  });

  test('registration account binding: register-options for alice, then register-verify attempted as bob, is rejected (bob has no matching challenge)', async () => {
    const alice = { id: 1, username: 'alice' };
    const bob = { id: 2, username: 'bob' };
    const emulator = freshEmulator();
    const options = await routeRegisterOptions(pool, alice);
    const response = emulator.createJSON(ORIGIN, options);
    await assert.rejects(() => routeRegisterVerify(pool, bob, response), (err) => err.code === 'CHALLENGE_EXPIRED_OR_MISSING');
    assert.strictEqual((await listCredentialsForAccount(pool, 2)).length, 0);
  });

  test('credential uniqueness enforced through the route: registering the same physical credential twice (allowOverwrite has no route) fails with a 409-shaped error', async () => {
    const alice = { id: 1, username: 'alice' };
    const emulator = freshEmulator();
    // Simulate the *same* authenticator response being replayed at the
    // storage layer directly (bypassing the challenge check, which would
    // already have caught a literal replay) by inserting the row twice.
    const options = await routeRegisterOptions(pool, alice);
    const response = emulator.createJSON(ORIGIN, options);
    const info = await rp.verifyRegistration({ accountId: 1, response });
    await insertCredential(pool, { accountId: 1, credentialId: info.credential.id, publicKey: info.credential.publicKey, counter: 0 });
    await assert.rejects(
      () => insertCredential(pool, { accountId: 1, credentialId: info.credential.id, publicKey: info.credential.publicKey, counter: 0 }),
      (err) => err instanceof DeviceCredentialsStoreError && err.code === 'DUPLICATE_CREDENTIAL'
    );
  });

  test('authenticated assertion: a full register -> auth-options -> get() -> auth-verify cycle succeeds and bumps the counter', async () => {
    const alice = { id: 1, username: 'alice' };
    const emulator = freshEmulator();
    const regOptions = await routeRegisterOptions(pool, alice);
    await routeRegisterVerify(pool, alice, emulator.createJSON(ORIGIN, regOptions));

    const authOptions = await routeAuthOptions(pool, alice);
    const authResponse = emulator.getJSON(ORIGIN, authOptions);
    const result = await routeAuthVerify(pool, alice, authResponse);
    assert.strictEqual(result.verified, true);
    const [row] = await listCredentialsForAccount(pool, 1);
    assert.ok(row.counter >= 1, 'sign counter must have advanced');
    assert.ok(row.lastUsedAt, 'lastUsedAt must be recorded');
  });

  test('invalid assertion: auth-verify rejects a response whose credential id was never registered', async () => {
    const alice = { id: 1, username: 'alice' };
    await assert.rejects(
      () => routeAuthVerify(pool, alice, { id: 'never-registered', response: {} }),
      (err) => err.code === 'ACCOUNT_MISMATCH'
    );
  });

  test('credential/account mismatch: alice\'s real, validly-signed assertion cannot verify as bob\'s account', async () => {
    const alice = { id: 1, username: 'alice' };
    const bob = { id: 2, username: 'bob' };
    const emulator = freshEmulator();
    await routeRegisterVerify(pool, alice, emulator.createJSON(ORIGIN, await routeRegisterOptions(pool, alice)));

    // bob has never registered anything, so auth-options for bob correctly
    // has nothing to offer — but simulate the deeper defense-in-depth case:
    // bob's client somehow sends alice's credential id directly to
        // auth-verify (e.g. a compromised page replaying an intercepted
    // response). getCredentialById finds alice's row; the accountId check
    // must still reject it for bob.
    const aliceAuthOptions = await routeAuthOptions(pool, alice);
    const aliceAssertion = emulator.getJSON(ORIGIN, aliceAuthOptions);
    await assert.rejects(() => routeAuthVerify(pool, bob, aliceAssertion), (err) => err.code === 'ACCOUNT_MISMATCH');
  });

  test('authorization boundary: bob has zero registered credentials — auth-options refuses rather than issuing an empty/meaningless challenge', async () => {
    const bob = { id: 2, username: 'bob' };
    await assert.rejects(() => routeAuthOptions(pool, bob), (err) => err.code === 'NO_CREDENTIALS');
  });

  test('authorization boundary: forget only ever deletes the caller\'s own credential, never another account\'s', async () => {
    const alice = { id: 1, username: 'alice' };
    const bob = { id: 2, username: 'bob' };
    const emulator = freshEmulator();
    await routeRegisterVerify(pool, alice, emulator.createJSON(ORIGIN, await routeRegisterOptions(pool, alice)));
    const [aliceCred] = await listCredentialsForAccount(pool, 1);

    const bobResult = await routeForget(pool, bob, aliceCred.credentialId);
    assert.strictEqual(bobResult.deleted, false);
    assert.strictEqual((await listCredentialsForAccount(pool, 1)).length, 1, 'alice\'s credential must still exist');

    const aliceResult = await routeForget(pool, alice, aliceCred.credentialId);
    assert.strictEqual(aliceResult.deleted, true);
    assert.strictEqual((await listCredentialsForAccount(pool, 1)).length, 0);
  });

  test('two different accounts can independently register and authenticate without interfering with each other', async () => {
    const alice = { id: 1, username: 'alice' };
    const bob = { id: 2, username: 'bob' };
    const emulatorA = freshEmulator();
    const emulatorB = freshEmulator();
    await routeRegisterVerify(pool, alice, emulatorA.createJSON(ORIGIN, await routeRegisterOptions(pool, alice)));
    await routeRegisterVerify(pool, bob, emulatorB.createJSON(ORIGIN, await routeRegisterOptions(pool, bob)));

    const aliceAuth = await routeAuthVerify(pool, alice, emulatorA.getJSON(ORIGIN, await routeAuthOptions(pool, alice)));
    const bobAuth = await routeAuthVerify(pool, bob, emulatorB.getJSON(ORIGIN, await routeAuthOptions(pool, bob)));
    assert.strictEqual(aliceAuth.verified, true);
    assert.strictEqual(bobAuth.verified, true);
  });
});
