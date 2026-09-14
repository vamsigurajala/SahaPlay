// deviceCredentialsStore.js
//
// Thin Postgres-backed store for WebAuthn "Remember this browser" credential
// metadata — the device_credentials table (see server.js's migration
// block). Holds ONLY what's needed to verify future WebAuthn assertions:
// accountId, credentialId, the credential's COSE public key, its signature
// counter, and bookkeeping timestamps. NEVER the E2EE secret key, never a
// PRF output, never a wrapping key — see webauthnRp.js's own header comment
// for the full security boundary this module sits behind.
//
// Every function takes `pool` (anything exposing `.query(sql, params)` —
// a node-postgres Pool/PoolClient in production) as an explicit first
// argument, rather than importing server.js's module-level `pool` itself.
// That's what lets tests/deviceCredentialsStore.test.js exercise the real
// account-scoping/uniqueness logic below against a small in-memory fake
// pool, without a live Postgres connection — the same no-database
// precedent deviceAssertion.test.js already established for this suite.

class DeviceCredentialsStoreError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'DeviceCredentialsStoreError';
    this.code = code;
  }
}

const PG_UNIQUE_VIOLATION = '23505';

/**
 * Inserts a newly-registered credential. Throws DUPLICATE_CREDENTIAL if
 * this exact credentialId is already registered — to ANY account. A
 * WebAuthn credential id is only ever meant to identify one (RP,
 * authenticator) pairing; the table's own UNIQUE constraint on
 * credential_id is the actual enforcement (belt-and-suspenders against a
 * concurrent double-insert race), this just surfaces it as a typed error
 * the route can react to (409, not a raw 500).
 */
async function insertCredential(pool, { accountId, credentialId, publicKey, counter, transports, deviceType, backedUp }) {
  if (accountId == null || !credentialId || !publicKey) {
    throw new DeviceCredentialsStoreError('INVALID_REQUEST', 'accountId, credentialId and publicKey are required');
  }
  try {
    const result = await pool.query(
      `INSERT INTO device_credentials
         (account_id, credential_id, public_key, counter, transports, device_type, backed_up, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, account_id, credential_id, counter, created_at`,
      [
        accountId,
        credentialId,
        Buffer.from(publicKey),
        counter || 0,
        transports ? JSON.stringify(transports) : null,
        deviceType || null,
        !!backedUp,
      ]
    );
    return result.rows[0];
  } catch (err) {
    if (err && err.code === PG_UNIQUE_VIOLATION) {
      throw new DeviceCredentialsStoreError('DUPLICATE_CREDENTIAL', 'This credential is already registered.');
    }
    throw err;
  }
}

/** Looks up one credential row by its WebAuthn credential id (globally unique). Returns null if none. */
async function getCredentialById(pool, credentialId) {
  if (!credentialId) return null;
  const result = await pool.query(
    `SELECT id, account_id, credential_id, public_key, counter, transports, device_type, backed_up, created_at, last_used_at
       FROM device_credentials WHERE credential_id = $1`,
    [credentialId]
  );
  const row = result.rows[0];
  return row ? rowToCredential(row) : null;
}

/** All credentials registered for one account — used to build allowCredentials for auth-options, and excludeCredentials for register-options. */
async function listCredentialsForAccount(pool, accountId) {
  if (accountId == null) return [];
  const result = await pool.query(
    `SELECT id, account_id, credential_id, public_key, counter, transports, device_type, backed_up, created_at, last_used_at
       FROM device_credentials WHERE account_id = $1 ORDER BY created_at DESC`,
    [accountId]
  );
  return result.rows.map(rowToCredential);
}

/** Bumps the stored signature counter + last_used_at after a successful authentication (anti-clone replay defense). */
async function updateCounterAndLastUsed(pool, credentialId, newCounter) {
  await pool.query(
    `UPDATE device_credentials SET counter = $1, last_used_at = NOW() WHERE credential_id = $2`,
    [newCounter, credentialId]
  );
}

/**
 * Deletes a credential, scoped to the CALLER's own account — the WHERE
 * clause IS the authorization boundary: passing another account's
 * credentialId here deletes zero rows rather than requiring a separate,
 * easier-to-get-wrong "look it up, check ownership, then delete" sequence.
 * Returns true iff a row was actually deleted, so the caller can tell
 * "forgot a real enrollment" from "nothing to forget / wasn't yours."
 */
async function deleteCredential(pool, { accountId, credentialId }) {
  if (accountId == null || !credentialId) return false;
  const result = await pool.query(
    `DELETE FROM device_credentials WHERE account_id = $1 AND credential_id = $2`,
    [accountId, credentialId]
  );
  return result.rowCount > 0;
}

function rowToCredential(row) {
  return {
    id: row.credential_id,
    accountId: typeof row.account_id === 'string' ? Number(row.account_id) : row.account_id,
    credentialId: row.credential_id,
    publicKey: row.public_key instanceof Uint8Array ? row.public_key : new Uint8Array(row.public_key || []),
    counter: typeof row.counter === 'string' ? Number(row.counter) : row.counter,
    transports: row.transports ? (typeof row.transports === 'string' ? JSON.parse(row.transports) : row.transports) : undefined,
    deviceType: row.device_type || null,
    backedUp: !!row.backed_up,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at || null,
  };
}

module.exports = {
  DeviceCredentialsStoreError,
  insertCredential,
  getCredentialById,
  listCredentialsForAccount,
  updateCounterAndLastUsed,
  deleteCredential,
};
