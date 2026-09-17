import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

/**
 * Resolves the CURRENT public key for a private-DM recipient, live-server-
 * first. Room.jsx's DM send paths used to check dbPublicKeys.current (an
 * in-memory ref, populated once and never proactively invalidated) and the
 * room's userList snapshot BEFORE ever asking the server — so once a
 * recipient's key was cached, a later key rotation on their end (e.g. a
 * password reset performed without a recovery key — see the E2EE
 * identity-continuity investigation) went unnoticed indefinitely: every
 * message kept encrypting against the recipient's OLD, now-unrecoverable
 * key, producing ciphertext they could never decrypt again — not a slow
 * message, a permanently broken one.
 *
 * This flips that priority: the live server lookup always runs first
 * (matching ensureFreshGroupRecipients' guarantee for group chat, and
 * GlobalChatWidget's own DM send path). The in-memory/userList/localStorage
 * caches are consulted ONLY when the live lookup itself fails to even run
 * (a genuine network error) — never as a shortcut that skips it, and never
 * when the server successfully answers "this user has no key at all" (that
 * answer is authoritative and must not be overridden by a stale cache).
 *
 * On a successful live answer, all caches are synced to match it — including
 * being CLEARED when the server confirms no key exists, so a stale entry
 * can never outlive the rotation that invalidated it.
 *
 * @param {object} opts
 * @param {string} opts.targetUsername - original-case username (the API tries this, then a lowercase fallback on 404)
 * @param {string} opts.apiBase - e.g. SOCKET_SERVER_URL / API
 * @param {Record<string, Uint8Array>} opts.memoryCache - dbPublicKeys.current — read and mutated in place
 * @param {Array<{username?: string, publicKey?: string}>} [opts.userList] - last-resort fallback source, network-failure only
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {(k: string) => string|null} [opts.getLocal]
 * @param {(k: string, v: string) => void} [opts.setLocal]
 * @param {(k: string) => void} [opts.removeLocal]
 * @returns {Promise<{ publicKey: string|null, networkFailure: boolean }>}
 *   publicKey is a base64 string ready for encryptDM, or null when no key
 *   could be established at all — callers must fail the send explicitly in
 *   that case, never invent or reuse an unrelated key.
 */
export async function resolveDmRecipientPublicKey({
  targetUsername,
  apiBase,
  memoryCache,
  userList = [],
  fetchImpl = (...args) => fetch(...args),
  getLocal = (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  setLocal = (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  removeLocal = (k) => { try { localStorage.removeItem(k); } catch {} },
}) {
  const targetLower = targetUsername.toLowerCase();
  let publicKey = null;
  let networkFailure = false;

  try {
    // no-store: this answer decides what a message gets encrypted against —
    // it must never be served from an intermediate HTTP cache (browser or
    // otherwise) after the recipient rotates their identity.
    const res = await fetchImpl(`${apiBase}/api/auth/public-key/${encodeURIComponent(targetUsername)}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      publicKey = data.publicKey || null;
    } else if (res.status === 404) {
      if (targetLower !== targetUsername) {
        const res2 = await fetchImpl(`${apiBase}/api/auth/public-key/${encodeURIComponent(targetLower)}`, { cache: 'no-store' });
        if (res2.ok) {
          const data2 = await res2.json();
          publicKey = data2.publicKey || null;
        } else if (res2.status !== 404) {
          // A real error on the retry (500/502/503/etc.) — not confirmation
          // the user doesn't exist. See the comment below on why this must
          // not be treated the same as an authoritative "no key".
          networkFailure = true;
        }
      }
      // else: 404 on the lowercase form too (or already lowercase) is a
      // genuine "no such user" — authoritative, not a network failure.
    } else {
      // Any other non-ok status (500, 502, 503, a proxy timeout, etc.) is
      // the server itself failing to answer — fetch() doesn't throw for
      // these, it resolves normally with res.ok === false, so this branch
      // is the ONLY place that catches them. Confirmed live: a backend
      // cold-start/restart returned 500/502/503 across several unrelated
      // endpoints at once — treating that the same as "this account has no
      // key" would silently wipe a perfectly good cached key over a
      // transient backend hiccup, then encrypt against nothing at all.
      networkFailure = true;
    }

    if (publicKey) {
      setLocal(`wt_pk_${targetLower}`, publicKey);
      try { memoryCache[targetLower] = decodeBase64(publicKey); } catch {}
    } else if (!networkFailure) {
      // Authoritative "no key" — never leave a stale rotation-era key
      // sitting in a cache that a future network-failure fallback (below)
      // could pick back up.
      removeLocal(`wt_pk_${targetLower}`);
      delete memoryCache[targetLower];
    }
  } catch (e) {
    networkFailure = true;
  }

  if (!publicKey && networkFailure) {
    // The live check itself couldn't run — fall back to the best
    // still-known value rather than blocking every send the instant the
    // network hiccups. This is an explicit, narrow fallback for a specific
    // failure mode ("couldn't ask"), not the old "cache always wins"
    // behavior: it never runs when the server successfully answered.
    const cached = memoryCache[targetLower];
    if (cached && cached.length === 32) {
      publicKey = encodeBase64(cached);
    } else {
      const fromList = userList.find(u => u.username?.toLowerCase() === targetLower)?.publicKey;
      if (fromList) {
        publicKey = fromList;
      } else {
        publicKey = getLocal(`wt_pk_${targetLower}`) || null;
      }
    }
  }

  return { publicKey, networkFailure };
}
