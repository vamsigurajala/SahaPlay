const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

const username = 'vamsi';

db.all(`
  SELECT m.id, m."roomId", m.message, m.nonce, m."ephemeralPublicKey", m."senderName", u."publicKey" as "senderPubKey"
  FROM messages m
  LEFT JOIN users u ON LOWER(u.username) = LOWER(m.senderName)
  WHERE m.type = 'group'
  ORDER BY m.timestamp DESC
  LIMIT 5
`, (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log('--- LATEST GROUP MESSAGES ---');
  rows.forEach(r => {
    console.log(`Room: ${r.roomId} | Sender: ${r.senderName}`);
    console.log(`  Message: ${r.message.substring(0, 20)}...`);
    console.log(`  Nonce: ${r.nonce}`);
    console.log(`  Keys JSON (ephemeralPublicKey): ${r.ephemeralPublicKey}`);
    console.log(`  Sender PK: ${r.senderPubKey}`);
    console.log('  ---');
  });
  db.close();
});
