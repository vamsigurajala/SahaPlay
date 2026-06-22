const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54323/postgres'
});

async function main() {
  try {
    const res = await pool.query('SELECT username, "displayName", "avatarPath" FROM users');
    console.log('Users:', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
