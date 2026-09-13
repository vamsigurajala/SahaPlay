import React from 'react';
import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import { CryptoProvider, useCrypto } from './CryptoContext';
import { clearUserSession } from '../lib/authUtils.js';
import { saveKeyToSession } from '../lib/crypto.js';

// Security verification pass, "Bug A": clearUserSession() (the function
// nearly every logout/sign-out path in the app calls — Navbar, BottomNav,
// forced 401 logout, inactivity logout, account deletion, etc.) used to only
// remove a now-unused LEGACY localStorage copy of wt_sk/wt_spw, leaving the
// REAL sessionStorage-resident key + wrap-password untouched until the tab
// was fully closed. These tests exercise the actual shared functions (not a
// re-implementation) to prove every logout path — which all funnel through
// clearUserSession() — now really clears the encryption session material,
// storage AND in-memory React state.

function Probe() {
  const { keyPair, needsReauth, setKeyPair } = useCrypto();
  return (
    <div>
      <span data-testid="keypair-state">{keyPair ? 'present' : 'null'}</span>
      <span data-testid="needs-reauth">{String(needsReauth)}</span>
      <span data-testid="public-key">{keyPair ? encodeBase64(keyPair.publicKey) : ''}</span>
      <button data-testid="set-key" onClick={() => setKeyPair({
        publicKey: new Uint8Array(32).fill(1),
        secretKey: new Uint8Array(32).fill(2),
      })}>
        set key
      </button>
    </div>
  );
}

// Same JWT-shaped-but-unsigned test token deviceUnlock.test.js uses —
// CryptoContext never verifies this itself (it only reads watch_token to
// call fetch()); deviceUnlock.js is the one that decodes the `id` claim,
// purely as a native lookup key (see its own doc comment).
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

describe('clearUserSession() clears real encryption session material (Bug A)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  test('wt_sk/wt_spw exist in sessionStorage after a key is set, and are gone after clearUserSession()', async () => {
    await saveKeyToSession(new Uint8Array(32).fill(7));
    expect(sessionStorage.getItem('wt_sk')).toBeTruthy();
    expect(sessionStorage.getItem('wt_spw')).toBeTruthy();

    // The exact function every logout button (Navbar, BottomNav, Profile),
    // forced 401 logout (main.jsx), and inactivity logout call.
    clearUserSession();

    expect(sessionStorage.getItem('wt_sk')).toBeNull();
    expect(sessionStorage.getItem('wt_spw')).toBeNull();
  });

  test('a leftover legacy localStorage copy of wt_sk/wt_spw is also removed', () => {
    // Simulates a tab that never got the chance to run the one-time
    // sessionStorage migration (readMigrated in crypto.js) before logging out.
    localStorage.setItem('wt_sk', 'legacy-blob');
    localStorage.setItem('wt_spw', 'legacy-wrap-password');

    clearUserSession();

    expect(localStorage.getItem('wt_sk')).toBeNull();
    expect(localStorage.getItem('wt_spw')).toBeNull();
  });

  test('React-held keyPair/needsReauth state is cleared too, even without a full page reload', async () => {
    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('keypair-state')).toBeInTheDocument());
    screen.getByTestId('set-key').click();
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'));

    // Most logout call sites navigate via the SPA router rather than a full
    // reload — CryptoProvider stays mounted, so without the
    // 'wt_session_cleared' event listener this in-memory state would
    // survive the "logout" entirely.
    clearUserSession();

    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('null'));
    expect(screen.getByTestId('needs-reauth').textContent).toBe('false');
  });
});

