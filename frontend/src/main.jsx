import { StrictMode } from 'react'
import { clearUserSession } from './lib/authUtils.js';
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'
import { installCacheInterceptor } from './cache/fetchInterceptor.js';
import { prefetchAll } from './cache/prefetch.js';

// Global Fetch Interceptor to elegantly handle expired/invalid JWT tokens app-wide
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (response.status === 401 || response.status === 403) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    const token = localStorage.getItem('watch_token');

    // Ignore /api/chat-lock/ and TV guest sessions
    if (!url.includes('/api/chat-lock/') && token !== 'tv_guest_token' && localStorage.getItem('watch_is_guest') !== 'true') {
      if (token) {
        clearUserSession();

        window.location.href = '/login';
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

createRoot(document.getElementById('root')).render(
  <App />
)





