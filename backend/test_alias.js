require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`
SELECT m.id, m.message, u."avatarPath" as "senderAvatarPath", u."publicKey" as "senderPublicKey"
FROM messages m
LEFT JOIN users u ON u.username = m."senderName"
WHERE m.type = 'private' ORDER BY m.timestamp DESC LIMIT 1
`)
  .then(res => { console.log(Object.keys(res.rows[0])); pool.end(); })
  .catch(e => console.error(e));
