// Shared between Room.jsx (reactionPreviews) and GlobalChatWidget.jsx
// (reactionPreviewOverrides) so a "X reacted [emoji] to your message" chat-list
// preview survives a page refresh, and both surfaces agree on the same text
// for the same chat since they read/write the same localStorage key.
const STORAGE_KEY = 'watch_reaction_previews';

export function getPersistedReactionPreviews() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};
  }
}

export function setPersistedReactionPreview(key, text) {
  if (!key) return;
  try {
    const all = getPersistedReactionPreviews();
    all[key] = text;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export function clearPersistedReactionPreview(key) {
  if (!key) return;
  try {
    const all = getPersistedReactionPreviews();
    if (key in all) {
      delete all[key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    }
  } catch {}
}
