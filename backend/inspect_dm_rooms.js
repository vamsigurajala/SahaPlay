require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const res = await pool.query(`
      SELECT DISTINCT "roomId" 
      FROM messages 
      WHERE type = 'private'
    `);
    console.log('Distinct DM roomIds:', res.rows);
  } finally {
    pool.end();
  }
}
main();
