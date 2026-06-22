require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const roomId = '3g5jkv';
const username = 'guest_sonu';

pool.query(`
  SELECT * FROM (
    SELECT m.*, u."avatarPath" as "senderAvatarPath"
    FROM messages m
    LEFT JOIN users u ON u.username = m."senderName"
    WHERE m."roomId" = $1 AND (m.type = 'room' OR m.type = 'group')
    ORDER BY m.timestamp DESC LIMIT 200
  ) sub
  ORDER BY sub.timestamp ASC
`, [roomId], async (err, pgRes) => {
  if (err) {
    console.error(err);
    pool.end();
    return;
  }
  const groupRows = pgRes.rows;
  console.log(`Fetched groupRows count: ${groupRows.length}`);
  
  const visibleGroupRows = groupRows.filter(r =>
    !(r.hiddenFor && r.hiddenFor.includes(`"${username}"`)));
    
  console.log(`visibleGroupRows count: ${visibleGroupRows.length}`);
  
  const history = visibleGroupRows.map(r => ({
    id: r.id.toString(),
    username: r.senderName,
    message: r.message,
    timestamp: r.timestamp,
    hiddenFor: r.hiddenFor
  }));
  
  console.log("Visible messages:");
  console.log(history);
  pool.end();
});
