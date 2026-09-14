/**
 * deviceUnlockSettings.js
 *
 * Persisted preference for the "Require fingerprint every time I open the
 * app" setting (Profile → Device Unlock). Deliberately its own tiny module
 * rather than folded into deviceUnlock.js or CryptoContext.jsx: the value
 * itself is NOT secret (it's a plain on/off preference, safe in localStorage
 * exactly like every other UI preference in this app — dark mode, language,
 * etc.), and keeping it separate lets both CryptoContext.jsx (reads it on
 * every app launch) and Profile.jsx (reads/writes it from the settings UI)
 * depend on a single small module instead of each other.
 *
 * Default: OFF (false) — preserves the existing "enroll once, never asked
 * again on this device" behavior for every account that never touches this
 * setting, per explicit design requirement.
 */
const STRICT_MODE_KEY = 'watch_strict_device_unlock';

/** Whether "require fingerprint every open" is currently enabled on this device. */
export function isStrictDeviceUnlockEnabled() {
  return localStorage.getItem(STRICT_MODE_KEY) === 'true';
}

/** Persists the setting. Purely a local UI preference — never sent to the server. */
export function setStrictDeviceUnlockEnabled(enabled) {
  if (enabled) {
    localStorage.setItem(STRICT_MODE_KEY, 'true');
  } else {
    localStorage.removeItem(STRICT_MODE_KEY);
  }
}
