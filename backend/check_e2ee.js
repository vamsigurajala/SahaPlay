const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  console.log('\n=== ALL recent private messages (last 20) ===');
  const r1 = await pool.query(`
    SELECT id, "senderName", "targetName",
           LEFT(message, 35) as msg,
           nonce IS NOT NULL as has_nonce,
           "ephemeralPublicKey" IS NOT NULL as has_epk,
           "senderMessage" IS NOT NULL as has_sm,
           "mediaUrl" IS NOT NULL as has_media
    FROM messages WHERE type = 'private'
    ORDER BY timestamp DESC LIMIT 20
  `);
  r1.rows.forEach(r => console.log(JSON.stringify(r)));
  pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
