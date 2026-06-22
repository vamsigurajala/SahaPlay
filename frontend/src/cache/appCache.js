/**
 * In-memory TTL cache. Keys are normalized API paths (not full URLs),
 * so GCW (https://host) and RCP (http://host:3001) share the same entries.
 */
class AppCache {
  constructor() {
    this._store = new Map();
  }

  /** Store data under key with a TTL in milliseconds. */
  set(key, data, ttlMs) {
    this._store.set(key, { data, createdAt: Date.now(), ttlMs });
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
  }

  /** Remove all keys that start with prefix. */
  invalidatePrefix(prefix) {
    if (!prefix) return;
    const lowerPrefix = prefix.toLowerCase();
    for (const k of this._store.keys()) {
      if (k.toLowerCase().startsWith(lowerPrefix)) this._store.delete(k);
    }
  }

  clear() {
    this._store.clear();
  }
}

export const appCache = new AppCache();
