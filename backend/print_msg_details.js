const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT id, "senderName", "targetName", message, "senderMessage", nonce, "ephemeralPublicKey"
      FROM messages
      WHERE id IN ('882', '881', '880', '879', '867', '866', '864', '863')
      ORDER BY id DESC
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    pool.end();
  }
}

main();
