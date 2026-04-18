require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`
SELECT m.id, m.message, u.username, u."avatarPath" 
FROM messages m 
LEFT JOIN users u ON u.username = m."senderName" 
WHERE m.type = 'private' ORDER BY m.timestamp DESC LIMIT 5`)
  .then(res => { console.log(res.rows); pool.end(); })
  .catch(e => console.error(e));
