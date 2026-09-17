import { describe, test, expect, vi } from 'vitest';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import { resolveDmRecipientPublicKey } from './dmKeyResolution.js';
import { encryptDM, decryptDM } from './crypto.js';

// Room.jsx's private-DM send paths used to check dbPublicKeys.current (an
// in-memory cache, populated once and never proactively invalidated) BEFORE
// ever asking the server — so once a recipient's key was cached, a later key
// rotation on their end (e.g. a password reset performed without a recovery
// key) went unnoticed indefinitely: every message kept encrypting against
// the recipient's OLD, now-unrecoverable key. These tests exercise the real
// replacement function (not a re-implementation).

function makeMemoryCache(initial = {}) {
  return { ...initial };
}

describe('resolveDmRecipientPublicKey', () => {
  test('TEST 3/4/5 core mechanic: a live server answer always wins over a stale in-memory cache entry', async () => {
    const oldKp = nacl.box.keyPair();
    const newKp = nacl.box.keyPair();
    const memoryCache = makeMemoryCache({ bob: oldKp.publicKey }); // stale — bob rotated since this was cached
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ publicKey: encodeBase64(newKp.publicKey) }),
    }));

    const { publicKey, networkFailure } = await resolveDmRecipientPublicKey({
      targetUsername: 'bob',
      apiBase: 'https://api.test',
      memoryCache,
      fetchImpl,
      getLocal: () => null,
      setLocal: () => {},
      removeLocal: () => {},
    });

    expect(networkFailure).toBe(false);
    expect(publicKey).toBe(encodeBase64(newKp.publicKey));
    // The stale cache entry is corrected to match the authoritative answer,
    // not left stale for the next call.
    expect(encodeBase64(memoryCache.bob)).toBe(encodeBase64(newKp.publicKey));
  });

  test('TEST 3/4/5 end-to-end: B encrypts against A\'s freshly-rotated key (not the stale cache), and A can decrypt it', async () => {
    const aOld = nacl.box.keyPair(); // A's key before the reset
    const aNew = nacl.box.keyPair(); // A's key after the reset + new passphrase setup
    const bKp = nacl.box.keyPair();

    // B's Room.jsx session cached A's OLD key from before the reset.
    const bMemoryCache = makeMemoryCache({ alice: aOld.publicKey });
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ publicKey: encodeBase64(aNew.publicKey) }),
    }));

    const { publicKey: resolvedForAlice } = await resolveDmRecipientPublicKey({
      targetUsername: 'alice',
      apiBase: 'https://api.test',
      memoryCache: bMemoryCache,
      fetchImpl,
      getLocal: () => null,
      setLocal: () => {},
      removeLocal: () => {},
    });

    const enc = encryptDM('hello after reset', resolvedForAlice, encodeBase64(bKp.publicKey));
    // A decrypts with the NEW secret key (the one actually established by
    // the passphrase-setup flow) — must succeed.
    const plainWithNewKey = decryptDM(enc.ciphertext, enc.nonce, enc.ephemeralPublicKey, encodeBase64(aNew.secretKey));
    expect(plainWithNewKey).toBe('hello after reset');
    // The OLD (now-discarded) secret key must NOT be able to decrypt it —
    // confirms the message was genuinely encrypted against the new key, not
    // the stale one.
    const plainWithOldKey = decryptDM(enc.ciphertext, enc.nonce, enc.ephemeralPublicKey, encodeBase64(aOld.secretKey));
    expect(plainWithOldKey).toBeNull();
  });

  test('a successful "no key at all" answer is authoritative — clears a stale cache entry rather than leaving it usable', async () => {
    const staleKp = nacl.box.keyPair();
    const memoryCache = makeMemoryCache({ bob: staleKp.publicKey });
    const removedKeys = [];
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ publicKey: null }) }));

    const { publicKey } = await resolveDmRecipientPublicKey({
      targetUsername: 'bob',
      apiBase: 'https://api.test',
      memoryCache,
      fetchImpl,
      getLocal: () => null,
      setLocal: () => {},
      removeLocal: (k) => removedKeys.push(k),
    });

    expect(publicKey).toBeNull();
    expect(memoryCache.bob).toBeUndefined();
    expect(removedKeys).toContain('wt_pk_bob');
  });

  test('404 on original-case lookup retries the lowercase fallback', async () => {
    const kp = nacl.box.keyPair();
    const calls = [];
    const fetchImpl = vi.fn(async (url) => {
      calls.push(url);
      if (url.includes('Bob')) return { ok: false, status: 404 };
      return { ok: true, json: async () => ({ publicKey: encodeBase64(kp.publicKey) }) };
    });

    const { publicKey } = await resolveDmRecipientPublicKey({
      targetUsername: 'Bob',
      apiBase: 'https://api.test',
      memoryCache: {},
      fetchImpl,
      getLocal: () => null,
      setLocal: () => {},
      removeLocal: () => {},
    });

    expect(publicKey).toBe(encodeBase64(kp.publicKey));
    expect(calls.length).toBe(2);
  });

  test('a 500/502/503 server error is treated as a network failure, not an authoritative "no key" — a backend cold-start/restart must never wipe a good cached key', async () => {
    // fetch() does NOT throw for a 5xx response — it resolves normally with
    // res.ok === false. Confirmed live: a Render backend cold-start/restart
    // returned 500/502/503 across several unrelated endpoints at once; the
    // public-key lookup landing in that same window must fall back to the
    // last-known-good key exactly like a genuine network failure, never be
    // read as "the server confirms this user has no key at all".
    const cachedKp = nacl.box.keyPair();
    const memoryCache = { bob: cachedKp.publicKey };
    const removedKeys = [];
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503 }));

    const { publicKey, networkFailure } = await resolveDmRecipientPublicKey({
      targetUsername: 'bob',
      apiBase: 'https://api.test',
      memoryCache,
      fetchImpl,
      getLocal: () => null,
      setLocal: () => {},
      removeLocal: (k) => removedKeys.push(k),
    });

    expect(networkFailure).toBe(true);
    expect(publicKey).toBe(encodeBase64(cachedKp.publicKey));
    // The critical assertion: the cache must survive a 5xx, not be cleared.
    expect(memoryCache.bob).toBe(cachedKp.publicKey);
    expect(removedKeys).toEqual([]);
  });

  test('a genuine 404 (user does not exist on either case) is still authoritative "no key" — clears a stale cache', async () => {
    const staleKp = nacl.box.keyPair();
    const memoryCache = { bob: staleKp.publicKey };
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 404 }));

    const { publicKey, networkFailure } = await resolveDmRecipientPublicKey({
      targetUsername: 'Bob',
      apiBase: 'https://api.test',
      memoryCache,
      fetchImpl,
      getLocal: () => null,
      setLocal: () => {},
      removeLocal: () => {},
    });

    expect(networkFailure).toBe(false);
    expect(publicKey).toBeNull();
    expect(memoryCache.bob).toBeUndefined();
  });

  test('TEST 9: network failure with a known cached key falls back to it rather than blocking the send ("do NOT overwrite a known key")', async () => {
    const cachedKp = nacl.box.keyPair();
    const memoryCache = makeMemoryCache({ bob: cachedKp.publicKey });
    const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch'); });

    const { publicKey, networkFailure } = await resolveDmRecipientPublicKey({
      targetUsername: 'bob',
      apiBase: 'https://api.test',
      memoryCache,
      fetchImpl,
      getLocal: () => null,
      setLocal: () => {},
      removeLocal: () => {},
    });

    expect(networkFailure).toBe(true);
    expect(publicKey).toBe(encodeBase64(cachedKp.publicKey));
  });

  test('TEST 9: network failure with NO known key anywhere returns null — caller must fail safely, never invent a key', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch'); });

    const { publicKey, networkFailure } = await resolveDmRecipientPublicKey({
      targetUsername: 'bob',
      apiBase: 'https://api.test',
      memoryCache: {},
      userList: [],
      fetchImpl,
      getLocal: () => null,
      setLocal: () => {},
      removeLocal: () => {},
    });

    expect(networkFailure).toBe(true);
    expect(publicKey).toBeNull();
  });

  test('network failure falls back to userList, then localStorage, in that order, only when the memory cache has nothing', async () => {
    const listKp = nacl.box.keyPair();
    const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch'); });

    const { publicKey: fromList } = await resolveDmRecipientPublicKey({
      targetUsername: 'bob',
      apiBase: 'https://api.test',
      memoryCache: {},
      userList: [{ username: 'bob', publicKey: encodeBase64(listKp.publicKey) }],
      fetchImpl,
      getLocal: () => null,
      setLocal: () => {},
      removeLocal: () => {},
    });
    expect(fromList).toBe(encodeBase64(listKp.publicKey));

    const localKp = nacl.box.keyPair();
    const { publicKey: fromLocal } = await resolveDmRecipientPublicKey({
      targetUsername: 'bob',
      apiBase: 'https://api.test',
      memoryCache: {},
      userList: [],
      fetchImpl,
      getLocal: () => encodeBase64(localKp.publicKey),
      setLocal: () => {},
      removeLocal: () => {},
    });
    expect(fromLocal).toBe(encodeBase64(localKp.publicKey));
  });
});
