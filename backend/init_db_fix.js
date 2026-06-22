const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS room_bans (
    roomId TEXT NOT NULL,
    username TEXT NOT NULL,
    UNIQUE(roomId, username)
  )`, (err) => {
    if (err) {
      console.error("Error creating room_bans table:", err);
    } else {
      console.log("Successfully created/verified room_bans table.");
    }
  });
});
db.close();
