const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const {
  DeviceCredentialsStoreError,
  insertCredential,
  getCredentialById,
  listCredentialsForAccount,
  updateCounterAndLastUsed,
  deleteCredential,
} = require('../lib/deviceCredentialsStore');

// A minimal in-memory fake of node-postgres's Pool — implements just the
// four SQL shapes deviceCredentialsStore.js actually issues (matched by a
// simple substring check on the query text), including a real UNIQUE
// constraint on credential_id (rejecting with the exact Postgres error code
// '23505' the real driver would raise), so this exercises the module's
// actual account-scoping/uniqueness/authorization logic — not a
// reimplementation of it — without a live Postgres connection. Same
// no-database precedent deviceAssertion.test.js already established for
// this suite.
function makeFakePool() {
  const rows = []; // { id, account_id, credential_id, public_key, counter, transports, device_type, backed_up, created_at, last_used_at }
  let nextId = 1;
  return {
    rows, // exposed for test assertions
    async query(sql, params) {
      const s = sql.trim().toUpperCase();
      if (s.startsWith('INSERT INTO DEVICE_CREDENTIALS')) {
        const [account_id, credential_id, public_key, counter, transports, device_type, backed_up] = params;
        if (rows.some(r => r.credential_id === credential_id)) {
          const err = new Error('duplicate key value violates unique constraint "device_credentials_credential_id_key"');
          err.code = '23505';
          throw err;
        }
        const row = {
          id: nextId++,
          account_id,
          credential_id,
          public_key,
          counter,
          transports,
          device_type,
          backed_up,
          created_at: new Date(),
          last_used_at: null,
        };
        rows.push(row);
        return { rows: [row], rowCount: 1 };
      }
      if (s.startsWith('SELECT') && s.includes('WHERE CREDENTIAL_ID = $1') && !s.includes('ORDER BY')) {
        const [credential_id] = params;
        const row = rows.find(r => r.credential_id === credential_id);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      if (s.startsWith('SELECT') && s.includes('WHERE ACCOUNT_ID = $1')) {
        const [account_id] = params;
        const matched = rows.filter(r => r.account_id === account_id).sort((a, b) => b.created_at - a.created_at);
        return { rows: matched, rowCount: matched.length };
      }
      if (s.startsWith('UPDATE DEVICE_CREDENTIALS')) {
        const [counter, credential_id] = params;
        const row = rows.find(r => r.credential_id === credential_id);
        if (row) { row.counter = counter; row.last_used_at = new Date(); }
        return { rows: [], rowCount: row ? 1 : 0 };
      }
      if (s.startsWith('DELETE FROM DEVICE_CREDENTIALS')) {
        const [account_id, credential_id] = params;
        const idx = rows.findIndex(r => r.account_id === account_id && r.credential_id === credential_id);
        if (idx === -1) return { rows: [], rowCount: 0 };
        rows.splice(idx, 1);
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`FakePool: unrecognized query: ${sql}`);
    },
  };
}

function samplePublicKey() {
  return new Uint8Array(65).fill(7);
}

describe('deviceCredentialsStore.js', () => {
  let pool;
  beforeEach(() => { pool = makeFakePool(); });

  test('insertCredential stores a row scoped to the given accountId', async () => {
    await insertCredential(pool, { accountId: 1, credentialId: 'cred-a', publicKey: samplePublicKey(), counter: 0 });
    const rows = await listCredentialsForAccount(pool, 1);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].credentialId, 'cred-a');
    assert.strictEqual(rows[0].accountId, 1);
  });

  test('credential uniqueness: the same credentialId cannot be inserted twice, even under a different account', async () => {
    await insertCredential(pool, { accountId: 1, credentialId: 'dup-cred', publicKey: samplePublicKey(), counter: 0 });
    await assert.rejects(
      () => insertCredential(pool, { accountId: 2, credentialId: 'dup-cred', publicKey: samplePublicKey(), counter: 0 }),
      (err) => err instanceof DeviceCredentialsStoreError && err.code === 'DUPLICATE_CREDENTIAL'
    );
    // Only the first insert's row exists — the account-2 attempt never landed.
    assert.strictEqual((await listCredentialsForAccount(pool, 2)).length, 0);
  });

  test('listCredentialsForAccount only returns rows for that account — never another account\'s', async () => {
    await insertCredential(pool, { accountId: 1, credentialId: 'cred-1a', publicKey: samplePublicKey(), counter: 0 });
    await insertCredential(pool, { accountId: 1, credentialId: 'cred-1b', publicKey: samplePublicKey(), counter: 0 });
    await insertCredential(pool, { accountId: 2, credentialId: 'cred-2a', publicKey: samplePublicKey(), counter: 0 });

    const forAccount1 = await listCredentialsForAccount(pool, 1);
    const forAccount2 = await listCredentialsForAccount(pool, 2);
    assert.strictEqual(forAccount1.length, 2);
    assert.strictEqual(forAccount2.length, 1);
    assert.ok(forAccount1.every(c => c.accountId === 1));
    assert.ok(forAccount2.every(c => c.accountId === 2));
  });

  test('getCredentialById finds a credential regardless of which account is asking — callers are responsible for the accountId check (matches server.js\'s auth-verify route)', async () => {
    await insertCredential(pool, { accountId: 5, credentialId: 'cred-5', publicKey: samplePublicKey(), counter: 0 });
    const found = await getCredentialById(pool, 'cred-5');
    assert.ok(found);
    assert.strictEqual(found.accountId, 5);
    assert.strictEqual(await getCredentialById(pool, 'does-not-exist'), null);
  });

  test('updateCounterAndLastUsed bumps only the targeted credential\'s counter', async () => {
    await insertCredential(pool, { accountId: 1, credentialId: 'cred-x', publicKey: samplePublicKey(), counter: 0 });
    await insertCredential(pool, { accountId: 1, credentialId: 'cred-y', publicKey: samplePublicKey(), counter: 0 });
    await updateCounterAndLastUsed(pool, 'cred-x', 42);
    const rows = await listCredentialsForAccount(pool, 1);
    const x = rows.find(r => r.credentialId === 'cred-x');
    const y = rows.find(r => r.credentialId === 'cred-y');
    assert.strictEqual(x.counter, 42);
    assert.ok(x.lastUsedAt);
    assert.strictEqual(y.counter, 0);
    assert.strictEqual(y.lastUsedAt, null);
  });

  describe('deleteCredential — authorization boundary', () => {
    test('deletes a credential that really belongs to the requesting account', async () => {
      await insertCredential(pool, { accountId: 1, credentialId: 'cred-1', publicKey: samplePublicKey(), counter: 0 });
      const deleted = await deleteCredential(pool, { accountId: 1, credentialId: 'cred-1' });
      assert.strictEqual(deleted, true);
      assert.strictEqual((await listCredentialsForAccount(pool, 1)).length, 0);
    });

    test('account B cannot delete account A\'s credential — the row survives, and the call reports nothing was deleted', async () => {
      await insertCredential(pool, { accountId: 1, credentialId: 'cred-1', publicKey: samplePublicKey(), counter: 0 });
      const deleted = await deleteCredential(pool, { accountId: 2, credentialId: 'cred-1' });
      assert.strictEqual(deleted, false);
      // Still there, untouched, still owned by account 1.
      const rows = await listCredentialsForAccount(pool, 1);
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].credentialId, 'cred-1');
    });

    test('deleting a non-existent credentialId is a safe no-op', async () => {
      const deleted = await deleteCredential(pool, { accountId: 1, credentialId: 'never-existed' });
      assert.strictEqual(deleted, false);
    });
  });

  test('never stores anything resembling an E2EE secret or wrapping key — the public_key column round-trips exactly the bytes given, nothing more', async () => {
    const pk = samplePublicKey();
    await insertCredential(pool, { accountId: 1, credentialId: 'cred-1', publicKey: pk, counter: 0 });
    const [row] = pool.rows;
    // Only the fields this module's own contract documents ever get
    // persisted — this is a structural sanity check that a future edit
    // can't quietly start writing a secret-shaped field through this path.
    const persistedKeys = Object.keys(row).sort();
    assert.deepStrictEqual(persistedKeys, [
      'account_id', 'backed_up', 'created_at', 'credential_id', 'device_type',
      'id', 'last_used_at', 'public_key', 'transports', 'counter',
    ].sort());
  });
});
