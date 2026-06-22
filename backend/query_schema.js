require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkSchema() {
  try {
    const res = await pool.query('SELECT * FROM room_names');
    console.log(res.rows);
  } finally {
    pool.end();
  }
}
checkSchema();

