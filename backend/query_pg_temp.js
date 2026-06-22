const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  try {
    const res = await pool.query(
      `UPDATE users SET password = $1 WHERE username = $2`,
      ['$2b$10$K11F48tUza2TBgKy6RweWOxOV72aF6/yTH3vaQphjp2fufkdULSOa', 'krish']
    );
    console.log("Updated password rows:", res.rowCount);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
