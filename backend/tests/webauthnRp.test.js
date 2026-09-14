const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

// Fixed test RP identity — set before requiring webauthnRp.js's functions
// are ever called (getRpConfig() reads process.env fresh on every call, so
// this is safe to set once here rather than per-test).
process.env.WEBAUTHN_RP_ID = 'localhost';
process.env.WEBAUTHN_ORIGIN = 'http://localhost';

const { default: WebAuthnEmulator, AuthenticatorEmulator } = require('nid-webauthn-emulator');
const rp = require('../lib/webauthnRp');

const ORIGIN = 'http://localhost';

// A fresh authenticator emulator per test — "hmac-secret-mc" enables the
// CTAP2 extension that backs WebAuthn's PRF extension at BOTH creation and
// authentication (see AuthenticatorEmulator's own README), matching what a
// real PRF-capable platform authenticator (Chrome147+/Windows Hello 25H2/
// Touch ID via iCloud Keychain) does. webauthnRp.js itself never touches
// PRF at all (see its own header comment on why) — this is only relevant
// to browserDeviceUnlock.test.js on the frontend; it's enabled here too so
// registration/authentication options round-trip through a fully
// spec-realistic authenticator, not a stripped-down one.
function freshEmulator() {
  return new WebAuthnEmulator(new AuthenticatorEmulator({ hmacSecret: 'hmac-secret-mc' }));
}

async function registerAccount(emulator, accountId, username = `user${accountId}`) {
  const options = await rp.buildRegistrationOptions({ accountId, username });
  const response = emulator.createJSON(ORIGIN, options);
  const info = await rp.verifyRegistration({ accountId, response });
  return {
    id: info.credential.id,
    publicKey: info.credential.publicKey,
    counter: info.credential.counter,
    accountId,
  };
}

describe('webauthnRp.js — registration', () => {
  beforeEach(() => rp._resetChallengesForTests());

  test('authenticated registration: a real create() response verifies and returns usable credential info', async () => {
    const emulator = freshEmulator();
    const cred = await registerAccount(emulator, 1);
    assert.ok(cred.id, 'credential id must be present');
    assert.ok(cred.publicKey instanceof Uint8Array && cred.publicKey.length > 0, 'public key bytes must be present');
    assert.strictEqual(typeof cred.counter, 'number');
  });

  test('registration account binding: a registration challenge issued for account A cannot be consumed under account B', async () => {
    const emulator = freshEmulator();
    const options = await rp.buildRegistrationOptions({ accountId: 1, username: 'alice' });
    const response = emulator.createJSON(ORIGIN, options);
    // The response echoes back account 1's challenge, but verifying it
    // under a DIFFERENT accountId must fail — consumeChallenge is keyed by
    // (accountId, type), so account 2 never had a challenge stored for it
    // at all.
    await assert.rejects(
      () => rp.verifyRegistration({ accountId: 2, response }),
      (err) => err.code === 'CHALLENGE_EXPIRED_OR_MISSING'
    );
  });

  test('invalid registration verification: a tampered clientDataJSON is rejected', async () => {
    const emulator = freshEmulator();
    const options = await rp.buildRegistrationOptions({ accountId: 3, username: 'carol' });
    const response = emulator.createJSON(ORIGIN, options);
    // clientDataJSON's own bytes are what verifyRegistrationResponse hashes
    // and cross-checks (challenge/origin/type, and — via the authenticator
    // data signature base — its own hash) — corrupting it is guaranteed to
    // fail verification regardless of attestation format (this registration
    // uses 'none', which has no attestation signature of its own to target).
    const tampered = { ...response, response: { ...response.response, clientDataJSON: mutateB64url(response.response.clientDataJSON) } };
    await assert.rejects(
      () => rp.verifyRegistration({ accountId: 3, response: tampered }),
      (err) => err.code === 'VERIFICATION_FAILED'
    );
  });

  test('challenge expiration/replay: the SAME registration response cannot be verified twice', async () => {
    const emulator = freshEmulator();
    const options = await rp.buildRegistrationOptions({ accountId: 4, username: 'dave' });
    const response = emulator.createJSON(ORIGIN, options);
    await rp.verifyRegistration({ accountId: 4, response }); // first use succeeds
    await assert.rejects(
      () => rp.verifyRegistration({ accountId: 4, response }), // replay
      (err) => err.code === 'CHALLENGE_EXPIRED_OR_MISSING'
    );
  });

  test('challenge expiration: a challenge past its TTL is rejected even with an otherwise-valid response', async () => {
    const emulator = freshEmulator();
    const options = await rp.buildRegistrationOptions({ accountId: 5, username: 'erin' });
    const response = emulator.createJSON(ORIGIN, options);
    // Fast-forward past the 5-minute TTL by overriding Date.now — exercises
    // the real expiry branch inside consumeChallenge (entry.expiresAt <
    // Date.now()) rather than the separate "never issued/already consumed"
    // branch the replay test above covers.
    const realNow = Date.now;
    Date.now = () => realNow() + 6 * 60_000;
    try {
      await assert.rejects(
        () => rp.verifyRegistration({ accountId: 5, response }),
        (err) => err.code === 'CHALLENGE_EXPIRED_OR_MISSING'
      );
    } finally {
      Date.now = realNow;
    }
  });
});

