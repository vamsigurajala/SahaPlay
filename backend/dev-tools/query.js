require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkUsers() {
  try {
    const res = await pool.query(`SELECT id, username, "displayName", "publicKey" FROM users WHERE username ILIKE 'krish%' OR username ILIKE 'vamsi%'`);
    console.log(res.rows);
  } finally {
    pool.end();
  }
}
checkUsers();
