const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testFetchHistoryDecryption() {
  const rows = await pool.query(`SELECT * FROM messages WHERE type='private' AND "senderName" IN ('krish','vamsi') ORDER BY timestamp DESC LIMIT 5`).then(r=>r.rows);
  
  for (const m of rows) {
     console.log(`\n===================`);
     console.log(`Message from ${m.senderName} to ${m.targetName}`);
     console.log(`Message (B64):`, m.message.substring(0, 30) + '...');
     console.log(`SenderMessage:`, m.senderMessage ? (m.senderMessage.substring(0,30)+'...') : 'NULL');
     console.log(`Nonce       :`, m.nonce);
     console.log(`EphemeralPK :`, m.ephemeralPublicKey);
  }
  pool.end();
}

testFetchHistoryDecryption();
