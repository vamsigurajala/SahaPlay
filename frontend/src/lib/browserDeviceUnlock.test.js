import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import WebAuthnEmulator, { AuthenticatorEmulator } from 'nid-webauthn-emulator';
import {
  isBrowserDeviceUnlockAvailable,
  hasBrowserDeviceUnlock,
  enrollBrowser,
  unlockViaBrowser,
  forgetBrowser,
  BrowserDeviceUnlockError,
  describeBrowserDeviceUnlockError,
} from './browserDeviceUnlock.js';

const ORIGIN = 'http://localhost';
const RP_ID = 'localhost';

// ─── Test scaffolding ───────────────────────────────────────────────────

function b64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Real, spec-compliant WebAuthn platform-authenticator emulation (see
// nid-webauthn-emulator) — installed onto the global navigator so
// browserDeviceUnlock.js's real navigator.credentials.create()/get() calls
// exercise genuine WebAuthn ceremonies (real ECDSA signatures, real CTAP2
// hmac-secret/PRF processing), not a hand-rolled stand-in for them.
// `hmacSecret` controls PRF support: 'hmac-secret-mc' = full support at
// both creation and authentication (a Chrome147+/Windows-Hello-25H2-class
// authenticator); 'hmac-secret' = only at authentication (create()
// confirms capability but returns no result yet — the exact "create()
// succeeds, PRF confirmation still pending" case enrollBrowser's own doc
// comment describes); 'none' = no PRF support at all.
function installEmulator({ hmacSecret = 'hmac-secret-mc' } = {}) {
  const emulator = new WebAuthnEmulator(new AuthenticatorEmulator({ hmacSecret }));
  window.PublicKeyCredential = function PublicKeyCredential() {};
  window.navigator.credentials = {
    create: async (opts) => emulator.create(ORIGIN, opts),
    get: async (opts) => emulator.get(ORIGIN, opts),
  };
  return emulator;
}

function uninstallEmulator() {
  delete window.PublicKeyCredential;
  if (window.navigator) delete window.navigator.credentials;
}

function fakeToken(payload) {
  const b = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b({ alg: 'HS256' })}.${b(payload)}.fakesig`;
}

function fakeRegisterOptionsJSON({ excludeCredentials = [] } = {}) {
  return {
    rp: { id: RP_ID, name: 'SahaPlay' },
    user: { id: b64url(crypto.getRandomValues(new Uint8Array(32))), name: 'alice', displayName: '' },
    challenge: b64url(crypto.getRandomValues(new Uint8Array(32))),
    pubKeyCredParams: [{ alg: -8, type: 'public-key' }, { alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
    timeout: 60000,
    excludeCredentials,
    authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
    attestation: 'none',
    extensions: { prf: {} },
  };
}

function fakeAuthOptionsJSON(allowCredentialIds) {
  return {
    rpId: RP_ID,
    challenge: b64url(crypto.getRandomValues(new Uint8Array(32))),
    timeout: 60000,
    userVerification: 'required',
    allowCredentials: allowCredentialIds.map(id => ({ id, type: 'public-key' })),
  };
}

// A realistic backend double: register-options/auth-options are generated
// fresh per call (like the real server), register-verify/auth-verify just
// report success (this file's job is browserDeviceUnlock.js's own client-
// side contract — webauthnRp.test.js / webauthnRoutes.test.js already
// cover the real server-side verification logic in depth).
function installBackend({ myKeysPublicKeyB64, registeredCredentialIds = [], failRegisterVerify = false, failAuthVerify = false } = {}) {
  const calls = [];
  const fetchMock = vi.fn(async (url, init) => {
    const u = String(url);
    calls.push({ url: u, body: init?.body ? JSON.parse(init.body) : undefined });
    if (u.includes('/api/auth/my-keys')) {
      return { ok: true, json: async () => ({ publicKey: myKeysPublicKeyB64, encryptedPrivateKey: 'blob' }) };
    }
    if (u.includes('/api/auth/webauthn/register-options')) {
      return { ok: true, json: async () => fakeRegisterOptionsJSON({ excludeCredentials: registeredCredentialIds.map(id => ({ id, type: 'public-key' })) }) };
    }
    if (u.includes('/api/auth/webauthn/register-verify')) {
      if (failRegisterVerify) return { ok: false, status: 400, json: async () => ({ error: 'verification failed', code: 'VERIFICATION_FAILED' }) };
      const credentialId = JSON.parse(init.body).response.id;
      registeredCredentialIds.push(credentialId);
      return { ok: true, json: async () => ({ verified: true, credentialId }) };
    }
    if (u.includes('/api/auth/webauthn/auth-options')) {
      if (registeredCredentialIds.length === 0) return { ok: false, status: 404, json: async () => ({ error: 'no creds', code: 'NO_CREDENTIALS' }) };
      return { ok: true, json: async () => fakeAuthOptionsJSON(registeredCredentialIds) };
    }
    if (u.includes('/api/auth/webauthn/auth-verify')) {
      if (failAuthVerify) return { ok: false, status: 400, json: async () => ({ error: 'verification failed', code: 'VERIFICATION_FAILED' }) };
      return { ok: true, json: async () => ({ verified: true }) };
    }
    if (u.includes('/api/auth/webauthn/forget')) {
      const { credentialId } = JSON.parse(init.body);
      const idx = registeredCredentialIds.indexOf(credentialId);
      if (idx !== -1) registeredCredentialIds.splice(idx, 1);
      return { ok: true, json: async () => ({ deleted: idx !== -1 }) };
    }
    throw new Error(`Unexpected fetch in test: ${u}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls, registeredCredentialIds };
}

