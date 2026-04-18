require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixSequence() {
  try {
    const res = await pool.query(`SELECT setval('messages_id_seq', (SELECT MAX(id) FROM messages))`);
    console.log("Sequence updated:", res.rows[0].setval);
  } catch(e) {
    console.error("Failed to update sequence:", e.message);
  } finally {
    pool.end();
  }
}
fixSequence();
