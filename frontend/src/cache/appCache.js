// Persisted across app restarts (localStorage) so a cold app launch — the
// app being killed and reopened, a hard refresh, a fresh PWA/TWA launch —
// has something to paint immediately (pinned-room thumbnails, avatars,
// profile) instead of a blank state until the first network round trip
// completes, which on a cold Render backend can take many seconds. This is
// a *placeholder* layer only: getStale() never substitutes for a real
// fetch, it just gives components something correct-as-of-last-visit to
// show while that fetch happens in the background (see fetchInterceptor.js).
const PERSIST_KEY = 'sp_app_cache_v1';
// Ceiling on how old a persisted entry is still worth showing as a
// placeholder. Well beyond any individual rule's real TTL (those govern
// in-session freshness, not this) — just long enough to cover "opened the
// app after a few days away" without resurrecting genuinely ancient data.
const MAX_STALE_MS = 24 * 60 * 60 * 1000;

/**
 * In-memory TTL cache. Keys are normalized API paths (not full URLs),
 * so GCW (https://host) and RCP (http://host:3001) share the same entries.
 */
class AppCache {
  constructor() {
    this._store = new Map();
    this._persistTimer = null;
    this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(PERSIST_KEY);
      if (!raw) return;
      const entries = JSON.parse(raw);
      if (!Array.isArray(entries)) return;
      const now = Date.now();
      for (const [key, entry] of entries) {
        if (!entry || now - entry.createdAt > MAX_STALE_MS) continue;
        this._store.set(key, entry);
      }
    } catch { /* corrupt/missing — start empty, no different from before this existed */ }
  }

  _schedulePersist() {
    if (this._persistTimer) return;
    // Debounced — prefetchAll() fires several set()s back to back; no need
    // to serialize the whole store to localStorage after each one.
    this._persistTimer = setTimeout(() => {
      this._persistTimer = null;
      try {
        localStorage.setItem(PERSIST_KEY, JSON.stringify([...this._store.entries()]));
      } catch { /* quota exceeded or unavailable — persistence is best-effort */ }
    }, 300);
  }

  /** Store data under key with a TTL in milliseconds. */
  set(key, data, ttlMs) {
    this._store.set(key, { data, createdAt: Date.now(), ttlMs });
    this._schedulePersist();
  }

  /**
   * Returns last-known data for key regardless of TTL staleness (only the
   * much longer MAX_STALE_MS ceiling applies), or null if never cached or
   * too old to be a reasonable placeholder. Does not evict — get()'s own
   * TTL-based eviction is unaffected and remains the source of truth for
   * in-session freshness decisions.
   */
  getStale(key) {
    const e = this._store.get(key);
    if (!e) return null;
    if (Date.now() - e.createdAt > MAX_STALE_MS) return null;
    return e.data;
  }

  /**
   * Returns the cache entry {data, createdAt, ttlMs} if fresh, or null if
   * missing/expired. Expired entries are evicted on access.
   */
  get(key) {
    const e = this._store.get(key);
    if (!e) return null;
    if (Date.now() > e.createdAt + e.ttlMs) {
      this._store.delete(key);
      return null;
    }
    return e;
  }

  /** Returns just the cached data, or null. */
  getData(key) {
    return this.get(key)?.data ?? null;
  }

  /** Fraction of TTL elapsed (0 = just stored, 1 = expired). null if not cached. */
  staleness(key) {
    const e = this._store.get(key);
    if (!e) return null;
    return Math.min(1, (Date.now() - e.createdAt) / e.ttlMs);
  }

  invalidate(key) {
    if (!key) return;
    const lowerKey = key.toLowerCase();
    for (const k of this._store.keys()) {
      if (k.toLowerCase() === lowerKey) this._store.delete(k);
    }
    this._schedulePersist();
  }

  /** Remove all keys that start with prefix. */
  invalidatePrefix(prefix) {
    if (!prefix) return;
    const lowerPrefix = prefix.toLowerCase();
    for (const k of this._store.keys()) {
      if (k.toLowerCase().startsWith(lowerPrefix)) this._store.delete(k);
    }
    this._schedulePersist();
  }

  clear() {
    this._store.clear();
    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
      this._persistTimer = null;
    }
    try { localStorage.removeItem(PERSIST_KEY); } catch { /* best-effort */ }
  }
}

export const appCache = new AppCache();
