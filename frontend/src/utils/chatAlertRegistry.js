// Shared between every mounted GlobalChatWidget instance.
//
// On phones/tablets the top bar (Navbar) and the bottom bar (BottomNav) each
// mount their own GlobalChatWidget, each with its own socket listener. Only
// one of them is the one the user actually opened, so the OTHER one saw every
// incoming message as "a chat that isn't open" and fired the in-app toast +
// notification tone — even for the chat the user was looking at. These two
// helpers let the instances agree on (1) which chats are open anywhere, and
// (2) which one alerts for a given message, so there is never a duplicate or
// a mistaken alert.
const openChats = new Map(); // instance id -> lowercase chat keys currently open on screen
const toastOnlyChats = new Map(); // instance id -> chats whose in-app toast/tone is handled elsewhere (e.g. a room's own chat panel)

const clean = (keys) => (keys || []).filter(Boolean).map(k => String(k).toLowerCase());

export function setInstanceOpenChat(instanceId, keys, toastOnlyKeys) {
  const open = clean(keys);
  if (open.length) openChats.set(instanceId, open); else openChats.delete(instanceId);
  const quiet = clean(toastOnlyKeys);
  if (quiet.length) toastOnlyChats.set(instanceId, quiet); else toastOnlyChats.delete(instanceId);
}

export function isChatOpenAnywhere(chatKey) {
  const key = String(chatKey || '').toLowerCase();
  if (!key) return false;
  for (const keys of openChats.values()) {
    if (keys.includes(key)) return true;
  }
  return false;
}

// Open anywhere, OR a room whose own chat panel already toasts for it.
export function isChatToastHandledAnywhere(chatKey) {
  if (isChatOpenAnywhere(chatKey)) return true;
  const key = String(chatKey || '').toLowerCase();
  if (!key) return false;
  for (const keys of toastOnlyChats.values()) {
    if (keys.includes(key)) return true;
  }
  return false;
}

const alerted = new Set();

// True for the first caller per message, false for every later one — so only
// one widget instance shows the toast / plays the tone for a given message.
export function claimMessageAlert(msgKey) {
  if (!msgKey) return true;
  if (alerted.has(msgKey)) return false;
  if (alerted.size > 500) alerted.clear();
  alerted.add(msgKey);
  return true;
}