describe('webauthnRp.js — authentication', () => {
  beforeEach(() => rp._resetChallengesForTests());

  test('authenticated assertion: a real get() response verifies against the registered credential', async () => {
    const emulator = freshEmulator();
    const cred = await registerAccount(emulator, 10);
    const options = await rp.buildAuthenticationOptions({ accountId: 10, allowCredentialIds: [cred.id] });
    const response = emulator.getJSON(ORIGIN, options);
    const info = await rp.verifyAuthentication({ accountId: 10, response, credential: cred });
    assert.strictEqual(typeof info.newCounter, 'number');
    assert.ok(info.newCounter >= cred.counter);
  });

  test('invalid assertion: a tampered signature is rejected', async () => {
    const emulator = freshEmulator();
    const cred = await registerAccount(emulator, 11);
    const options = await rp.buildAuthenticationOptions({ accountId: 11, allowCredentialIds: [cred.id] });
    const response = emulator.getJSON(ORIGIN, options);
    const tampered = { ...response, response: { ...response.response, signature: mutateB64url(response.response.signature) } };
    await assert.rejects(
      () => rp.verifyAuthentication({ accountId: 11, response: tampered, credential: cred }),
      (err) => err.code === 'VERIFICATION_FAILED'
    );
  });

  test('credential/account mismatch: a credential row belonging to a DIFFERENT account is rejected before any crypto verification', async () => {
    const emulator = freshEmulator();
    const cred = await registerAccount(emulator, 20); // really registered to account 20
    const options = await rp.buildAuthenticationOptions({ accountId: 21, allowCredentialIds: [cred.id] });
    const response = emulator.getJSON(ORIGIN, options);
    // Caller (server.js route) is trying to authenticate as account 21, but
    // hands in the credential row for account 20 — this is exactly the
    // "assertion for account A unlocking account B" boundary.
    await assert.rejects(
      () => rp.verifyAuthentication({ accountId: 21, response, credential: cred }),
      (err) => err.code === 'ACCOUNT_MISMATCH'
    );
  });

  test('authorization boundary: an authentication challenge issued for account A cannot be consumed under account B, even with a valid credential+signature for A', async () => {
    const emulator = freshEmulator();
    const cred = await registerAccount(emulator, 30);
    const options = await rp.buildAuthenticationOptions({ accountId: 30, allowCredentialIds: [cred.id] });
    const response = emulator.getJSON(ORIGIN, options);
    await assert.rejects(
      () => rp.verifyAuthentication({ accountId: 31, response, credential: { ...cred, accountId: 31 } }),
      // credential.accountId is spoofed to 31 here to isolate the CHALLENGE
      // check from the account-mismatch check exercised in the test above —
      // this proves the challenge itself is also account-scoped, not just
      // the credential row.
      (err) => err.code === 'CHALLENGE_EXPIRED_OR_MISSING'
    );
  });

  test('replay: the SAME authentication response cannot be verified twice', async () => {
    const emulator = freshEmulator();
    const cred = await registerAccount(emulator, 40);
    const options = await rp.buildAuthenticationOptions({ accountId: 40, allowCredentialIds: [cred.id] });
    const response = emulator.getJSON(ORIGIN, options);
    await rp.verifyAuthentication({ accountId: 40, response, credential: cred });
    await assert.rejects(
      () => rp.verifyAuthentication({ accountId: 40, response, credential: cred }),
      (err) => err.code === 'CHALLENGE_EXPIRED_OR_MISSING'
    );
  });

  test('no credentials registered: buildAuthenticationOptions refuses to issue options with an empty allow-list', async () => {
    await assert.rejects(
      () => rp.buildAuthenticationOptions({ accountId: 50, allowCredentialIds: [] }),
      (err) => err.code === 'NO_CREDENTIALS'
    );
  });
});

// Flips one base64url character in the MIDDLE of a base64url string —
// simulates a bit-flipped/forged field without needing to understand its
// internal CBOR/DER structure. Deliberately not the last character: the
// tail of an unpadded base64url string can have unused/don't-care bits, so
// some replacements there silently decode to the exact same bytes; a
// middle character is always byte-aligned to real content.
function mutateB64url(b64url) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const mid = Math.floor(b64url.length / 2);
  const current = b64url[mid];
  const idx = chars.indexOf(current);
  const replacement = chars[(idx === -1 ? 0 : idx + 1) % chars.length];
  return b64url.slice(0, mid) + replacement + b64url.slice(mid + 1);
}
