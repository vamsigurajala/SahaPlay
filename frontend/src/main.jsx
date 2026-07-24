import { StrictMode } from 'react'
import { clearUserSession } from './lib/authUtils.js';
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import './i18n'
import App from './App.jsx'
import { installCacheInterceptor } from './cache/fetchInterceptor.js';
import { prefetchAll } from './cache/prefetch.js';
import { API } from './lib/api.js';

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

// MutationObserver to automatically find and remove the evaluation/demo-only banner if injected by the environment proxy
if (typeof window !== 'undefined') {
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





