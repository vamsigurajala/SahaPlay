require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`SELECT username, "avatarPath" FROM users WHERE username ILIKE 'krish%'`)
  .then(res => { console.log(res.rows); pool.end(); })
  .catch(e => console.error(e));
