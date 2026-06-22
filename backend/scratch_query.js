require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`
  SELECT DISTINCT "roomId", type
  FROM messages 
  WHERE type = 'private'
`, (err, res) => {
  if (err) {
    console.error("Query Error:", err.message);
  } else {
    console.log("Private Rooms:\n", JSON.stringify(res?.rows, null, 2));
  }
  pool.end();
});