// Security verification pass: a network failure on the mount-time my-keys
// check (thrown fetch — timeout, CORS, server down, etc., as opposed to a
// normal 200 response) used to be treated identically to "server confirmed
// no key exists," falling through to silently mint a brand-new keypair and
// upload its public half via /api/auth/save-public-key. Confirmed live
// against production: this permanently mismatches an EXISTING account's
// publicKey against its own encryptedPrivateKey (which that endpoint never
// touches), breaking every future message encrypted to it. These tests
// exercise CryptoProvider's real mount-time effect (not a re-implementation)
// against a mocked fetch, since that's the only way to control which branch
// of the my-keys check fires.
describe('CryptoContext mount-time key check — network failure must never mint a new keypair', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('watch_token', 'fake-jwt-for-test');
    localStorage.setItem('watch_username', 'testuser');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test('my-keys fetch throws (network failure): needsReauth becomes true, no keypair is generated, save-public-key is never called', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes('/api/auth/my-keys')) throw new TypeError('Failed to fetch');
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('needs-reauth').textContent).toBe('true'));
    expect(screen.getByTestId('keypair-state').textContent).toBe('null');
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('save-public-key'), expect.anything());
  });

  test('my-keys fetch succeeds with an existing publicKey: needsReauth becomes true, no keypair is generated (unchanged behavior)', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes('/api/auth/my-keys')) {
        return { ok: true, json: async () => ({ publicKey: 'existing-real-public-key', encryptedPrivateKey: 'blob' }) };
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('needs-reauth').textContent).toBe('true'));
    expect(screen.getByTestId('keypair-state').textContent).toBe('null');
  });

  test('my-keys fetch succeeds confirming no key exists at all: a fresh keypair is generated (genuinely new account, unchanged behavior)', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes('/api/auth/my-keys')) {
        return { ok: true, json: async () => ({ publicKey: null, encryptedPrivateKey: null }) };
      }
      if (String(url).includes('save-public-key')) {
        return { ok: true, json: async () => ({ success: true }) };
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CryptoProvider><Probe /></CryptoProvider>);

    // This branch really runs saveKeyToSession() -> encryptPrivateKey(), which
    // derives its wrapping key via real PBKDF2-SHA256 at 600k iterations
    // (crypto.js, OWASP 2024 guidance — deliberately slow, and must stay
    // that way). Measured ~480-530ms solo but ~780-835ms under full-suite
    // CPU contention (other test files' worker threads competing for CPU),
    // which occasionally exceeded waitFor's default 1000ms and flaked this
    // exact assertion — not a production bug, just too little timing margin
    // around a genuinely slow, real crypto operation. Everything else in
    // this file resolves in well under 100ms and doesn't need the same
    // allowance.
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'), { timeout: 5000 });
    expect(screen.getByTestId('needs-reauth').textContent).toBe('false');
  });
});

