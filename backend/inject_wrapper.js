const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const classStart = code.indexOf('class SupabaseAdapter {');
const classEnd = code.indexOf('const db = new SupabaseAdapter();');

if (classStart === -1 || classEnd === -1) {
    console.error("Could not find adapter");
} else {
    const fixedAdapter = `class SupabaseAdapter {
  constructor() {
    this.serialize = (cb) => { if (cb) cb(); };
    this.close = () => pool.end();
  }
  
  _convertSql(sql, params) {
    let p = params || [];
    if (!Array.isArray(p)) p = [p];
    
    let _idx = 0;
    let pgSql = sql.replace(/\\?/g, () => '$' + (++_idx));
    
    const camelCols = [
        'roomId', 'senderId', 'senderName', 'targetId', 'targetName', 
        'ephemeralPublicKey', 'replyTo', 'hiddenFor', 'mediaType', 'mediaUrl', 
        'roomName', 'hostUsername', 'isPublic', 'thumbnailPath', 
        'followerId', 'followingId', 'createdAt', 'isVerified', 
        'verificationToken', 'resetToken', 'resetTokenExpiry', 'displayName', 
        'avatarPath', 'notifyApp', 'notifyJoin', 'notifyMessages', 
        'notifyFriendRequests', 'notifyLeave', 'showCountry', 'pinnedRooms', 
        'lastSeen', 'senderAvatar', 'senderAvatarPath'
    ];
    
    camelCols.forEach(col => {
      // Find the exact word boundary, wrap it in double quotes limit to once
      const regex = new RegExp("\\\\b" + col + "\\\\b(?!(?:[^\\"]*\\"[^\\"]*\\")*[^\\"]*\\")", "g");
      pgSql = pgSql.replace(regex, '\\"' + col + '\\"');
    });
    
    pgSql = pgSql.replace(/INSERT OR IGNORE/gi, 'INSERT');
    pgSql = pgSql.replace(/AUTOINCREMENT/gi, '');
    
    return { pgSql, p };
  }

  run(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    const { pgSql, p } = this._convertSql(sql, params);
    
    let finalSql = pgSql;
    if (sql.match(/INSERT OR IGNORE/i) && !finalSql.includes('ON CONFLICT')) {
      finalSql += ' ON CONFLICT DO NOTHING';
    }

    pool.query(finalSql, p)
      .then(res => {
        if (callback) callback.call({ changes: res.rowCount, lastID: res.rows?.[0]?.id }, null);
      })
      .catch(err => {
        if (err.code === '23505' && sql.match(/INSERT OR IGNORE/i)) {
          if (callback) callback.call({ changes: 0 }, null);
        } else {
          console.error("Database Engine Error [RUN]:", err.message, "\\nSQL:", finalSql);
          if (callback) callback(err);
        }
      });
  }

  get(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    const { pgSql, p } = this._convertSql(sql, params);
    pool.query(pgSql, p)
      .then(res => { if (callback) callback(null, res.rows[0] || null); })
      .catch(err => { console.error("Database Engine Error [GET]:", err.message, "\\nSQL:", pgSql); if (callback) callback(err, null); });
  }

  all(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    const { pgSql, p } = this._convertSql(sql, params);
    pool.query(pgSql, p)
      .then(res => { if (callback) callback(null, res.rows || []); })
      .catch(err => { console.error("Database Engine Error [ALL]:", err.message, "\\nSQL:", pgSql); if (callback) callback(err, null); });
  }
}

`;
    code = code.substring(0, classStart) + fixedAdapter + code.substring(classEnd);
    fs.writeFileSync('server.js', code);
    console.log("Fixed!");
}
