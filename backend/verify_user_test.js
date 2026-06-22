require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const username = process.argv[2];

if (!username) {
  console.error("Username required");
  process.exit(1);
}

pool.query('UPDATE users SET "isVerified" = 1, "verificationToken" = NULL WHERE LOWER(username) = LOWER($1)', [username])
  .then(() => {
    console.log(`User ${username} verified in database.`);
    pool.end();
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    pool.end();
    process.exit(1);
  });
