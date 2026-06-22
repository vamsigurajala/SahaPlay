import { appCache } from './appCache.js';

/**
 * Rules: [pathname regex, TTL ms].
 * Ordered from most-specific to least-specific.
 */
const CACHE_RULES = [
  [/\/api\/profile\/notifications/, 45_000],
  [/\/api\/profile$/, 3 * 60_000],
  [/\/api\/settings$/, 10 * 60_000],
  [/\/api\/chats\/recent/, 45_000],
  // NOTE: /api/chats/history is intentionally NOT cached.
  // fetchHistory() replaces the entire message list, so a 90s-old cached response
  // would silently discard messages sent/received during the current session.
  [/\/api\/blocks$/, 5 * 60_000],
  [/\/api\/chat-lock\/locked-chats/, 2 * 60_000],
  [/\/api\/chat-lock\/status/, 2 * 60_000],
  [/\/api\/follow\/requests/, 60_000],
  [/\/api\/users\/[^/?]+$/, 5 * 60_000],
  [/\/api\/auth\/public-key\//, 15 * 60_000],
  [/\/api\/rooms\/info/, 5 * 60_000],
  [/\/api\/rooms\/[^/?]+\/public-keys/, 10 * 60_000],
  [/\/api\/rooms\/public$/, 5_000],
];

function getTTL(pathname) {
  for (const [re, ttl] of CACHE_RULES) {
    if (re.test(pathname)) return ttl;
  }
  return null;
}

/**
 * Derive a stable cache key from a raw URL:
 *  - Use only pathname + search (strips host/port so GCW and RCP share entries)
 *  - Remove volatile params that shouldn't affect cache identity
 */
function cacheKeyFor(rawUrl) {
  try {
    const u = new URL(rawUrl);
    // Strip time-varying params that don't affect which data is returned
    if (u.pathname.includes('/api/chats/recent')) {
      u.searchParams.delete('lastSeen');
    }
    const qs = u.searchParams.toString();
    return u.pathname + (qs ? '?' + qs : '');
  } catch {
    return rawUrl;
  }
}

let _innerFetch = null;

function revalidateInBackground(input, init, key, ttl) {
  _innerFetch(input, init)
    .then(r => {
      if (r.ok) r.clone().json().then(d => appCache.set(key, d, ttl)).catch(() => {});
    })
    .catch(() => {});
}

function invalidateDependents(urlStr) {
  let pathname = '';
  try {
    pathname = new URL(urlStr, window.location.origin).pathname;
  } catch {
    pathname = urlStr;
  }
  const lowerPath = pathname.toLowerCase();
  
  if (lowerPath.includes('/api/block/')) {
    const parts = lowerPath.split('/api/block/');
    const targetUser = parts[1];
    appCache.invalidatePrefix('/api/blocks');
    if (targetUser) {
      appCache.invalidatePrefix(`/api/users/${targetUser}`);
    }
    appCache.invalidatePrefix('/api/profile');
    appCache.invalidatePrefix('/api/chats/recent');
  }

  if (lowerPath.includes('/api/follow/')) {
    const parts = lowerPath.split('/api/follow/');
    const subpath = parts[1];
    if (subpath) {
      const targetUser = subpath.split('/').pop();
      if (targetUser) {
        appCache.invalidatePrefix(`/api/users/${targetUser}`);
      }
    }
    appCache.invalidatePrefix('/api/follow/requests');
    appCache.invalidatePrefix('/api/follow/status');
    appCache.invalidatePrefix('/api/profile');
    appCache.invalidatePrefix('/api/chats/recent');
  }

  if (lowerPath.includes('/api/settings') || lowerPath.includes('/api/profile')) {
    appCache.invalidatePrefix('/api/profile');
    const myU = localStorage.getItem('watch_username');
    if (myU) {
      appCache.invalidatePrefix(`/api/users/${myU}`);
    }
  }

  if (lowerPath.includes('/api/messages') || lowerPath.includes('/api/chats')) {
    appCache.invalidatePrefix('/api/chats/recent');
  }
}

export function installCacheInterceptor() {
  // Capture whatever window.fetch is now (may already be wrapped by the auth interceptor).
  _innerFetch = window.fetch.bind(window);

  window.fetch = async function cachedFetch(input, init) {
    const url =
      typeof input === 'string' ? input
      : input instanceof Request ? input.url
      : String(input);

    const method = ((init?.method) || 'GET').toUpperCase();
    if (method !== 'GET') {
      try {
        const pathname = new URL(url, window.location.origin).pathname;
        appCache.invalidatePrefix(pathname);
      } catch (e) {
        const key = cacheKeyFor(url);
        appCache.invalidate(key);
      }
      invalidateDependents(url);
      return _innerFetch(input, init);
    }

    let pathname;
    try { pathname = new URL(url).pathname; } catch { return _innerFetch(input, init); }

    const ttl = getTTL(pathname);
    if (ttl === null) return _innerFetch(input, init);

    const key = cacheKeyFor(url);
    const entry = appCache.get(key);

    if (entry !== null) {
      const staleness = (Date.now() - entry.createdAt) / entry.ttlMs;
      // Stale-while-revalidate: refresh in background once past 60% of TTL
      if (staleness > 0.6) {
        revalidateInBackground(input, init, key, ttl);
      }
      return new Response(JSON.stringify(entry.data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Cache miss — real fetch, store on success
    const response = await _innerFetch(input, init);
    if (response.ok) {
      response.clone().json()
        .then(data => appCache.set(key, data, ttl))
        .catch(() => {});
    }
    return response;
  };
}
