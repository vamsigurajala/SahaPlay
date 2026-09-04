// Pure client-side notification gating — mirrors the backend's
// NOTIFY_COLUMN_BY_CATEGORY pattern (backend/lib/notifyPrefs.js) on the
// frontend side: AppSettings.jsx mirrors notifyApp/notifyCalls/notifyMessages
// into localStorage whenever they're toggled, and this is the single
// synchronous check every notification call site (CallContext.jsx,
// GlobalChatWidget.jsx) reads before showing a toast or desktop
// Notification popup. The master 'notifyApp' toggle always gates every
// category, same as the backend's isNotifyEnabledFromRow.
const NOTIFY_KEY_BY_CATEGORY = {
  calls: 'notifyCalls',
  messages: 'notifyMessages',
};

export function isNotifyCategoryEnabled(category) {
  if (localStorage.getItem('notifyApp') === 'false') return false;
  const key = NOTIFY_KEY_BY_CATEGORY[category];
  if (!key) return true;
  return localStorage.getItem(key) !== 'false';
}
