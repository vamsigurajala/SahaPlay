
// Test what _convertSql does with $1-style params
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

const q = String.fromCharCode(34);

function convertSql(sql) {
  let pgSql = sql;
  camelCols.forEach(col => {
    const regex = new RegExp('(?<![\"\\w])' + col + '(?![\"\\w])', 'g');
    pgSql = pgSql.replace(regex, q + col + q);
  });
  return pgSql;
}

const sql1 = `
  SELECT DISTINCT ON (partner)
    m.timestamp as lastTimestamp,
    CASE WHEN m.senderName = $1 THEN m.targetName ELSE m.senderName END as partner,
    m.roomId,
    m.message,
    m.mediaUrl,
    m.mediaType,
    'private' as type,
    m.senderName = $2 as isMyLastMessage
  FROM messages m
  WHERE m.type = 'private' 
    AND (m.senderName = $3 OR m.targetName = $4)
    AND (m.hiddenFor IS NULL OR m.hiddenFor NOT LIKE '%' || $5 || '%')
  ORDER BY partner, m.timestamp DESC
`;

console.log("Result:\n", convertSql(sql1));
