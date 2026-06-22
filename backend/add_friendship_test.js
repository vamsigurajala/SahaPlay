require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const userA = process.argv[2];
const userB = process.argv[3];

if (!userA || !userB) {
  console.error("Two usernames required: node add_friendship_test.js userA userB");
  process.exit(1);
}

async function run() {
  try {
    // Insert follow relationship from userA to userB
    await pool.query(
      `INSERT INTO follows ("followerId", "followingId", status) 
       VALUES ($1, $2, 'accepted') 
       ON CONFLICT ("followerId", "followingId") DO UPDATE SET status = 'accepted'`, 
      [userA, userB]
    );

    // Insert follow relationship from userB to userA
    await pool.query(
      `INSERT INTO follows ("followerId", "followingId", status) 
       VALUES ($1, $2, 'accepted') 
       ON CONFLICT ("followerId", "followingId") DO UPDATE SET status = 'accepted'`, 
      [userB, userA]
    );

    console.log(`Mutual friendship established between ${userA} and ${userB}.`);
    process.exit(0);
  } catch (err) {
    console.error("Error establishing friendship:", err.message);
    process.exit(1);
  } finally {
    pool.end();
  }
}

run();
