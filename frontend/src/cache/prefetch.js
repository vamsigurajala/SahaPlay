import { appCache } from './appCache.js';
import { API } from '../lib/api';

async function quietly(p) {
  try { await p; } catch { /* prefetch failures are non-fatal */ }
}

/** Throttle: don't run more than once per minute. */
let _lastRun = 0;
const COOLDOWN = 60_000;

/**
 * Lets a fresh login guarantee an immediate real prefetch instead of
 * possibly waiting out the previous account's cooldown window — see
 * clearUserSession() in lib/authUtils.js.
 */
export function resetPrefetchCooldown() {
  _lastRun = 0;
}

/**
 * Warm the cache in background tiers:
 *   Tier 1 — critical data (parallel)
 *   Tier 2 — pinned rooms
 *   Tier 3 — partner info + E2EE keys for recent conversations
 *   Tier 4 — chat histories for the top 5 conversations
 *
 * All fetches go through the cache interceptor, so the interceptor stores
 * each response automatically. No manual cache writes needed here.
 */
export async function prefetchAll() {
  if (Date.now() - _lastRun < COOLDOWN) return;

  const token = localStorage.getItem('watch_token');
  if (!token || token === 'tv_guest_token') return;
  if (localStorage.getItem('watch_is_guest') === 'true') return;

  _lastRun = Date.now();

  const base = API;
  const h = { Authorization: `Bearer ${token}` };

  // ── Tier 1: critical, all in parallel ──────────────────────────────────────
  await Promise.allSettled([
    quietly(fetch(`${base}/api/profile`, { headers: h })),
    quietly(fetch(`${base}/api/chats/recent`, { headers: h })),
    quietly(fetch(`${base}/api/blocks`, { headers: h })),
    quietly(fetch(`${base}/api/profile/notifications`, { headers: h })),
    quietly(fetch(`${base}/api/settings`, { headers: h })),
    quietly(fetch(`${base}/api/chat-lock/locked-chats`, { headers: h })),
    quietly(fetch(`${base}/api/follow/requests`, { headers: h })),
  ]);

  // ── Tier 2: pinned rooms ────────────────────────────────────────────────────
  try {
    const ids = JSON.parse(localStorage.getItem('pinned_rooms') || '[]');
    if (ids.length > 0) {
      await quietly(fetch(`${base}/api/rooms/info?ids=${ids.slice(0, 12).join(',')}`, { headers: h }));
    }
  } catch { /* malformed localStorage value */ }

  // ── Tier 3: partner info + public keys for recent conversations ────────────
  // Read the recent-chats list that Tier 1 just populated in the cache.
  // Cache key = normalized path (see fetchInterceptor.js cacheKeyFor logic).
  const recentData = appCache.getData('/api/chats/recent');
  const conversations = Array.isArray(recentData) ? recentData : [];
  const recent = conversations.slice(0, 10);

  await Promise.allSettled(
    recent.map(async (conv) => {
      if (!conv) return;
      if (conv.type === 'private') {
        const partner = conv.partner;
        if (!partner) return;
        await Promise.allSettled([
          quietly(fetch(`${base}/api/users/${encodeURIComponent(partner)}`, { headers: h })),
          quietly(fetch(`${base}/api/auth/public-key/${encodeURIComponent(partner)}`)),
        ]);
      } else if (conv.type === 'room' && conv.roomId) {
        await quietly(fetch(`${base}/api/rooms/${conv.roomId}/public-keys`, { headers: h }));
      }
    })
  );

  // NOTE: chat histories are intentionally not prefetched.
  // fetchHistory() replaces the entire message list atomically, so any cached
  // version would discard messages sent/received after the cache was written.
}
