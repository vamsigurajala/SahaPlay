import { StrictMode } from 'react'
import { clearUserSession } from './lib/authUtils.js';
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
// Self-hosted (not Google Fonts CDN) — a cross-origin font stylesheet is one
// more request that can fail or stall on a flaky connection, which silently
// drops the whole page back to a generic system font. Bundling the font
// files through Vite means they ship with everything else and work offline
// in the Tauri desktop build too.
import '@fontsource/outfit/300.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
// Single weight — used only for the stylish "SahaPlay" script wordmark.
import '@fontsource/pacifico/400.css';
import 'flag-icons/css/flag-icons.min.css'
import './index.css'
import './i18n'
import App from './App.jsx'
import { installCacheInterceptor } from './cache/fetchInterceptor.js';
import { prefetchAll } from './cache/prefetch.js';
import { API } from './lib/api.js';
import { isStandalonePWA, isCapacitorApp } from './lib/platform.js';
import { initNativeBackButton, initNativeStatusBarInset, initNativeResumeBridge } from './lib/nativeShell.js';
import { initNativeGoogleAuthCallback } from './lib/nativeGoogleAuth.js';
import { initNativePush } from './lib/nativePush.js';
import { initNativeCallEndLink } from './lib/nativeCallBridge.js';
import { initNativeChatOpenLink } from './lib/nativeChatOpenBridge.js';

// Must run before any back gesture happens — Capacitor's Android bridge
// exits the app on every back press by default unless a 'backButton'
// listener is registered (see nativeShell.js for why).
if (isCapacitorApp()) {
  initNativeBackButton();
  initNativeStatusBarInset();
  initNativeResumeBridge();
  // Registered once here (not per-page) since the deep link can land while
  // either Login or Signup triggered it — rebroadcast as a plain DOM event
  // so whichever page is mounted can pick it up, same bridging pattern
  // initNativeResumeBridge already uses for the 'focus' event.
  initNativeGoogleAuthCallback((idToken) => {
    window.dispatchEvent(new CustomEvent('native-google-auth', { detail: { idToken } }));
  });
  // Rebroadcast the same way — BottomNav.jsx (the only thing rendered in
  // standalone mode, which is the only mode push notifications fire in)
  // picks this up to open the specific chat the notification was for.
  initNativePush((data) => {
    window.dispatchEvent(new CustomEvent('open_chat_from_notification', { detail: data }));
  });
  // Same rebroadcast, for a message notification tapped via the
  // sahaplay://chat-open deep link (see nativeChatOpenBridge.js's own
  // comment for why message notifications now go through this path instead
  // of Capacitor's own pushNotificationActionPerformed).
  initNativeChatOpenLink((data) => {
    window.dispatchEvent(new CustomEvent('open_chat_from_notification', { detail: data }));
  });
  // Note: there's deliberately no JS handling for the sahaplay://call-answer
  // deep link anymore (see CallContext.jsx's own comment) — firing that
  // Intent already opens/foregrounds the app on its own; the app no longer
  // needs to do anything special once it lands, the user just answers via
  // the normal GlobalCallOverlay Answer button once it's up.
  // Same rebroadcast pattern — the ongoing-call notification's End Call
  // button (see SahaplayCallService.java). CallContext.jsx picks this up
  // and calls its normal endCall().
  initNativeCallEndLink(() => {
    window.dispatchEvent(new Event('native_call_end'));
  });
}

// Standalone-mode is session-stable (a launch-time property, not something
// that flips mid-session), so this is set once here rather than recomputed
// on every render — index.css keys its PWA-only font override off this class.
if (isStandalonePWA()) {
  document.documentElement.classList.add('pwa-standalone');
  // Regular mobile web keeps the browser's normal pinch-zoom (an accessibility
  // feature users may rely on), but an installed app pinch-zooming its own
  // chrome/UI reads as broken rather than intentional — native apps (and
  // Instagram et al) don't let you zoom the interface itself. Patched here via
  // JS rather than baked into index.html's static viewport meta so the two
  // contexts can behave differently.
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (viewportMeta) {
    viewportMeta.setAttribute('content', `${viewportMeta.getAttribute('content')}, maximum-scale=1, user-scalable=no`);
  }
} else {
  // viewport-fit=cover (in index.html's static meta, since that one tag has
  // to serve every launch path) exists so the installed PWA/TWA/native app
  // can extend content under the display cutout and place its own UI below
  // the real status bar icons (time/wifi/signal) — see nativeShell.js's
  // --sp-status-bar-inset for the native side of that. A plain mobile
  // browser tab has no cutout to extend under (it already sits below
  // Chrome's own address bar), but Chrome still reserves the same cutout-
  // sized safe area for it — leaving a theme-colored gap between the
  // address bar and the page's own top-of-screen UI (nav drawer, chat
  // panel header) with nothing there to fill it. Stripped here, at runtime,
  // for the browser case only — same "patch via JS, not the static meta"
  // approach as the standalone-only maximum-scale patch above.
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (viewportMeta) {
    viewportMeta.setAttribute('content', viewportMeta.getAttribute('content').replace(/,?\s*viewport-fit=cover/, ''));
  }
}

// Render's free tier spins the backend down when idle and takes ~30-60s to
// cold-start on the first request. prefetchAll() below only pings the backend
// for already-logged-in users, so a logged-out visitor landing on /login was
// getting zero head start — the backend only started waking up the moment
// they clicked "Log In", and the request could then get cut off by that
// form's own abort timeout before the cold start finished, making the first
// attempt fail and an immediate retry (backend now warm) succeed instantly.
// Firing this unconditionally, as early as possible, gives every page load a
// multi-second warm-up head start before any user-initiated request happens.
fetch(`${API}/health`).catch(() => {});

