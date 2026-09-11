// Read-only diagnostic for the SahaPlay encryption audit's Phase 2.
//
// Determines how many accounts (if any) are still on the legacy
// server-side-wrapped private-key formats ('gkv1:' for Google, 'akv1:' for
// Apple — see decryptGoogleWrappedKey/decryptAppleWrappedKey in server.js).
// Those accounts are unwrapped by the server unconditionally (using only
// CHAT_ENCRYPTION_SECRET + the OAuth subject id, no user secret involved) —
// they migrate to a client-chosen-passphrase format automatically the next
// time that user logs in (needsPassphraseMigration, handled by
// OAuthEncryptionModal / Login.jsx's completeOAuthLogin). This script does
// NOT change anything — it only counts rows, so it's safe to run against
// production at any time.
//
// Usage: node backend/dev-tools/legacy-oauth-key-audit.js
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const totals = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE "encryptedPrivateKey" LIKE 'gkv1:%') AS legacy_google,
        COUNT(*) FILTER (WHERE "encryptedPrivateKey" LIKE 'akv1:%') AS legacy_apple,
        COUNT(*) FILTER (WHERE "encryptedPrivateKey" IS NOT NULL
                           AND "encryptedPrivateKey" NOT LIKE 'gkv1:%'
                           AND "encryptedPrivateKey" NOT LIKE 'akv1:%') AS migrated_or_password,
        COUNT(*) FILTER (WHERE "publicKey" IS NOT NULL AND "encryptedPrivateKey" IS NULL) AS key_but_no_wrapped_private_key,
        COUNT(*) AS total_users
      FROM users
    `);
    const row = totals.rows[0];
    console.log('Legacy OAuth private-key wrap audit');
    console.log('------------------------------------');
    console.log(`Still on legacy 'gkv1:' (server-decryptable Google wrap): ${row.legacy_google}`);
    console.log(`Still on legacy 'akv1:' (server-decryptable Apple wrap):  ${row.legacy_apple}`);
    console.log(`Already migrated / password-based wrap:                  ${row.migrated_or_password}`);
    console.log(`Has a public key but no wrapped private key on file:     ${row.key_but_no_wrapped_private_key}`);
    console.log(`Total user rows:                                         ${row.total_users}`);
    console.log('');
    if (Number(row.legacy_google) > 0 || Number(row.legacy_apple) > 0) {
      console.log('ACTION: these accounts are decryptable by the server today. They self-migrate');
      console.log('the next time they log in (existing needsPassphraseMigration flow) — no code');
      console.log('change needed to migrate them, but they remain server-decryptable until they');
      console.log('actually do log in again. Consider whether to proactively prompt/notify them.');
    } else {
      console.log('No accounts remain on the legacy server-decryptable OAuth key wrap.');
    }
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
