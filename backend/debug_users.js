require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function debug() {
  const res = await pool.query('SELECT type, "senderId", "senderName", "targetId", "targetName", "roomId", "message" FROM messages WHERE type=\'private\' ORDER BY id DESC LIMIT 10');
  console.log("Recent Private Messages:");
  console.dir(res.rows, {depth: null});
  pool.end();
}
debug();