// Stage 4: device-unlock cold-start integration. All of these exercise the
// real CryptoProvider mount effect (not a re-implementation) with fetch and
// window.Capacitor mocked — see mandatory restore order / key-generation
// safety rules in the Stage 4 spec.
describe('CryptoContext cold-start device unlock (Android) — restore, never regenerate', () => {
  const REAL_KP = nacl.box.keyPair();
  const REAL_PUB_B64 = encodeBase64(REAL_KP.publicKey);

  function myKeysHandler(url) {
    if (String(url).includes('/api/auth/my-keys')) {
      return { ok: true, json: async () => ({ publicKey: REAL_PUB_B64, encryptedPrivateKey: 'server-side-blob' }) };
    }
    return null;
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    delete window.Capacitor;
    localStorage.setItem('watch_token', fakeToken({ id: 42, username: 'testuser' }));
    localStorage.setItem('watch_username', 'testuser');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete window.Capacitor;
  });

  test('Android + enrolled + matching public key: key is restored silently, no reauth prompt, save-public-key never called', async () => {
    const nativeUnlock = vi.fn(async () => ({ secretKeyBase64: encodeBase64(REAL_KP.secretKey) }));
    installNativePlugin({ unlockDeviceKey: nativeUnlock });

    const fetchMock = vi.fn(async (url) => {
      const my = myKeysHandler(url);
      if (my) return my;
      if (String(url).includes('/api/auth/device-enrollment-assertion')) {
        return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'));
    expect(screen.getByTestId('needs-reauth').textContent).toBe('false');
    expect(screen.getByTestId('public-key').textContent).toBe(REAL_PUB_B64);
    expect(nativeUnlock).toHaveBeenCalledTimes(1);
    expect(nativeUnlock).toHaveBeenCalledWith({ accountId: 42, assertion: 'fresh-assertion' });
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('save-public-key'), expect.anything());
  });

  test('browser (no window.Capacitor): device unlock is never attempted, existing passphrase-prompt behavior unchanged', async () => {
    // Deliberately no installNativePlugin() call — window.Capacitor stays unset.
    const fetchMock = vi.fn(async (url) => {
      const my = myKeysHandler(url);
      if (my) return my;
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('needs-reauth').textContent).toBe('true'));
    expect(screen.getByTestId('keypair-state').textContent).toBe('null');
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('device-enrollment-assertion'), expect.anything());
  });

  test('Android available but not enrolled (native rejects NO_KEY_FOR_ACCOUNT): falls back to reauth, no key generated', async () => {
    const nativeUnlock = vi.fn(async () => { throw { code: 'NO_KEY_FOR_ACCOUNT', message: 'not enrolled' }; });
    installNativePlugin({ unlockDeviceKey: nativeUnlock });

    const fetchMock = vi.fn(async (url) => {
      const my = myKeysHandler(url);
      if (my) return my;
      if (String(url).includes('/api/auth/device-enrollment-assertion')) {
        return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('needs-reauth').textContent).toBe('true'));
    expect(screen.getByTestId('keypair-state').textContent).toBe('null');
  });

  test('Android device unlock succeeds but returns a key that does NOT match the server public key: rejected, falls back to reauth (never trusted, never overwrites server key)', async () => {
    const wrongKp = nacl.box.keyPair();
    const nativeUnlock = vi.fn(async () => ({ secretKeyBase64: encodeBase64(wrongKp.secretKey) }));
    installNativePlugin({ unlockDeviceKey: nativeUnlock });

    const fetchMock = vi.fn(async (url) => {
      const my = myKeysHandler(url);
      if (my) return my;
      if (String(url).includes('/api/auth/device-enrollment-assertion')) {
        return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('needs-reauth').textContent).toBe('true'));
    expect(screen.getByTestId('keypair-state').textContent).toBe('null');
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('save-public-key'), expect.anything());
  });

  test('Android assertion fetch fails (network failure): falls back to reauth, no key generated', async () => {
    const nativeUnlock = vi.fn(async () => ({ secretKeyBase64: encodeBase64(REAL_KP.secretKey) }));
    installNativePlugin({ unlockDeviceKey: nativeUnlock });

    const fetchMock = vi.fn(async (url) => {
      const my = myKeysHandler(url);
      if (my) return my;
      if (String(url).includes('/api/auth/device-enrollment-assertion')) {
        throw new TypeError('Failed to fetch');
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('needs-reauth').textContent).toBe('true'));
    expect(screen.getByTestId('keypair-state').textContent).toBe('null');
    expect(nativeUnlock).not.toHaveBeenCalled(); // never reached native — assertion fetch failed first
  });

  test('my-keys network failure: device unlock is never even attempted (nothing to verify against), same reauth fallback as before this stage', async () => {
    installNativePlugin({ unlockDeviceKey: vi.fn() });
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes('/api/auth/my-keys')) throw new TypeError('Failed to fetch');
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('needs-reauth').textContent).toBe('true'));
    expect(screen.getByTestId('keypair-state').textContent).toBe('null');
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('device-enrollment-assertion'), expect.anything());
  });

  test('server genuinely confirms no key exists at all: still generates a fresh keypair (Android device unlock never attempted — nothing to restore)', async () => {
    installNativePlugin({ unlockDeviceKey: vi.fn() });
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes('/api/auth/my-keys')) {
        return { ok: true, json: async () => ({ publicKey: null, encryptedPrivateKey: null }) };
      }
      if (String(url).includes('save-public-key')) {
        return { ok: true, json: async () => ({ success: true }) };
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'), { timeout: 5000 });
    expect(screen.getByTestId('needs-reauth').textContent).toBe('false');
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('device-enrollment-assertion'), expect.anything());
  });
});

