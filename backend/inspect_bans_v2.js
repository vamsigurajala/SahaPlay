const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');
db.all("SELECT * FROM room_bans", [], (err, rows) => {
  if (err) {
    console.error("DB Query Error:", err);
  } else {
    console.log("ALL BANS IN DB:");
    console.log(JSON.stringify(rows, null, 2));
  }
  db.close();
});
