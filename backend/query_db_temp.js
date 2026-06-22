const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54323/postgres'
});

async function main() {
  try {
    console.log('Querying message_seen for dm-krish-vamsi...');
    const seen = await pool.query('SELECT * FROM message_seen WHERE room_id = $1', ['dm-krish-vamsi']);
    console.log('Message Seen for dm-krish-vamsi:', JSON.stringify(seen.rows, null, 2));

    console.log('Querying message_seen for recent message ids...');
    const seenIds = await pool.query('SELECT * FROM message_seen WHERE message_id::text IN ($1, $2, $3, $4, $5)', ['803', '802', '801', '799', '798']);
    console.log('Message Seen by IDs:', JSON.stringify(seenIds.rows, null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
