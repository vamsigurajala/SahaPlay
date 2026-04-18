const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`SELECT username, "publicKey" FROM users WHERE username IN ('krishna', 'vamsi')`).then(r => {
  console.log('Public Keys:');
  console.log(r.rows);
  pool.end();
}).catch(e => {
  console.error(e.message);
  pool.end();
});
