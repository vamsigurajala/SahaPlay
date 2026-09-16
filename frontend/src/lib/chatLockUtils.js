import { appCache } from '../cache/appCache.js';
import { resetPrefetchCooldown } from '../cache/prefetch.js';

/**
 * Perform complete client-side data wipe when Chat Lock self-destruct is triggered.
 * Clears all locked, hidden, pinned, recent, and cleared chat data from localStorage
 * and resets all internal application caches and dispatches UI sync events.
 *
 * @param {string} [username] - Optional username of the logged-in user
 */
export const wipeLockedChatsData = (username) => {
  const user = (username || localStorage.getItem('watch_username') || '').toLowerCase();

  const keysToRemove = [
    'chat_lock_state',
    'chat_recent_chats',
    'watch_recent_chats',
    'chat_cleared_partners'
  ];

  if (user) {
    keysToRemove.push(
      `locked_chats_${user}`,
      `hidden_chats_${user}`,
      `pinned_room_chats_${user}`,
      `pinned_chats_${user}`,
      `muted_chats_${user}`,
      `muted_call_chats_${user}`,
      `chat_lock_state_${user}`,
      `chat_lock_enabled_${user}`,
      `chat_themes_${user}`
    );
  }

  const prefixesToRemove = [
    'locked_chats_',
    'hidden_chats_',
    'pinned_room_chats_',
    'pinned_chats_',
    'chat_lock_state_',
    'chat_lock_enabled_'
  ];

  keysToRemove.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  });

  try {
    const allKeys = Object.keys(localStorage);
    allKeys.forEach((key) => {
      if (prefixesToRemove.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key);
      }
    });
  } catch {}

  // Clear in-memory caches
  try {
    appCache.clear();
    resetPrefetchCooldown();
  } catch {}

  // Dispatch UI update events across all React components
  try {
    window.dispatchEvent(new Event('hidden_chats_updated'));
    window.dispatchEvent(new Event('locked_chats_updated'));
    window.dispatchEvent(new Event('conversations_updated'));
    window.dispatchEvent(new Event('chat_cleared_updated'));
    window.dispatchEvent(new Event('storage'));
  } catch {}
};