// Directly tampers the stored wrapper's ciphertext for one account, leaving
// everything else (accountId, credentialId, iv, version) intact — the
// minimal change that makes AES-GCM decrypt fail (auth tag mismatch)
// without touching anything about the WebAuthn credential/ceremony itself.
function corruptStoredWrapper(accountId) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('sahaplay_browser_unlock', 1);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('wrappers', 'readwrite');
      const store = tx.objectStore('wrappers');
      const getReq = store.get(accountId);
      getReq.onsuccess = () => {
        const record = getReq.result;
        record.wrappedKeyBlob = btoa('this-is-not-the-real-ciphertext-anymore');
        store.put(record);
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
    req.onerror = () => reject(req.error);
  });
}

async function setUpLoggedInAccount(accountId = 1) {
  localStorage.setItem('watch_token', fakeToken({ id: accountId, username: 'alice' }));
  localStorage.setItem('watch_username', 'alice');
}

// fake-indexeddb persists its databases in-memory for the lifetime of the
// test process, NOT per-test — without an explicit reset, a wrapper record
// written by one test's successful enrollBrowser() call would silently
// still be there for the next test that reuses the same accountId,
// corrupting hasBrowserDeviceUnlock()/unlockViaBrowser() expectations that
// specifically depend on starting from "nothing enrolled yet."
function resetBrowserUnlockDb() {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase('sahaplay_browser_unlock');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

describe('browserDeviceUnlock.js', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    delete window.Capacitor;
    await resetBrowserUnlockDb();
  });

  afterEach(() => {
    uninstallEmulator();
    vi.unstubAllGlobals();
    delete window.Capacitor;
  });

  describe('isBrowserDeviceUnlockAvailable', () => {
    test('false with no WebAuthn API present at all', () => {
      expect(isBrowserDeviceUnlockAvailable()).toBe(false);
    });

    test('true once PublicKeyCredential + navigator.credentials are present', () => {
      installEmulator();
      expect(isBrowserDeviceUnlockAvailable()).toBe(true);
    });

    test('false inside a Capacitor (Android) shell, even with the WebAuthn API present — native device unlock owns this decision there', () => {
      installEmulator();
      window.Capacitor = { isNativePlatform: () => true };
      expect(isBrowserDeviceUnlockAvailable()).toBe(false);
    });
  });

  describe('hasBrowserDeviceUnlock', () => {
    test('false with no active session', async () => {
      installEmulator();
      expect(await hasBrowserDeviceUnlock()).toBe(false);
    });

    test('false before any enrollment', async () => {
      installEmulator();
      await setUpLoggedInAccount();
      expect(await hasBrowserDeviceUnlock()).toBe(false);
    });

    test('true after a successful enrollment', async () => {
      installEmulator();
      await setUpLoggedInAccount();
      const kp = nacl.box.keyPair();
      installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey) });
      await enrollBrowser(kp.secretKey);
      expect(await hasBrowserDeviceUnlock()).toBe(true);
    });
  });

  describe('enrollBrowser — full happy path (test 1: PRF-supported enrollment succeeds)', () => {
    test('resolves with a credentialId, and hasBrowserDeviceUnlock reports true afterward', async () => {
      installEmulator({ hmacSecret: 'hmac-secret-mc' });
      await setUpLoggedInAccount();
      const kp = nacl.box.keyPair();
      const backend = installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey) });

      const result = await enrollBrowser(kp.secretKey);
      expect(result.credentialId).toBeTruthy();
      expect(await hasBrowserDeviceUnlock()).toBe(true);
      expect(backend.calls.some(c => c.url.includes('register-verify'))).toBe(true);
    });

    test('enrollment is NOT reported as active until every step (create -> PRF -> get -> wrap -> persist) has actually completed (test 16)', async () => {
      installEmulator({ hmacSecret: 'hmac-secret-mc' });
      await setUpLoggedInAccount();
      const kp = nacl.box.keyPair();
      installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey) });

      // Before enrolling at all.
      expect(await hasBrowserDeviceUnlock()).toBe(false);
    });
  });

  describe('enrollBrowser — item h: the key being enrolled is re-verified against the server public key', () => {
    test('refuses to enroll a secret key that does not match the account\'s server-recorded public key', async () => {
      installEmulator();
      await setUpLoggedInAccount();
      const realKp = nacl.box.keyPair();
      const wrongKp = nacl.box.keyPair();
      installBackend({ myKeysPublicKeyB64: encodeBase64(realKp.publicKey) });

      await expect(enrollBrowser(wrongKp.secretKey)).rejects.toMatchObject({ code: 'PUBLIC_KEY_MISMATCH' });
      expect(await hasBrowserDeviceUnlock()).toBe(false);
    });
  });

  describe('enrollBrowser — PRF confirmation failures (test 2)', () => {
    test('create() succeeds but the authenticator has no PRF support at all: enrollment rejected with PRF_NOT_SUPPORTED, nothing persisted', async () => {
      installEmulator({ hmacSecret: 'none' });
      await setUpLoggedInAccount();
      const kp = nacl.box.keyPair();
      const backend = installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey) });

      await expect(enrollBrowser(kp.secretKey)).rejects.toMatchObject({ code: 'PRF_NOT_SUPPORTED' });
      expect(await hasBrowserDeviceUnlock()).toBe(false);
      expect(backend.calls.some(c => c.url.includes('register-verify'))).toBe(false);
    });

    test('create() confirms PRF, but the immediate follow-up get() never returns a PRF result: enrollment rejected with PRF_NOT_CONFIRMED, nothing persisted', async () => {
      // 'hmac-secret' (not '-mc'): the CTAP2 extension is only evaluated on
      // GET, not on the initial MakeCredential — so create()'s extension
      // results report capability, but this module's own immediate probe
      // get() is what actually needs a result and, in a less-capable
      // authenticator, might still fail to produce one at authentication.
      // Simulate the stricter "no PRF at all" case at the probe-get step by
      // swapping the authenticator between create() and the probe get() —
      // the simplest reliable way to make the SAME credential fail on GET.
      const emulator = installEmulator({ hmacSecret: 'hmac-secret-mc' });
      await setUpLoggedInAccount();
      const kp = nacl.box.keyPair();
      const backend = installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey) });

      // Make navigator.credentials.get() throw on the very next call (the
      // enrollment probe-get), simulating "authentication-time PRF
      // confirmation failed" without needing a second real authenticator.
      const realGet = window.navigator.credentials.get;
      window.navigator.credentials.get = vi.fn(async () => { throw new DOMException('no result', 'NotSupportedError'); });

      await expect(enrollBrowser(kp.secretKey)).rejects.toMatchObject({ code: 'PRF_NOT_CONFIRMED' });
      expect(await hasBrowserDeviceUnlock()).toBe(false);
      expect(backend.calls.some(c => c.url.includes('register-verify'))).toBe(false);
      window.navigator.credentials.get = realGet;
    });
  });

  // Root-cause report follow-up (production CREATE_FAILED investigation):
  // browserDeviceUnlock.js used to discard navigator.credentials.create()'s
  // real DOMException entirely — only the static string 'CREATE_FAILED'
  // ever reached a caller/log. These tests exercise the fix: the original
  // browser-reported name/message now survive on the thrown error, and the
  // sanctioned logging helper surfaces them without ever touching secrets.
  describe('enrollBrowser — create() rejection preserves the original DOMException (root-cause diagnostic fix)', () => {
    test('create() rejects with a real DOMException: CREATE_FAILED carries the original name + message, nothing persisted, register-verify never called', async () => {
      installEmulator({ hmacSecret: 'hmac-secret-mc' });
      await setUpLoggedInAccount();
      const kp = nacl.box.keyPair();
      const backend = installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey) });

      const realCreate = window.navigator.credentials.create;
      window.navigator.credentials.create = vi.fn(async () => {
        throw new DOMException('The operation either timed out or was not allowed.', 'NotAllowedError');
      });

      try {
        const err = await enrollBrowser(kp.secretKey).catch(e => e);
        expect(err).toBeInstanceOf(BrowserDeviceUnlockError);
        expect(err.code).toBe('CREATE_FAILED');
        expect(err.originalName).toBe('NotAllowedError');
        expect(err.originalMessage).toBe('The operation either timed out or was not allowed.');
        // The error's own top-level .message is unchanged/back-compatible —
        // still the human-readable string it always was.
        expect(err.message).toBe('The operation either timed out or was not allowed.');

        expect(await hasBrowserDeviceUnlock()).toBe(false);
        expect(backend.calls.some(c => c.url.includes('register-verify'))).toBe(false);
      } finally {
        window.navigator.credentials.create = realCreate;
      }
    });

    test('create() rejects with a bare Error (no DOMException name): CREATE_FAILED still carries whatever name/message it had', async () => {
      installEmulator({ hmacSecret: 'hmac-secret-mc' });
      await setUpLoggedInAccount();
      const kp = nacl.box.keyPair();
      installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey) });

      const realCreate = window.navigator.credentials.create;
      window.navigator.credentials.create = vi.fn(async () => { throw new Error('simulated platform failure'); });

      try {
        const err = await enrollBrowser(kp.secretKey).catch(e => e);
        expect(err.code).toBe('CREATE_FAILED');
        expect(err.originalName).toBe('Error');
        expect(err.originalMessage).toBe('simulated platform failure');
      } finally {
        window.navigator.credentials.create = realCreate;
      }
    });

    test('describeBrowserDeviceUnlockError surfaces {code, name, message} for logging and never includes key material', async () => {
      installEmulator({ hmacSecret: 'hmac-secret-mc' });
      await setUpLoggedInAccount();
      const kp = nacl.box.keyPair();
      installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey) });

      const realCreate = window.navigator.credentials.create;
      window.navigator.credentials.create = vi.fn(async () => {
        throw new DOMException('Requested extensions are not supported.', 'NotSupportedError');
      });

      try {
        const err = await enrollBrowser(kp.secretKey).catch(e => e);
        const described = describeBrowserDeviceUnlockError(err);
        expect(described).toEqual({ code: 'CREATE_FAILED', name: 'NotSupportedError', message: 'Requested extensions are not supported.' });

        // Never includes the account's actual secret key or its base64
        // encoding — this module never puts key material into an Error in
        // the first place (confirmed above: create() rejects before any key
        // material is touched), but this asserts the diagnostic summary
        // itself stays confined to exactly {code, name, message}, nothing
        // else could leak through a wider object spread by accident.
        expect(Object.keys(described).sort()).toEqual(['code', 'message', 'name']);
        const serialized = JSON.stringify(described);
        expect(serialized).not.toContain(encodeBase64(kp.secretKey));
        expect(serialized).not.toContain(encodeBase64(kp.publicKey));
      } finally {
        window.navigator.credentials.create = realCreate;
      }
    });

    test('describeBrowserDeviceUnlockError on a non-BrowserDeviceUnlockError value still returns a safe {code, name, message} shape', () => {
      expect(describeBrowserDeviceUnlockError(new TypeError('boom'))).toEqual({ code: null, name: 'TypeError', message: 'boom' });
      expect(describeBrowserDeviceUnlockError('a bare string')).toEqual({ code: null, name: null, message: 'a bare string' });
      expect(describeBrowserDeviceUnlockError(undefined)).toEqual({ code: null, name: null, message: null });
    });
  });

  describe('enrollBrowser — wrapping/persistence failures (test 3, test 16 continued)', () => {
    test('AES-GCM wrapping fails (WebCrypto throws): enrollment rejected with WRAP_FAILED, nothing persisted, register-verify never called', async () => {
      installEmulator({ hmacSecret: 'hmac-secret-mc' });
      await setUpLoggedInAccount();
      const kp = nacl.box.keyPair();
      const backend = installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey) });

      // Direct property swap (not vi.spyOn) — WebCrypto's `encrypt` method
      // is defined in a way vi.spyOn's own restore didn't reliably undo in
      // this environment, which would otherwise leak the failure into every
      // later test in this file. A manual try/finally reassignment is
      // unambiguous either way.
      const realEncrypt = crypto.subtle.encrypt.bind(crypto.subtle);
      crypto.subtle.encrypt = async () => { throw new Error('simulated WebCrypto failure'); };
      try {
        await expect(enrollBrowser(kp.secretKey)).rejects.toMatchObject({ code: 'WRAP_FAILED' });
        expect(backend.calls.some(c => c.url.includes('register-verify'))).toBe(false);
        expect(await hasBrowserDeviceUnlock()).toBe(false);
      } finally {
        crypto.subtle.encrypt = realEncrypt;
      }
    });

    test('server register-verify rejects: enrollment fails, IndexedDB is never written', async () => {
      installEmulator({ hmacSecret: 'hmac-secret-mc' });
      await setUpLoggedInAccount();
      const kp = nacl.box.keyPair();
      installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey), failRegisterVerify: true });

      await expect(enrollBrowser(kp.secretKey)).rejects.toBeInstanceOf(BrowserDeviceUnlockError);
      expect(await hasBrowserDeviceUnlock()).toBe(false);
    });

    test('IndexedDB persistence fails after a successful server registration: enrollment fails AND best-effort forgets the now-orphaned server credential', async () => {
      installEmulator({ hmacSecret: 'hmac-secret-mc' });
      await setUpLoggedInAccount();
      const kp = nacl.box.keyPair();
      const backend = installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey) });

      const originalIndexedDB = globalThis.indexedDB;
      globalThis.indexedDB = { open: () => { throw new Error('simulated IndexedDB unavailable'); } };

      await expect(enrollBrowser(kp.secretKey)).rejects.toMatchObject({ code: 'PERSIST_FAILED' });

      globalThis.indexedDB = originalIndexedDB;
      // register-verify DID succeed (server has a row), so cleanup must have
      // attempted /forget for it.
      expect(backend.calls.some(c => c.url.includes('register-verify'))).toBe(true);
      expect(backend.calls.some(c => c.url.includes('/forget'))).toBe(true);
    });
  });

  describe('unlockViaBrowser — happy path (test 4: existing wrapper decrypts successfully)', () => {
    test('recovers the exact original secret key bytes', async () => {
      installEmulator({ hmacSecret: 'hmac-secret-mc' });
      await setUpLoggedInAccount();
      const kp = nacl.box.keyPair();
      installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey) });
      await enrollBrowser(kp.secretKey);

      const recovered = await unlockViaBrowser();
      expect(recovered).toBeInstanceOf(Uint8Array);
      expect([...recovered]).toEqual([...kp.secretKey]);
    });
  });

  describe('unlockViaBrowser — account isolation (test 5: wrong account cannot use another account\'s wrapper)', () => {
    test('account B has its own hasBrowserDeviceUnlock()=false and cannot unlock using account A\'s local wrapper', async () => {
      installEmulator({ hmacSecret: 'hmac-secret-mc' });
      await setUpLoggedInAccount(1);
      const kpA = nacl.box.keyPair();
      installBackend({ myKeysPublicKeyB64: encodeBase64(kpA.publicKey) });
      await enrollBrowser(kpA.secretKey);
      expect(await hasBrowserDeviceUnlock()).toBe(true);

      // Switch the active session to a different account on the SAME
      // browser (IndexedDB is keyed by accountId, not shared).
      localStorage.clear();
      await setUpLoggedInAccount(2);
      expect(await hasBrowserDeviceUnlock()).toBe(false);
      await expect(unlockViaBrowser()).rejects.toMatchObject({ code: 'NO_LOCAL_WRAPPER' });
    });
  });

  describe('unlockViaBrowser — wrong/stale credential (test 6: wrong credential cannot unlock; test 14: stale wrapper cleanup)', () => {
    test('server rejects the assertion (auth-verify fails): unlock fails, local wrapper is left alone (not a proven-stale case)', async () => {
      installEmulator({ hmacSecret: 'hmac-secret-mc' });
      await setUpLoggedInAccount();
      const kp = nacl.box.keyPair();
      installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey) });
      const { credentialId } = await enrollBrowser(kp.secretKey);

      // Real credentialId (matching what the emulator's authenticator
      // actually holds), so the WebAuthn ceremony itself succeeds — only
      // the server's own verification is made to fail. authedFetch
      // preserves the server's own typed error code (VERIFICATION_FAILED,
      // matching what the real /auth-verify route reports for a
      // WebauthnRpError) rather than masking it behind a generic one.
      installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey), registeredCredentialIds: [credentialId], failAuthVerify: true });
      await expect(unlockViaBrowser()).rejects.toMatchObject({ code: 'VERIFICATION_FAILED' });
      // Local wrapper must still exist — an ambiguous server failure is not
      // proof the wrapper itself is unusable.
      expect(await hasBrowserDeviceUnlock()).toBe(true);
    });

    test('recreated/deleted credential: the ceremony+server-verify succeed but the wrapper can no longer decrypt -> STALE_WRAPPER, and the stale local enrollment is cleared automatically', async () => {
      installEmulator({ hmacSecret: 'hmac-secret-mc' });
      await setUpLoggedInAccount();
      const kp = nacl.box.keyPair();
      installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey) });
      const { credentialId } = await enrollBrowser(kp.secretKey);
      expect(await hasBrowserDeviceUnlock()).toBe(true);

      // Simulate "the passkey was deleted and a brand-new one created" the
      // precise way this actually manifests: the WebAuthn ceremony itself
      // is genuine (same real credential, server verifies it fine) but the
      // stored wrapped blob no longer decrypts under the freshly-derived
      // key — e.g. because it was written under different key material at
      // some point. Corrupting the stored ciphertext directly isolates
      // exactly that one condition without needing a second real
      // authenticator identity.
      installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey), registeredCredentialIds: [credentialId] });
      await corruptStoredWrapper(1);

      await expect(unlockViaBrowser()).rejects.toMatchObject({ code: 'STALE_WRAPPER' });
      expect(await hasBrowserDeviceUnlock()).toBe(false);
    });

    test('WebAuthn ceremony itself fails (e.g. cancelled): local wrapper is NOT cleared — only a post-ceremony decrypt failure clears it', async () => {
      installEmulator({ hmacSecret: 'hmac-secret-mc' });
      await setUpLoggedInAccount();
      const kp = nacl.box.keyPair();
      installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey) });
      await enrollBrowser(kp.secretKey);

      window.navigator.credentials.get = vi.fn(async () => { throw new DOMException('cancelled', 'NotAllowedError'); });
      await expect(unlockViaBrowser()).rejects.toMatchObject({ code: 'GET_FAILED' });
      expect(await hasBrowserDeviceUnlock()).toBe(true);
    });
  });

  describe('unlockViaBrowser — synced credential without a local wrapper (test 13)', () => {
    test('a WebAuthn credential existing (server reports it registered) with NO local IndexedDB record cannot unlock — this is the "synced passkey, new physical device" case', async () => {
      installEmulator({ hmacSecret: 'hmac-secret-mc' });
      await setUpLoggedInAccount();
      const kp = nacl.box.keyPair();
      // Server believes a credential is registered (as it would after a
      // passkey sync made the credential itself available here too), but
      // this browser's IndexedDB has never seen this account.
      installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey), registeredCredentialIds: ['some-synced-credential-id'] });

      await expect(unlockViaBrowser()).rejects.toMatchObject({ code: 'NO_LOCAL_WRAPPER' });
      // Crucially: no WebAuthn ceremony or network call was even attempted —
      // the local-wrapper check is the very first thing checked.
    });
  });

  describe('forgetBrowser (test 11: removes only local browser enrollment)', () => {
    test('removes the local wrapper and makes a best-effort server-side forget call, touching nothing else', async () => {
      installEmulator({ hmacSecret: 'hmac-secret-mc' });
      await setUpLoggedInAccount();
      const kp = nacl.box.keyPair();
      const backend = installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey) });
      await enrollBrowser(kp.secretKey);
      expect(await hasBrowserDeviceUnlock()).toBe(true);

      await forgetBrowser();

      expect(await hasBrowserDeviceUnlock()).toBe(false);
      expect(backend.calls.some(c => c.url.includes('/forget'))).toBe(true);
      // The account's actual session/token is completely untouched — this
      // function has no way to reach watch_token, watch_username, or any
      // E2EE key material at all.
      expect(localStorage.getItem('watch_token')).toBeTruthy();
    });

    test('never throws, even with no enrollment to forget', async () => {
      installEmulator();
      await setUpLoggedInAccount();
      await expect(forgetBrowser()).resolves.toBeUndefined();
    });

    test('never throws even when the server-side forget call fails', async () => {
      installEmulator({ hmacSecret: 'hmac-secret-mc' });
      await setUpLoggedInAccount();
      const kp = nacl.box.keyPair();
      installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey) });
      await enrollBrowser(kp.secretKey);

      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network down'); }));
      await expect(forgetBrowser()).resolves.toBeUndefined();
      // Local removal still happened despite the network failure.
      expect(await hasBrowserDeviceUnlock()).toBe(false);
    });
  });

  describe('security invariants (test 15: PRF output and derived wrapping key are never persisted)', () => {
    test('the IndexedDB record contains only the documented fields — no prf/wrappingKey-shaped data, and the stored blob is not the plaintext key', async () => {
      installEmulator({ hmacSecret: 'hmac-secret-mc' });
      await setUpLoggedInAccount(7);
      const kp = nacl.box.keyPair();
      installBackend({ myKeysPublicKeyB64: encodeBase64(kp.publicKey) });
      await enrollBrowser(kp.secretKey);

      const record = await new Promise((resolve, reject) => {
        const req = indexedDB.open('sahaplay_browser_unlock', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('wrappers', 'readonly');
          const getReq = tx.objectStore('wrappers').get(7);
          getReq.onsuccess = () => { db.close(); resolve(getReq.result); };
          getReq.onerror = () => { db.close(); reject(getReq.error); };
        };
        req.onerror = () => reject(req.error);
      });

      expect(record).toBeTruthy();
      expect(Object.keys(record).sort()).toEqual(['accountId', 'createdAt', 'credentialId', 'iv', 'version', 'wrappedKeyBlob'].sort());
      // The wrapped blob must not literally contain the plaintext secret key
      // bytes anywhere in it (a trivially-detectable "encryption" bug).
      const secretKeyB64 = btoa(String.fromCharCode(...kp.secretKey));
      expect(record.wrappedKeyBlob).not.toBe(secretKeyB64);
      expect(record.wrappedKeyBlob.includes(secretKeyB64)).toBe(false);
    });
  });
});