// Stage 4: enrollDeviceUnlock's first-device-setup guard — must never be
// usable to enroll before the account's real E2EE key exists in memory,
// since there would be nothing legitimate to wrap.
describe('CryptoContext.enrollDeviceUnlock — first-device-setup ordering guard', () => {
  function Enroller() {
    const { keyPair, setKeyPair, enrollDeviceUnlock } = useCrypto();
    const [result, setResult] = React.useState('');
    return (
      <div>
        <span data-testid="keypair-state">{keyPair ? 'present' : 'null'}</span>
        <span data-testid="enroll-result">{result}</span>
        <button data-testid="enroll" onClick={async () => {
          try { await enrollDeviceUnlock(); setResult('ok'); }
          catch (e) { setResult('error:' + e.message); }
        }}>enroll</button>
        <button data-testid="set-key" onClick={() => setKeyPair({
          publicKey: new Uint8Array(32).fill(1),
          secretKey: new Uint8Array(32).fill(2),
        })}>set key</button>
      </div>
    );
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    delete window.Capacitor;
    localStorage.setItem('watch_token', fakeToken({ id: 1, username: 'testuser' }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete window.Capacitor; });

  test('enrolling before any E2EE key exists throws and never calls native setupDeviceUnlock; enrolling after the key exists succeeds', async () => {
    const nativeSetup = vi.fn();
    installNativePlugin({ setupDeviceUnlock: nativeSetup });
    // A slow-resolving my-keys response keeps the mount effect's "genuinely
    // new account -> auto-generate" branch from having set a keyPair yet by
    // the time the guard is exercised immediately below.
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('/api/auth/my-keys')) {
        await new Promise(r => setTimeout(r, 50));
        return { ok: true, json: async () => ({ publicKey: null, encryptedPrivateKey: null }) };
      }
      if (String(url).includes('save-public-key')) return { ok: true, json: async () => ({ success: true }) };
      if (String(url).includes('/api/auth/device-enrollment-assertion')) return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
      throw new Error(`Unexpected fetch: ${url}`);
    }));

    render(<CryptoProvider><Enroller /></CryptoProvider>);

    // Guard: no in-memory key yet -> enrollDeviceUnlock must reject, never touching native.
    expect(screen.getByTestId('keypair-state').textContent).toBe('null');
    screen.getByTestId('enroll').click();
    await waitFor(() => expect(screen.getByTestId('enroll-result').textContent).toContain('error'));
    expect(screen.getByTestId('enroll-result').textContent).toContain('No encryption key established');
    expect(nativeSetup).not.toHaveBeenCalled();

    // Once the account's real E2EE key exists (auto-generated here, since
    // this is a genuinely brand-new account), enrollment is allowed.
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'), { timeout: 5000 });
    screen.getByTestId('enroll').click();
    await waitFor(() => expect(screen.getByTestId('enroll-result').textContent).toBe('ok'));
    expect(nativeSetup).toHaveBeenCalledTimes(1);
  });

  test('guest accounts cannot enroll device unlock', async () => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('watch_is_guest', 'true');
    localStorage.setItem('watch_username', 'aguest');
    const nativeSetup = vi.fn();
    installNativePlugin({ setupDeviceUnlock: nativeSetup });

    render(<CryptoProvider><Enroller /></CryptoProvider>);
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'));

    screen.getByTestId('enroll').click();
    await waitFor(() => expect(screen.getByTestId('enroll-result').textContent).toContain('error'));
    expect(screen.getByTestId('enroll-result').textContent).toContain('guest');
    expect(nativeSetup).not.toHaveBeenCalled();
  });
});
