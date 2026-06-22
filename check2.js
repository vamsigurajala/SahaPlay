const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  console.log('\n=== Recent private messages ===');
  const r = await pool.query(`
    SELECT id, "senderName", "targetName", "nonce", "ephemeralPublicKey", "senderMessage", "mediaUrl"
    FROM messages WHERE type = 'private'
    ORDER BY timestamp DESC LIMIT 6
  `);
  r.rows.forEach(row => console.log(JSON.stringify(row)));
  pool.end();
}
run();
