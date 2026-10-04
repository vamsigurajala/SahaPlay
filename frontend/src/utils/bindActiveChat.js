// Keeps the server told which chat the user is looking at, so it can skip the
// push notification (toast + sound) for it — see 'chat_active' in
// backend/server.js. The server forgets this the moment the user's socket
// drops (common on phones/tablets: backgrounding, network blips, screen
// lock), so it has to be announced again on every reconnect, and withdrawn
// while the app isn't actually on screen (otherwise a chat left open in a
// backgrounded app would silence its own notifications).
//
// Returns a cleanup function that removes the listeners and marks the chat
// inactive again.
export function bindActiveChat(sock, chatId) {
  if (!sock || !chatId) return () => {};
  const isVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
  const announce = () => { if (isVisible()) sock.emit('chat_active', { chatId }); };
  const onVisibility = () => {
    if (isVisible()) sock.emit('chat_active', { chatId });
    else sock.emit('chat_inactive', { chatId });
  };
  announce();
  sock.on('connect', announce);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
  return () => {
    sock.off('connect', announce);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    sock.emit('chat_inactive', { chatId });
  };
}
