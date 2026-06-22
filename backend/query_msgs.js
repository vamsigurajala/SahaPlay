require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT id, type, \"senderName\", \"targetName\", message, \"senderMessage\", nonce, \"ephemeralPublicKey\" FROM messages ORDER BY timestamp DESC LIMIT 5")
  .then(res => { console.log(res.rows); pool.end(); })
  .catch(e => console.error(e));
