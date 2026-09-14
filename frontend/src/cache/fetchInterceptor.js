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
  // Missing from here entirely was why Room History always paid a full
  // cold network round trip while Pinned Rooms (via /api/rooms/info just
  // above) got the stale-while-revalidate speed boost for free — same
  // "instant paint from last launch, refreshed quietly in the background"
  // treatment now applies to Room History too. See the invalidateDependents
  // branch below for why creating a room still shows up immediately
  // despite this cache.
  [/\/api\/rooms\/mine/, 5 * 60_000],
  // NOTE: room public-keys is intentionally NOT cached (was 10 min). It's the
  // live list of who's currently in a room and their encryption keys — a
  // stale snapshot meant a sender could keep wrapping messages for whoever
  // was present up to 10 minutes ago, silently excluding anyone who joined
  // since, who'd then see every message from that sender as undecryptable
  // ciphertext for the rest of that window. This endpoint is cheap (reads an
  // in-memory map first) and is now called by guests too — correctness here
  // matters far more than saving one GET per room join.
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
    let key = u.pathname + (qs ? '?' + qs : '');
    // /api/users/:username's response is VIEWER-relative — followStatus,
    // isFollowingMe, isBlockedByMe all depend on who's asking, not just
    // whose profile it is. Without the viewer baked into the key, one
    // caller fetching it without auth (an anonymous-viewer's "not friends"
    // answer — see the bug this fixed in CallContext.jsx's fetchUserBrief)
    // could poison the SAME cache entry a different, correctly-authenticated
    // fetch for the exact same partner then reads back. Scoping the key to
    // the current logged-in user makes that a same-viewer cache miss instead
    // of cross-viewer data leaking between requests.
    if (u.pathname.startsWith('/api/users/')) {
      const viewer = localStorage.getItem('watch_username') || 'anon';
      key += (key.includes('?') ? '&' : '?') + '_viewer=' + viewer.toLowerCase();
    }
    return key;
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

  // A freshly created room needs to show up in Room History right away —
  // without this, the new 5-minute /api/rooms/mine cache above would keep
  // serving the pre-creation list (missing the just-created room) until
  // that TTL happened to expire on its own.
  if (lowerPath.includes('/api/rooms/create')) {
    appCache.invalidatePrefix('/api/rooms/mine');
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
      const invalidateNow = () => {
        try {
          const pathname = new URL(url, window.location.origin).pathname;
          appCache.invalidatePrefix(pathname);
        } catch (e) {
          const key = cacheKeyFor(url);
          appCache.invalidate(key);
        }
        invalidateDependents(url);
      };
      // Invalidating only here, before the mutation's own network call, left
      // a window open: a GET for the same prefix (e.g. the follow-requests
      // list's 3s poll) firing while this POST is still in flight would
      // cache-miss, fetch the server's PRE-mutation state, and re-cache it
      // with a fresh TTL — so a follow request could show "Requested" for
      // one optimistic-update frame and then silently revert to "Follow
      // Back" once that poll's stale response landed in cache. Invalidating
      // again after the mutation resolves closes that window: any cache
      // entry written during it gets busted immediately rather than living
      // out its TTL.
      invalidateNow();
      const response = await _innerFetch(input, init);
      invalidateNow();
      return response;
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

    // In-session cache missed (expired or never fetched this session), but a
    // copy persisted from a previous app launch may still exist — serve it
    // immediately as a placeholder (this is what makes a cold app open show
    // pinned rooms / avatars instantly instead of a blank state) while a
    // real fetch quietly replaces it in the background.
    const stale = appCache.getStale(key);
    if (stale !== null) {
      revalidateInBackground(input, init, key, ttl);
      return new Response(JSON.stringify(stale), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // True cache miss — real fetch, store on success
    const response = await _innerFetch(input, init);
    if (response.ok) {
      response.clone().json()
        .then(data => appCache.set(key, data, ttl))
        .catch(() => {});
    }
    return response;
  };
}
