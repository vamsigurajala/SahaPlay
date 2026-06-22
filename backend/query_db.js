const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));

db.all(`
  SELECT id, "roomId", type, "senderName", "targetName", message, "mediaUrl", "mediaType", media_file_name, media_duration, timestamp
  FROM messages 
  WHERE type = 'private'
  ORDER BY timestamp DESC LIMIT 10
`, [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log(JSON.stringify(rows, null, 2));
  }
  db.close();
});
