const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  try {
    const res = await pool.query('SELECT username, "publicKey", "encryptedPrivateKey", "recoveryKeyHash" FROM users WHERE LOWER(username) IN (\'vamsi\', \'krish\')');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    pool.end();
  }
}

main();