// On Android, the OS can kill this app's whole process while it's
// backgrounded (a device battery manager decision — not a bug in how this
// app is built) — the next launch is then a genuine cold start: this whole
// module re-evaluates, at the default `/` route, with no memory of what was
// open before. Room.jsx writes/refreshes a "still actively in this room"
// marker (see its heartbeat effect) while mounted, and clears it on a real
// user-initiated leave; if that marker is fresh, this was very likely a
// kill-and-relaunch rather than a deliberate return to the home screen, so
// rewrite the URL to that room before the router ever mounts. This can't
// restore the live call/video state itself (that's genuinely gone with the
// old process) — it just avoids dumping the user back at the home screen
// when they were mid-conversation a moment ago.
if (isCapacitorApp() && window.location.pathname === '/') {
  try {
    const token = localStorage.getItem('watch_token');
    const isGuest = localStorage.getItem('watch_is_guest') === 'true';
    const isAuthed = (!!token && token !== 'null' && token !== 'undefined') || isGuest;
    const raw = isAuthed ? localStorage.getItem('sp_last_active_room') : null;
    if (raw) {
      const { roomId, ts } = JSON.parse(raw);
      const RESUME_WINDOW_MS = 15 * 60 * 1000;
      if (roomId && ts && Date.now() - ts < RESUME_WINDOW_MS) {
        // replaceState alone would leave the room as the ONLY entry in the
        // WebView's back-navigation history — initNativeBackButton's
        // canGoBack check (see nativeShell.js) would then be false on the
        // very first swipe-back/hardware-back, and it falls through to
        // app.exitApp() instead of navigating to Home, closing the whole
        // app. Replacing with Home first, then pushing the room on top,
        // gives back navigation a real Home entry to land on — same as if
        // the user had actually clicked into the room from Home normally.
        window.history.replaceState(null, '', '/');
        window.history.pushState(null, '', `/room/${encodeURIComponent(roomId)}`);
      }
    }
  } catch { /* malformed marker — just stay on the default route */ }
}

// Registers a minimal pass-through service worker (see public/sw.js) — this
// exists purely to satisfy Chrome's PWA installability requirement for the
// Android TWA wrapper, not to add offline support or caching.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: false
    })
  ],
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1
})

// Global Fetch Interceptor to elegantly handle expired/invalid JWT tokens app-wide
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (response.status === 401) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    const token = localStorage.getItem('watch_token');

    // Ignore /api/chat-lock/ and TV guest sessions
    if (!url.includes('/api/chat-lock/') && token !== 'tv_guest_token' && localStorage.getItem('watch_is_guest') !== 'true') {
      if (token) {
        // A single 401 can be a transient hiccup rather than a genuinely
        // invalid/expired token — most visibly right after a fresh login,
        // when prefetchAll() fires several parallel authenticated requests
        // against a backend that (on Render's free tier) can still be mid
        // cold-start, spuriously 401ing before its auth middleware/DB pool
        // is fully warm. That was evicting a user's brand-new, perfectly
        // valid session and bouncing them straight back to /login. Re-verify
        // with one retry after a short delay before treating it as real —
        // an actually-expired token will still 401 on retry, so this only
        // adds a grace window rather than weakening real auth enforcement.
        await new Promise(r => setTimeout(r, 1500));
        if (localStorage.getItem('watch_token') !== token) return response; // already handled by a concurrent 401
        const retryResponse = await originalFetch(...args);
        if (retryResponse.status === 401) {
          clearUserSession();
          window.location.href = '/login';
        }
      }
    }
  }
  return response;
};

// Install cache layer on top of the auth interceptor (stale-while-revalidate for all GET API calls)
installCacheInterceptor();

// Prefetch on startup (covers returning users who are already logged in)
prefetchAll();

// Re-run prefetch on every client-side navigation so fresh logins are covered.
// prefetchAll() has a 60s cooldown so rapid navigations are no-ops.
const _origPush = history.pushState.bind(history);
history.pushState = (...a) => { _origPush(...a); prefetchAll(); };
window.addEventListener('popstate', () => prefetchAll());

window.addEventListener('unhandledrejection', (event) => {
  console.error('[UNHANDLED REJECTION]', event.reason);
});

// MutationObserver to automatically find and remove the evaluation/demo-only banner if injected by the environment proxy.
// Skipped entirely in the native app: no such proxy/banner ever exists in a
// real installed APK, so this bought nothing there while still walking every
// text node in the whole document on every single DOM mutation — including
// the one React makes on every keystroke in a controlled input, on every
// page (chat, search, even the login form), which is what made typing feel
// laggy everywhere rather than in one specific heavy component.
if (typeof window !== 'undefined' && !isCapacitorApp()) {
  const removeEvaluationBanner = () => {
    const walker = document.createTreeWalker(
      document.body || document.documentElement,
      NodeFilter.SHOW_TEXT,
      null
    );
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.includes('demo-only environment is provided for evaluation')) {
        let parent = node.parentElement;
        while (parent && parent !== document.body && parent.tagName !== 'HTML') {
          // Check if parent looks like the wrapper banner (usually has absolute/fixed positioning or banner classes)
          if (parent.style.position === 'fixed' || parent.style.position === 'absolute' || parent.tagName === 'DIV') {
            parent.style.display = 'none';
            parent.style.opacity = '0';
            parent.style.pointerEvents = 'none';
            parent.remove();
            break;
          }
          parent = parent.parentElement;
        }
      }
    }
  };
  const bannerObserver = new MutationObserver(removeEvaluationBanner);
  bannerObserver.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('DOMContentLoaded', removeEvaluationBanner);
}

createRoot(document.getElementById('root')).render(
  <App />
)





