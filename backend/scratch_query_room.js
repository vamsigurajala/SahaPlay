require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT id, "roomId", type, "senderName", message, nonce, "ephemeralPublicKey", timestamp, "hiddenFor" FROM messages WHERE "roomId" = \'3g5jkv\' ORDER BY timestamp ASC')
  .then(res => {
    console.log(`Total messages: ${res.rows.length}`);
    if (res.rows.length > 0) {
      console.log('First 5 messages:');
      console.log(res.rows.slice(0, 5));
      console.log('Last 5 messages:');
      console.log(res.rows.slice(-5));
    }
    pool.end();
  })
  .catch(e => {
    console.error(e);
    pool.end();
  });
