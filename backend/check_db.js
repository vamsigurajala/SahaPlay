require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkDetails() {
  try {
    console.log("--- Column Defaults ---");
    const resDefaults = await pool.query(`
      SELECT column_name, column_default, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'messages'
    `);
    console.log(resDefaults.rows);

    console.log("\n--- Sequence Status ---");
    const resSeq = await pool.query(`
      SELECT last_value FROM messages_id_seq
    `).catch(e => ({ rows: [{ error: 'No sequence found' }] }));
    console.log(resSeq.rows);

    console.log("\n--- Max ID in Messages ---");
    const resMax = await pool.query(`SELECT MAX(id) FROM messages`);
    console.log(resMax.rows);

  } finally {
    pool.end();
  }
}
checkDetails();
