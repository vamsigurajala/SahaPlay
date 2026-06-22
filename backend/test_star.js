require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`
SELECT m.* 
FROM messages m 
WHERE m.type = 'private' ORDER BY m.timestamp DESC LIMIT 1
`)
  .then(res => { console.log(Object.keys(res.rows[0])); pool.end(); })
  .catch(e => console.error(e));
