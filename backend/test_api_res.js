require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const username = 'krish';
const partner = 'vamsi';

pool.query(`
        SELECT m.*, u."avatarPath" as "senderAvatarPath", u."publicKey" as "senderPublicKey"
        FROM messages m
        LEFT JOIN users u ON u.username = m."senderName"
        WHERE m.type = 'private'
          AND ((m."senderName" = $1 AND m."targetName" = $2)
            OR (m."senderName" = $3 AND m."targetName" = $4))
        ORDER BY m.timestamp ASC LIMIT 5
`, [username, partner, partner, username]).then(r => {
  const filtered = r.rows.map(r => ({
      id: r.id.toString(),
      isMe: r.senderName === username,
      senderName: r.senderName,
      senderAvatar: r.senderAvatarPath || null,
      message: r.message,
      senderMessage: r.senderMessage || null,
      nonce: r.nonce || null,
      ephemeralPublicKey: r.ephemeralPublicKey || null,
      mediaUrl: r.mediaUrl || null,
      mediaType: r.mediaType || null,
  }));
  console.log(filtered);
  pool.end();
}).catch(e => console.error(e));
