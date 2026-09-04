// Detects when a newer deploy has gone live while this tab/window is still
// running an older build — the actual gap this closes: Vite hashes every JS
// chunk per build, so a tab open across a deploy holds stale chunk filenames
// in memory; App.jsx's ErrorBoundary already auto-reloads once as a REACTIVE
// fallback for exactly this (see its own comment), but only after the user
// actually hits a 404 trying to lazy-load one. This is the PROACTIVE half —
// catch it in the background and offer a refresh before anything breaks.
//
// Works identically for a plain browser tab, the Tauri desktop .exe, and the
// Android app's WebView — all three just load this same site live, so all
// three benefit without any platform-specific code.
//
// Detection method: fetch the server's current index.html (same one every
// deploy regenerates with new hashed asset filenames baked in) and compare
// its raw text against whatever was first observed this session. No build
// tooling changes needed — this deliberately avoids depending on Vite config
// or a generated manifest file, since a mismatch there would silently never
// fire rather than loudly failing.
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes — deploys aren't that frequent; no need to poll harder

export function initAppUpdateCheck(onUpdateAvailable) {
  let baselineHtml = null;
  let notified = false;

  async function fetchShellHtml() {
    try {
      const res = await fetch('/', { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null; // offline/network hiccup — try again next interval, never false-positive on a failed fetch
    }
  }

  async function checkForUpdate() {
    if (notified) return;
    const html = await fetchShellHtml();
    if (html == null) return;
    if (baselineHtml == null) {
      baselineHtml = html; // first successful fetch just establishes what "current" looks like
      return;
    }
    if (html !== baselineHtml) {
      notified = true;
      onUpdateAvailable();
    }
  }

  checkForUpdate();
  const intervalId = setInterval(checkForUpdate, CHECK_INTERVAL_MS);
  // Also check the moment the user comes back to this tab/window — the
  // single likeliest moment to have missed a deploy while away, and worth
  // not waiting up to a full interval for.
  const onVisible = () => { if (document.visibilityState === 'visible') checkForUpdate(); };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', checkForUpdate);

  return () => {
    clearInterval(intervalId);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', checkForUpdate);
  };
}
