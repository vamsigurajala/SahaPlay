/**
 * chatPreferences.js
 *
 * Two small, purely-local UI preferences (never sent to the server) shared
 * by every chat composer/message surface in the app — GlobalChatWidget.jsx
 * (both its private-DM and room views) and RoomChatPanel.jsx (its separate
 * Group and DM tabs). Profile → Chats (ChatSettings.jsx) is the only screen
 * that writes these; every chat surface just reads them.
 *
 * Font size is applied via a single CSS custom property
 * (--chat-font-size) set on <html> rather than React state/context —
 * every message bubble's inline style reads that var (with a 14px
 * fallback matching the old hardcoded value), so changing it here updates
 * every open chat window instantly, including ones mounted in a totally
 * different component tree, with no prop drilling or event bus needed.
 * Same pattern this codebase already uses for --sp-status-bar-inset and
 * --sp-nav-bar-inset (lib/nativeShell.js).
 *
 * Enter-to-send has no visual/CSS equivalent (it's a keydown-handler
 * branch), so isEnterToSend() is just read fresh from localStorage at the
 * moment of each keypress — cheap enough that no caching/event wiring is
 * needed either, and it's automatically live the same way.
 */

const FONT_SIZE_KEY = 'chat_font_size';
const ENTER_TO_SEND_KEY = 'chat_enter_to_send';
const FONT_SIZE_CSS_VAR = '--chat-font-size';

export const CHAT_FONT_SIZES = ['small', 'medium', 'big'];

// medium (14px) matches the size every message bubble was already
// hardcoded to before this setting existed, so a user who never touches
// this setting sees no change at all.
const FONT_SIZE_PX = { small: 12, medium: 14, big: 17 };

export function getChatFontSize() {
  const v = localStorage.getItem(FONT_SIZE_KEY);
  return CHAT_FONT_SIZES.includes(v) ? v : 'medium';
}

/** Persists the size and immediately applies it to every mounted chat surface via the shared CSS var. */
export function setChatFontSize(size) {
  const safe = CHAT_FONT_SIZES.includes(size) ? size : 'medium';
  localStorage.setItem(FONT_SIZE_KEY, safe);
  applyChatFontSize();
}

/** Re-reads the persisted size and (re)applies the CSS var — call once at app startup so the very first paint already has the right size, same as nativeShell.js's status-bar-inset init. */
export function applyChatFontSize() {
  const px = FONT_SIZE_PX[getChatFontSize()];
  document.documentElement.style.setProperty(FONT_SIZE_CSS_VAR, `${px}px`);
}

// Default ON — preserves every existing user's current experience (Enter
// sends, Shift+Enter newlines) unless they explicitly opt into newline-by-
// default from Profile → Chats.
export function isEnterToSend() {
  const v = localStorage.getItem(ENTER_TO_SEND_KEY);
  return v === null ? true : v === 'true';
}

export function setEnterToSend(enabled) {
  localStorage.setItem(ENTER_TO_SEND_KEY, enabled ? 'true' : 'false');
}
