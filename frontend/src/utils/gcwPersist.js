// Shared with GlobalChatWidget.jsx, which persists isOpen/view/activeChat to
// sessionStorage under these same keys so a swipe-back (or any remount of
// the page hosting the widget) restores the same open chat instead of
// showing a freshly-closed widget.
export function getPersistedGcwOpen() {
  try { return sessionStorage.getItem('gcw_is_open') === 'true'; } catch { return false; }
}
