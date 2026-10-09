/**
 * mentions.js
 *
 * Plain-text "@mention" helpers shared by every group/room chat surface
 * (Room.jsx's own composer + RoomChatPanel.jsx's group tab, and
 * GlobalChatWidget.jsx's room-type chats). Deliberately scoped to GROUP/ROOM
 * chats only — a private 1:1 DM has exactly one other person, so an
 * @mention there is never ambiguous and isn't offered.
 *
 * Nothing in this file ever touches encryption. It only ever runs on text a
 * client already has in the clear — either composing a message BEFORE it's
 * encrypted (to decide who to notify) or AFTER a message is decrypted (to
 * render the highlight) — so it can't affect what gets encrypted or how.
 *
 * Usernames here match this app's actual signup charset (alphanumeric +
 * underscore — see Signup.jsx's own validation), so "@word" is only ever
 * treated as a mention when "word" is shaped like a real username. This is
 * also why a bare "@" or "name@example.com" never gets picked up: the former
 * has nothing after it, and the latter's "word" (the domain) never matches a
 * real username unless someone is unlucky enough to be named exactly that.
 */

const USERNAME_TOKEN = '[a-zA-Z0-9_]{2,32}';
const MENTION_RE = new RegExp(`@(${USERNAME_TOKEN})`, 'g');

/**
 * Returns the lowercase usernames genuinely mentioned in `text` — "@word"
 * tokens whose word case-insensitively matches one of `candidateUsernames`.
 * An "@something" that isn't actually a member of this chat is left alone
 * (never produces a mention), so this can't be used to notify someone who
 * was never really mentioned. The sender's own username is also excluded —
 * mentioning yourself is a no-op, not a notification.
 */
export function extractMentionedUsernames(text, candidateUsernames, senderUsername) {
  if (!text || !Array.isArray(candidateUsernames) || candidateUsernames.length === 0) return [];
  const senderLower = (senderUsername || '').toLowerCase();
  const byLower = new Map();
  for (const u of candidateUsernames) {
    if (u) byLower.set(u.toLowerCase(), u);
  }
  const found = new Set();
  const re = new RegExp(MENTION_RE.source, 'g');
  let m;
  while ((m = re.exec(text))) {
    const lower = m[1].toLowerCase();
    if (lower === senderLower) continue;
    if (byLower.has(lower)) found.add(lower);
  }
  return Array.from(found);
}

/**
 * Splits `text` into an array of plain strings and `{ mention, isMe }`
 * tokens for a caller to map into React nodes. Only tokens that match a
 * real candidate username become mention tokens — everything else (a bare
 * "@", an unknown "@word", an email-shaped "name@domain.tld") passes
 * through as ordinary text, same reasoning as extractMentionedUsernames.
 * `candidateUsernames` may be omitted/empty, in which case every "@word" is
 * treated as a mention (used where a caller has no live roster to validate
 * against, e.g. rendering a mention typed before someone left the room).
 */
export function splitTextWithMentions(text, candidateUsernames, myUsername) {
  if (!text) return [text];
  const hasAllowlist = Array.isArray(candidateUsernames) && candidateUsernames.length > 0;
  const byLower = new Map();
  if (hasAllowlist) {
    for (const u of candidateUsernames) {
      if (u) byLower.set(u.toLowerCase(), u);
    }
  }
  const myLower = (myUsername || '').toLowerCase();
  const re = new RegExp(MENTION_RE.source, 'g');
  const parts = [];
  let lastIndex = 0;
  let m;
  while ((m = re.exec(text))) {
    const lower = m[1].toLowerCase();
    if (hasAllowlist && !byLower.has(lower)) continue;
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    parts.push({ mention: hasAllowlist ? byLower.get(lower) : m[1], isMe: !!myLower && lower === myLower });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? parts : [text];
}

/**
 * Cheap boolean check for "does this text @mention me" — used by the
 * conversation-list red-border indicator (messagePreview.jsx), which only
 * has the latest message's plaintext to go on, not a room roster.
 */
export function textMentionsUser(text, username) {
  if (!text || !username) return false;
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`@${escaped}\\b`, 'i');
  return re.test(text);
}
