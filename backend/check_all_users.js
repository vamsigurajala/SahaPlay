const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`SELECT username, "publicKey" IS NOT NULL as has_pk FROM users`).then(r => {
  console.log('All Users Public Keys:');
  console.log(r.rows);
  pool.end();
}).catch(e => {
  console.error(e.message);
  pool.end();
});
