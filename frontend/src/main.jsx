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
import { initNativeCallAnswerLink, initNativeCallEndLink } from './lib/nativeCallBridge.js';

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
  // Rebroadcast the same way — CallContext.jsx (mounted globally, in every
  // mode, unlike BottomNav above) picks this up to auto-accept the matching
  // call once its own socket confirms it's still ringing.
  initNativeCallAnswerLink((data) => {
    window.dispatchEvent(new CustomEvent('native_call_answer', { detail: data }));
  });
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





