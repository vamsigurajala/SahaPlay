import { isAndroidApp } from './platform';

// Same ambient-proxy approach as nativeShell.js/nativeMedia.js —
// `window.Capacitor.Plugins.AppUpdate` is populated by Capacitor's bridge
// once `cap sync` has linked @capawesome/capacitor-app-update, so this needs
// no npm import (that package is installed only inside the CI-only Android
// build job, same as @capacitor/status-bar etc. — never added to the
// committed package.json, so a real `import` here would break the plain web
// build).
const appUpdate = () => (isAndroidApp() ? window.Capacitor?.Plugins?.AppUpdate : null);

// Google Play Core's own raw int constants
// (com.google.android.play.core.install.model.UpdateAvailability /
// InstallStatus), which @capawesome/capacitor-app-update's native Android
// side passes through unchanged. Not imported from the plugin's own TS enum
// (same "never a real npm dependency of this frontend" reasoning above) —
// hardcoded straight from Google's published reference docs instead.
const UPDATE_AVAILABLE = 2;
const INSTALL_STATUS_DOWNLOADED = 11;

const DISMISS_KEY_PREFIX = 'sp_update_dismissed_v';

// Checked once on load and again on every app resume (Navbar/AppUpdateBanner
// calls this from a window 'focus' listener — nativeShell.js's
// initNativeResumeBridge already rebroadcasts Capacitor's 'resume' lifecycle
// event as a plain 'focus' event, so this needs no native listener of its
// own). Returns the AppUpdateInfo object when a flexible update is both
// available and allowed and the user hasn't already dismissed this exact
// version, or null otherwise.
export async function checkForAppUpdate() {
  const plugin = appUpdate();
  if (!plugin) return null;
  try {
    const info = await plugin.getAppUpdateInfo();
    if (info?.updateAvailability !== UPDATE_AVAILABLE || !info?.flexibleUpdateAllowed) return null;
    if (localStorage.getItem(`${DISMISS_KEY_PREFIX}${info.availableVersionCode}`) === '1') return null;
    return info;
  } catch {
    return null;
  }
}

export function dismissAppUpdate(availableVersionCode) {
  try { localStorage.setItem(`${DISMISS_KEY_PREFIX}${availableVersionCode}`, '1'); } catch {}
}

export function openPlayStore() {
  try {
    window.location.href = 'market://details?id=com.sahaplay.app';
  } catch (_) {
    window.open('https://play.google.com/store/apps/details?id=com.sahaplay.app', '_blank');
  }
}

// Downloads the update in the background (Play Core shows its own one-time
// system consent dialog the first time) while the user keeps using the app,
// then installs and restarts automatically the instant the download
// finishes — matching the one-tap Play Store app-update banner UX.
// onProgress is called with the raw FlexibleUpdateInstallStatus state on every change;
// when download reaches 100% (INSTALL_STATUS_DOWNLOADED), completeFlexibleUpdate()
// is automatically triggered and the app is reloaded.
export async function startFlexibleAppUpdate(onProgress) {
  const plugin = appUpdate();
  if (!plugin) return false;
  try {
    const handle = await plugin.addListener('onFlexibleUpdateStateChange', (state) => {
      onProgress?.(state);
      if (state?.installStatus === INSTALL_STATUS_DOWNLOADED) {
        try { handle.remove(); } catch (_) {}
        plugin.completeFlexibleUpdate()
          .then(() => {
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          })
          .catch(() => {
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          });
      }
    });
    await plugin.startFlexibleUpdate();
    return true;
  } catch {
    return false;
  }
}
