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
 *
 * "@everyone" is a reserved keyword, not a real username — it never needs to
 * appear in candidateUsernames to be recognized. Explicit product decision:
 * an individual "@name" mention highlights red only for its sender and the
 * person it names (everyone else in the group sees plain text), but
 * "@everyone" highlights red for EVERY viewer, same as Microsoft Teams'
 * own @mention/@everyone split.
 */

const USERNAME_TOKEN = '[a-zA-Z0-9_]{2,32}';
const MENTION_RE = new RegExp(`@(${USERNAME_TOKEN})`, 'g');
export const EVERYONE_KEYWORD = 'everyone';

/**
 * Returns the lowercase usernames genuinely mentioned in `text` — "@word"
 * tokens whose word case-insensitively matches one of `candidateUsernames`,
 * plus every candidate at once if "@everyone" appears. An "@something" that
 * isn't actually a member of this chat (and isn't "@everyone") is left alone
 * (never produces a mention), so this can't be used to notify someone who
 * was never really mentioned. The sender's own username is also excluded —
 * mentioning yourself (directly or via @everyone) is a no-op, not a
 * notification.
 */
export function extractMentionedUsernames(text, candidateUsernames, senderUsername) {
  if (!text || !Array.isArray(candidateUsernames) || candidateUsernames.length === 0) return [];
  const senderLower = (senderUsername || '').toLowerCase();
  const byLower = new Map();
  for (const u of candidateUsernames) {
    if (u) byLower.set(u.toLowerCase(), u);
  }
  const found = new Set();
  let mentionsEveryone = false;
  const re = new RegExp(MENTION_RE.source, 'g');
  let m;
  while ((m = re.exec(text))) {
    const lower = m[1].toLowerCase();
    if (lower === EVERYONE_KEYWORD) { mentionsEveryone = true; continue; }
    if (lower === senderLower) continue;
    if (byLower.has(lower)) found.add(lower);
  }
  if (mentionsEveryone) {
    for (const lower of byLower.keys()) {
      if (lower !== senderLower) found.add(lower);
    }
  }
  return Array.from(found);
}

/**
 * Splits `text` into an array of plain strings and `{ mention, isMe,
 * isEveryone }` tokens for a caller to map into React nodes. A token matches
 * either a real candidate username or the "@everyone" keyword — everything
 * else (a bare "@", an unknown "@word", an email-shaped "name@domain.tld")
 * passes through as ordinary text, same reasoning as
 * extractMentionedUsernames. `candidateUsernames` may be omitted/empty, in
 * which case every "@word" is treated as a mention (used where a caller has
 * no live roster to validate against, e.g. rendering a mention typed before
 * someone left the room) — "@everyone" is recognized either way.
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
    const isEveryone = lower === EVERYONE_KEYWORD;
    if (!isEveryone && hasAllowlist && !byLower.has(lower)) continue;
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    parts.push({
      mention: isEveryone ? 'everyone' : (hasAllowlist ? byLower.get(lower) : m[1]),
      isMe: !isEveryone && !!myLower && lower === myLower,
      isEveryone,
    });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? parts : [text];
}

/**
 * Cheap boolean check for "does this text @mention me (or everyone)" — used
 * by the conversation-list red-border indicator (messagePreview.jsx), which
 * only has the latest message's plaintext to go on, not a room roster.
 */
export function textMentionsUser(text, username) {
  if (!text || !username) return false;
  if (/@everyone\b/i.test(text)) return true;
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`@${escaped}\\b`, 'i');
  return re.test(text);
}
