require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query('SELECT * FROM users LIMIT 1', (err, res) => {
  if (err) {
    console.error("Connection Error:", err.message);
  } else {
    console.log("Success! Found user:", res?.rows?.[0]);
  }
  pool.end();
});
