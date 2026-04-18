const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`
  SELECT id, "senderName", "targetName", type,
         LEFT(message, 40) as msg_preview,
         LEFT("senderMessage", 40) as sender_msg_preview,
         nonce IS NOT NULL as has_nonce,
         "ephemeralPublicKey" IS NOT NULL as has_epk,
         "senderMessage" IS NOT NULL as has_sender_msg,
         "mediaUrl" IS NOT NULL as has_media,
         timestamp
  FROM messages
  WHERE type = 'private'
  ORDER BY timestamp DESC
  LIMIT 8
`).then(r => {
  console.log('\n=== Latest Private Messages ===');
  r.rows.forEach(row => {
    console.log(JSON.stringify(row));
  });
  pool.end();
}).catch(e => {
  console.error('Error:', e.message);
  pool.end();
});
