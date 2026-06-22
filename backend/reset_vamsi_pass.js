const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    const hashed = await bcrypt.hash('Vfstr#pps7', 10);
    await pool.query('UPDATE users SET password = $1 WHERE LOWER(username) = \'vamsi\'', [hashed]);
    console.log("Updated vamsi password to Vfstr#pps7");
    
    // Also update krish just in case
    await pool.query('UPDATE users SET password = $1 WHERE LOWER(username) = \'krish\'', [hashed]);
    console.log("Updated krish password to Vfstr#pps7");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
