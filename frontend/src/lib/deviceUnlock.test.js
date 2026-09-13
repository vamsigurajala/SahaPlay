import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isDeviceUnlockAvailable,
  hasDeviceUnlock,
  setupDeviceUnlock,
  unlockDeviceKey,
  clearDeviceUnlock,
  DeviceUnlockError,
} from './deviceUnlock.js';

// Builds a syntactically-real (unsigned test) JWT-shaped string — matches
// exactly what decodeAccountIdFromToken() in deviceUnlock.js parses. Real
// production tokens are HS256-signed server-side; this module never
// verifies the signature itself (see its own doc comment on why that's
// fine — it's a lookup key, not an authentication step), so an unsigned
// test token exercises the exact same decode path.
function fakeToken(payload) {
  const b64url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'HS256' })}.${b64url(payload)}.fakesignature`;
}

function installNativePlugin(pluginMock) {
  window.Capacitor = {
    isNativePlatform: () => true,
    Plugins: { SahaplayE2ee: pluginMock },
  };
}

function mockAssertionFetch(assertion = 'fresh-assertion-string') {
  return vi.fn(async (url) => {
    if (String(url).includes('/api/auth/device-enrollment-assertion')) {
      return { ok: true, json: async () => ({ assertion }) };
    }
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
}

describe('deviceUnlock.js', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    delete window.Capacitor;
  });

  afterEach(() => {
    delete window.Capacitor;
    vi.unstubAllGlobals();
  });

  describe('isDeviceUnlockAvailable', () => {
    test('false with no native plugin present', () => {
      expect(isDeviceUnlockAvailable()).toBe(false);
    });

    test('true once the native plugin is present', () => {
      installNativePlugin({});
      expect(isDeviceUnlockAvailable()).toBe(true);
    });
  });

  // ─── The core account-binding property: no function here ever accepts
  // or forwards anything other than what's decoded from the CURRENT
  // watch_token — there is no parameter path for a caller to name a
  // different account. ─────────────────────────────────────────────────
  describe('account binding — accountId is always derived from the current token, never a parameter', () => {
    test('hasDeviceUnlock calls native with the accountId decoded from watch_token, and the freshly-fetched assertion — nothing else', async () => {
      localStorage.setItem('watch_token', fakeToken({ id: 777, username: 'alice' }));
      vi.stubGlobal('fetch', mockAssertionFetch('assertion-for-777'));

      const nativeHasDeviceUnlock = vi.fn(async () => ({ exists: true }));
      installNativePlugin({ hasDeviceUnlock: nativeHasDeviceUnlock });

      const result = await hasDeviceUnlock();

      expect(result).toBe(true);
      expect(nativeHasDeviceUnlock).toHaveBeenCalledTimes(1);
      expect(nativeHasDeviceUnlock).toHaveBeenCalledWith({ accountId: 777, assertion: 'assertion-for-777' });
    });

    test('none of the exported functions declare an accountId parameter', () => {
      // Structural guarantee, not just a runtime behavior: the public API
      // surface itself cannot express "check a different account" — a
      // caller has no parameter to even attempt passing one through.
      expect(hasDeviceUnlock.length).toBe(0);
      expect(unlockDeviceKey.length).toBe(0);
      expect(clearDeviceUnlock.length).toBe(0);
      // setupDeviceUnlock's only parameters are the key material itself
      // and an enrollment option — still no account identifier.
      expect(setupDeviceUnlock.length).toBeLessThanOrEqual(2);
    });

    test('switching the active token between calls changes which account is targeted, automatically, with no caller action', async () => {
      const nativeHasDeviceUnlock = vi.fn(async () => ({ exists: false }));
      installNativePlugin({ hasDeviceUnlock: nativeHasDeviceUnlock });

      localStorage.setItem('watch_token', fakeToken({ id: 1, username: 'accountA' }));
      vi.stubGlobal('fetch', mockAssertionFetch('assertion-for-1'));
      await hasDeviceUnlock();
      expect(nativeHasDeviceUnlock).toHaveBeenLastCalledWith({ accountId: 1, assertion: 'assertion-for-1' });

      // Simulates account switch: a real login replaces watch_token.
      localStorage.setItem('watch_token', fakeToken({ id: 2, username: 'accountB' }));
      vi.stubGlobal('fetch', mockAssertionFetch('assertion-for-2'));
      await hasDeviceUnlock();
      expect(nativeHasDeviceUnlock).toHaveBeenLastCalledWith({ accountId: 2, assertion: 'assertion-for-2' });
    });
  });

  describe('fetchFreshAssertion preconditions (exercised via hasDeviceUnlock, which never throws)', () => {
    test('no active session at all -> reported as not enrolled, no fetch attempted', async () => {
      installNativePlugin({ hasDeviceUnlock: vi.fn() });
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      expect(await hasDeviceUnlock()).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('guest account -> reported as not enrolled, no fetch attempted (guests have no server-side E2EE identity to enroll)', async () => {
      localStorage.setItem('watch_is_guest', 'true');
      localStorage.setItem('watch_token', fakeToken({ id: 5, username: 'guest_x' }));
      installNativePlugin({ hasDeviceUnlock: vi.fn() });
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      expect(await hasDeviceUnlock()).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('assertion fetch throws (network failure) -> hasDeviceUnlock reports false, never throws', async () => {
      localStorage.setItem('watch_token', fakeToken({ id: 1, username: 'a' }));
      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
      installNativePlugin({ hasDeviceUnlock: vi.fn() });

      await expect(hasDeviceUnlock()).resolves.toBe(false);
    });

    test('assertion endpoint returns non-2xx -> unlockDeviceKey rejects with ASSERTION_FETCH_FAILED, never returns a key', async () => {
      localStorage.setItem('watch_token', fakeToken({ id: 1, username: 'a' }));
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
      installNativePlugin({ unlockDeviceKey: vi.fn() });

      await expect(unlockDeviceKey()).rejects.toMatchObject({ code: 'ASSERTION_FETCH_FAILED' });
    });
  });

  describe('unlockDeviceKey', () => {
    test('resolves the raw secret key bytes on success', async () => {
      localStorage.setItem('watch_token', fakeToken({ id: 1, username: 'a' }));
      vi.stubGlobal('fetch', mockAssertionFetch());
      const secretKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));
      installNativePlugin({ unlockDeviceKey: vi.fn(async () => ({ secretKeyBase64 })) });

      const result = await unlockDeviceKey();
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
      expect([...result]).toEqual(new Array(32).fill(9));
    });

    test('propagates a native rejection code (e.g. KEY_INVALIDATED) as a typed DeviceUnlockError', async () => {
      localStorage.setItem('watch_token', fakeToken({ id: 1, username: 'a' }));
      vi.stubGlobal('fetch', mockAssertionFetch());
      const nativeError = Object.assign(new Error('Device unlock key was invalidated'), { code: 'KEY_INVALIDATED' });
      installNativePlugin({ unlockDeviceKey: vi.fn(async () => { throw nativeError; }) });

      await expect(unlockDeviceKey()).rejects.toBeInstanceOf(DeviceUnlockError);
      await expect(unlockDeviceKey()).rejects.toMatchObject({ code: 'KEY_INVALIDATED' });
    });

    test('every documented native failure code surfaces as-is (never silently swallowed, never reinterpreted as "no key exists")', async () => {
      localStorage.setItem('watch_token', fakeToken({ id: 1, username: 'a' }));
      vi.stubGlobal('fetch', mockAssertionFetch());

      for (const code of ['NO_VALID_ASSERTION', 'NO_KEY_FOR_ACCOUNT', 'CORRUPT_WRAPPER', 'HARDWARE_UNAVAILABLE', 'AUTH_FAILED', 'ALREADY_IN_PROGRESS']) {
        installNativePlugin({ unlockDeviceKey: vi.fn(async () => { throw Object.assign(new Error(code), { code }); }) });
        await expect(unlockDeviceKey()).rejects.toMatchObject({ code });
      }
    });

    test('throws NOT_AVAILABLE when native is not present at all (browser/iOS)', async () => {
      await expect(unlockDeviceKey()).rejects.toMatchObject({ code: 'NOT_AVAILABLE' });
    });
  });

  describe('setupDeviceUnlock', () => {
    test('rejects a secretKeyBytes that is not exactly 32 bytes, without ever calling native', async () => {
      localStorage.setItem('watch_token', fakeToken({ id: 1, username: 'a' }));
      vi.stubGlobal('fetch', mockAssertionFetch());
      const nativeSetup = vi.fn();
      installNativePlugin({ setupDeviceUnlock: nativeSetup });

      await expect(setupDeviceUnlock(new Uint8Array(16))).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
      expect(nativeSetup).not.toHaveBeenCalled();
    });

    test('defaults allowOverwrite to false and passes the base64-encoded key through', async () => {
      localStorage.setItem('watch_token', fakeToken({ id: 42, username: 'alice' }));
      vi.stubGlobal('fetch', mockAssertionFetch('assertion-42'));
      const nativeSetup = vi.fn(async () => {});
      installNativePlugin({ setupDeviceUnlock: nativeSetup });

      const key = new Uint8Array(32).fill(3);
      await setupDeviceUnlock(key);

      expect(nativeSetup).toHaveBeenCalledWith(expect.objectContaining({
        accountId: 42,
        assertion: 'assertion-42',
        allowOverwrite: false,
      }));
      const call = nativeSetup.mock.calls[0][0];
      expect(atob(call.secretKeyBase64).split('').map(c => c.charCodeAt(0))).toEqual(new Array(32).fill(3));
    });

    test('propagates ALREADY_ENROLLED without allowOverwrite', async () => {
      localStorage.setItem('watch_token', fakeToken({ id: 1, username: 'a' }));
      vi.stubGlobal('fetch', mockAssertionFetch());
      installNativePlugin({
        setupDeviceUnlock: vi.fn(async () => { throw Object.assign(new Error('already enrolled'), { code: 'ALREADY_ENROLLED' }); }),
      });

      await expect(setupDeviceUnlock(new Uint8Array(32))).rejects.toMatchObject({ code: 'ALREADY_ENROLLED' });
    });
  });

  describe('clearDeviceUnlock ("Forget this device")', () => {
    test('no-ops (does not throw) when native is unavailable', async () => {
      await expect(clearDeviceUnlock()).resolves.toBeUndefined();
    });

    test('calls native with the current account\'s freshly-fetched assertion', async () => {
      localStorage.setItem('watch_token', fakeToken({ id: 9, username: 'bob' }));
      vi.stubGlobal('fetch', mockAssertionFetch('assertion-9'));
      const nativeClear = vi.fn(async () => {});
      installNativePlugin({ clearDeviceUnlock: nativeClear });

      await clearDeviceUnlock();
      expect(nativeClear).toHaveBeenCalledWith({ accountId: 9, assertion: 'assertion-9' });
    });

    test('propagates a native failure rather than silently succeeding', async () => {
      localStorage.setItem('watch_token', fakeToken({ id: 1, username: 'a' }));
      vi.stubGlobal('fetch', mockAssertionFetch());
      installNativePlugin({
        clearDeviceUnlock: vi.fn(async () => { throw Object.assign(new Error('nope'), { code: 'HARDWARE_UNAVAILABLE' }); }),
      });

      await expect(clearDeviceUnlock()).rejects.toMatchObject({ code: 'HARDWARE_UNAVAILABLE' });
    });
  });

  describe('concurrent calls de-dupe the assertion fetch for the same token', () => {
    test('two simultaneous hasDeviceUnlock calls only fetch one assertion', async () => {
      localStorage.setItem('watch_token', fakeToken({ id: 1, username: 'a' }));
      const fetchMock = mockAssertionFetch('shared-assertion');
      vi.stubGlobal('fetch', fetchMock);
      installNativePlugin({ hasDeviceUnlock: vi.fn(async () => ({ exists: true })) });

      const [a, b] = await Promise.all([hasDeviceUnlock(), hasDeviceUnlock()]);
      expect(a).toBe(true);
      expect(b).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
