import { API } from './api';

// Casts (or changes/withdraws, by passing an empty array) this user's vote
// on a poll message — see POST /api/chats/vote in server.js. optionIndices
// is the FULL desired selection, not a single toggle: the caller (PollBubble)
// already computed the new array locally before calling this.
export async function castPollVote(messageId, optionIndices, token) {
  const resp = await fetch(`${API}/api/chats/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ messageId, optionIndices }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || 'Vote failed');
  }
  return resp.json();
}
