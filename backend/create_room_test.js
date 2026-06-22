require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const roomId = process.argv[2];
const hostUsername = process.argv[3];

if (!roomId) {
  console.error("Room ID required");
  process.exit(1);
}

pool.query(
  `INSERT INTO room_names ("roomId", "roomName", "isPublic", "hostUsername", category) 
   VALUES ($1, $2, 0, $3, 'other') 
   ON CONFLICT ("roomId") DO NOTHING`, 
  [roomId, `TestRoom_${roomId}`, hostUsername || null]
).then(() => {
  console.log(`Room ${roomId} pre-created in database.`);
  pool.end();
  process.exit(0);
}).catch(err => {
  console.error(err);
  pool.end();
  process.exit(1);
});
