import React from 'react';
import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { CryptoProvider, useCrypto } from './CryptoContext';
import { clearUserSession } from '../lib/authUtils.js';
import { saveKeyToSession } from '../lib/crypto.js';
import { isBrowserDeviceUnlockAvailable, unlockViaBrowser } from '../lib/browserDeviceUnlock.js';

// Mocked file-wide. Default state (isBrowserDeviceUnlockAvailable -> false)
// matches what the REAL module already returns in every other test in this
// file (plain jsdom has no window.PublicKeyCredential) — so every test
// above this point that doesn't touch these mocks keeps behaving exactly
// as it did before browser device unlock existed. Only the dedicated
// "browser device unlock" describe block below overrides them.
vi.mock('../lib/browserDeviceUnlock.js', () => ({
  isBrowserDeviceUnlockAvailable: vi.fn(() => false),
  hasBrowserDeviceUnlock: vi.fn(async () => false),
  unlockViaBrowser: vi.fn(async () => { throw new Error('not mocked in this test'); }),
  enrollBrowser: vi.fn(async () => { throw new Error('not mocked in this test'); }),
  forgetBrowser: vi.fn(async () => {}),
}));

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

    // Real, deliberately slow 600k-iteration PBKDF2 (saveKeyToSession)
    // runs on this success path — can occasionally exceed waitFor's
    // default 1000ms under full-suite CPU contention (same documented
    // allowance used elsewhere in this file).
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'), { timeout: 5000 });
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

    // tryRestoreViaDeviceUnlock retries ASSERTION_FETCH_FAILED up to 3
    // times with a short backoff (400ms, 800ms) before giving up — see its
    // own doc comment. That adds up to ~1.2s here on top of the default
    // waitFor allowance.
    await waitFor(() => expect(screen.getByTestId('needs-reauth').textContent).toBe('true'), { timeout: 3000 });
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

  test('server genuinely confirms no key exists at all: still generates a fresh keypair (Android device-unlock RESTORE is never attempted — nothing to restore — but Stage 5 first-device ENROLLMENT of the brand-new key is)', async () => {
    const nativeUnlock = vi.fn(); // the restore path — must never be reached
    const nativeSetup = vi.fn(async () => ({})); // the enrollment path — this IS a first-device-setup, so this should fire
    installNativePlugin({ unlockDeviceKey: nativeUnlock, setupDeviceUnlock: nativeSetup });
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes('/api/auth/my-keys')) {
        return { ok: true, json: async () => ({ publicKey: null, encryptedPrivateKey: null }) };
      }
      if (String(url).includes('save-public-key')) {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (String(url).includes('/api/auth/device-enrollment-assertion')) {
        return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'), { timeout: 5000 });
    expect(screen.getByTestId('needs-reauth').textContent).toBe('false');
    expect(nativeUnlock).not.toHaveBeenCalled(); // nothing to restore — this is a genuinely new key, not a recovery
    await waitFor(() => expect(nativeSetup).toHaveBeenCalledTimes(1)); // Stage 5: first-device enrollment of that new key
  });

  // tryRestoreViaDeviceUnlock's retry behavior — a genuinely cold app
  // launch's very first network request can transiently fail before the
  // WebView's network stack is fully up; retrying a couple of times turns
  // that into "works" instead of "always falls back to the passphrase/
  // password prompt right after opening the app."
  test('transient ASSERTION_FETCH_FAILED then success on retry: still restores the key silently, no reauth prompt', async () => {
    let assertionAttempts = 0;
    const nativeUnlock = vi.fn(async () => ({ secretKeyBase64: encodeBase64(REAL_KP.secretKey) }));
    installNativePlugin({ unlockDeviceKey: nativeUnlock });

    const fetchMock = vi.fn(async (url) => {
      const my = myKeysHandler(url);
      if (my) return my;
      if (String(url).includes('/api/auth/device-enrollment-assertion')) {
        assertionAttempts++;
        if (assertionAttempts === 1) throw new TypeError('Failed to fetch'); // simulates the cold-start race
        return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'), { timeout: 3000 });
    expect(screen.getByTestId('needs-reauth').textContent).toBe('false');
    expect(screen.getByTestId('public-key').textContent).toBe(REAL_PUB_B64);
    expect(assertionAttempts).toBeGreaterThanOrEqual(2); // confirms a retry actually happened, not a fluke first-try pass
  });

  test('AUTH_FAILED (biometric cancelled) is never retried — falls back to reauth immediately, only one attempt', async () => {
    const nativeUnlock = vi.fn(async () => { throw { code: 'AUTH_FAILED', message: 'user cancelled' }; });
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
    // A cancelled/failed biometric prompt already showed real UI to the
    // user — retrying would just re-trigger the same prompt again, which
    // is exactly the "asks again immediately" annoyance this must avoid.
    expect(nativeUnlock).toHaveBeenCalledTimes(1);
  });

  test('all 3 retry attempts exhausted (persistent ASSERTION_FETCH_FAILED): falls back to reauth, no key generated', async () => {
    installNativePlugin({ unlockDeviceKey: vi.fn() });
    const fetchMock = vi.fn(async (url) => {
      const my = myKeysHandler(url);
      if (my) return my;
      if (String(url).includes('/api/auth/device-enrollment-assertion')) throw new TypeError('Failed to fetch');
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('needs-reauth').textContent).toBe('true'), { timeout: 3000 });
    expect(screen.getByTestId('keypair-state').textContent).toBe('null');
    // my-keys (1) + 3 assertion attempts = 4 total fetch calls
    const assertionCalls = fetchMock.mock.calls.filter(c => String(c[0]).includes('device-enrollment-assertion'));
    expect(assertionCalls.length).toBe(3);
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
    // Stage 5 also fires enrollDeviceUnlockSilently automatically the
    // moment that brand-new key is created (see the mount effect) —
    // clearing the spy here isolates the assertion below to specifically
    // the EXPLICIT enrollDeviceUnlock() call this test is about, not that
    // automatic one (already covered by its own dedicated test elsewhere).
    nativeSetup.mockClear();
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
    // Real, deliberately slow 600k-iteration PBKDF2 (loadOrCreateGuestKeyPair
    // -> encryptGuestKey) — same documented allowance used elsewhere in
    // this file.
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'), { timeout: 5000 });

    screen.getByTestId('enroll').click();
    await waitFor(() => expect(screen.getByTestId('enroll-result').textContent).toContain('error'));
    expect(screen.getByTestId('enroll-result').textContent).toContain('guest');
    expect(nativeSetup).not.toHaveBeenCalled();
  });
});

// Stage 5 fix: reloadPrivateKeyWithPassword (what KeyRecoveryModal's
// password field calls) is the CryptoContext.jsx success path named
// explicitly in the Stage 5 spec — every real call site that obtains this
// account's actual secret key now also enrolls device unlock silently.
describe('CryptoContext.reloadPrivateKeyWithPassword — device unlock enrollment wired in', () => {
  function Recovery() {
    const { keyPair, needsReauth, reloadPrivateKeyWithPassword } = useCrypto();
    const [error, setError] = React.useState('');
    return (
      <div>
        <span data-testid="keypair-state">{keyPair ? 'present' : 'null'}</span>
        <span data-testid="needs-reauth">{String(needsReauth)}</span>
        <span data-testid="public-key">{keyPair ? encodeBase64(keyPair.publicKey) : ''}</span>
        <span data-testid="error">{error}</span>
        <button data-testid="unlock" onClick={async () => {
          try { await reloadPrivateKeyWithPassword('correct password'); }
          catch (e) { setError(e.message); }
        }}>unlock</button>
      </div>
    );
  }

  const REAL_KP = nacl.box.keyPair();

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    delete window.Capacitor;
    localStorage.setItem('watch_token', fakeToken({ id: 21, username: 'erin' }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete window.Capacitor; });

  async function mockedEncryptedBlob() {
    const { encryptPrivateKey } = await import('../lib/crypto.js');
    return encryptPrivateKey(REAL_KP.secretKey, 'correct password');
  }

  test('Android: successful password unlock enrolls device unlock exactly once, with the real secret key', async () => {
    const encryptedPrivateKey = await mockedEncryptedBlob();
    const nativeSetup = vi.fn(async () => ({}));
    installNativePlugin({ setupDeviceUnlock: nativeSetup });
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('/api/auth/my-keys')) return { ok: true, json: async () => ({ encryptedPrivateKey, publicKey: encodeBase64(REAL_KP.publicKey) }) };
      if (String(url).includes('/api/auth/device-enrollment-assertion')) return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
      throw new Error(`Unexpected fetch: ${url}`);
    }));

    render(<CryptoProvider><Recovery /></CryptoProvider>);
    await waitFor(() => expect(screen.getByTestId('needs-reauth').textContent).toBe('true')); // mount effect's own initial state, irrelevant here

    screen.getByTestId('unlock').click();
    // Real, deliberately slow 600k-iteration PBKDF2 decrypt (crypto.js) —
    // can occasionally exceed waitFor's default 1000ms under CPU
    // contention (same documented allowance used elsewhere in this repo,
    // e.g. Login.test.jsx).
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'), { timeout: 5000 });
    await waitFor(() => expect(nativeSetup).toHaveBeenCalledTimes(1), { timeout: 5000 });
    const [[setupArg]] = nativeSetup.mock.calls;
    expect(decodeBase64(setupArg.secretKeyBase64)).toEqual(REAL_KP.secretKey);
  });

  test('browser: successful password unlock never attempts native enrollment', async () => {
    const encryptedPrivateKey = await mockedEncryptedBlob();
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes('/api/auth/my-keys')) return { ok: true, json: async () => ({ encryptedPrivateKey, publicKey: encodeBase64(REAL_KP.publicKey) }) };
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CryptoProvider><Recovery /></CryptoProvider>);
    screen.getByTestId('unlock').click();
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'), { timeout: 5000 });
    await new Promise(r => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('device-enrollment-assertion'), expect.anything());
  });

  test('enrollment failure does not affect the recovered key or needsReauth, and does not regenerate a keypair', async () => {
    const encryptedPrivateKey = await mockedEncryptedBlob();
    const nativeSetup = vi.fn(async () => { throw { code: 'AUTH_FAILED', message: 'biometric cancelled' }; });
    const saveKeyCalls = [];
    installNativePlugin({ setupDeviceUnlock: nativeSetup });
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/api/auth/my-keys')) return { ok: true, json: async () => ({ encryptedPrivateKey, publicKey: encodeBase64(REAL_KP.publicKey) }) };
      if (u.includes('/api/auth/device-enrollment-assertion')) return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
      if (u.includes('save-public-key')) { saveKeyCalls.push(u); return { ok: true, json: async () => ({ success: true }) }; }
      throw new Error(`Unexpected fetch: ${u}`);
    }));

    render(<CryptoProvider><Recovery /></CryptoProvider>);
    screen.getByTestId('unlock').click();

    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'), { timeout: 5000 });
    expect(screen.getByTestId('public-key').textContent).toBe(encodeBase64(REAL_KP.publicKey)); // the REAL key, not a regenerated one
    expect(screen.getByTestId('needs-reauth').textContent).toBe('false');
    expect(screen.getByTestId('error').textContent).toBe(''); // reloadPrivateKeyWithPassword itself did not throw
    await waitFor(() => expect(nativeSetup).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(saveKeyCalls.length).toBe(0); // a keypair was never (re)generated/uploaded
  });
});

// "Require fingerprint every time I open the app" — the mount effect is
// the ONE place this setting is checked (see CryptoContext.jsx's own
// comment on why: it runs exactly once per real app launch/process, never
// on a mere foreground/resume within the same launch). OFF (the default)
// must behave completely unchanged from every test above; ON must discard
// any cached session key and go through the exact same device-unlock/
// reauth-fallback path the existing cold-start branch already implements.
describe('CryptoContext strict "require fingerprint every open" mode', () => {
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
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete window.Capacitor; });

  test('OFF (default): a cached session key is used directly — no native call, no network call at all', async () => {
    await saveKeyToSession(REAL_KP.secretKey);
    const nativeUnlock = vi.fn();
    installNativePlugin({ unlockDeviceKey: nativeUnlock });
    const fetchMock = vi.fn(async () => { throw new Error('should never fetch — a cached session key must short-circuit everything'); });
    vi.stubGlobal('fetch', fetchMock);

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'));
    expect(screen.getByTestId('public-key').textContent).toBe(REAL_PUB_B64);
    expect(nativeUnlock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('ON: a cached session key is discarded — device unlock (native) is used instead, and succeeds', async () => {
    localStorage.setItem('watch_strict_device_unlock', 'true');
    await saveKeyToSession(REAL_KP.secretKey); // must be ignored under strict mode
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
    expect(nativeUnlock).toHaveBeenCalledTimes(1); // proves the cached session key was NOT what restored this
    // (the restored key IS re-saved to sessionStorage right after — see
    // the existing tryRestoreViaDeviceUnlock success branch — so wt_sk
    // being present again here is expected, not a sign the stale cached
    // key survived; nativeUnlock being called at all is the real proof.)
  });

  test('ON: device unlock fails (e.g. biometric cancelled) — falls back to reauth exactly like the existing cold-start path, never silently restores the stale cached key', async () => {
    localStorage.setItem('watch_strict_device_unlock', 'true');
    await saveKeyToSession(REAL_KP.secretKey);
    const nativeUnlock = vi.fn(async () => { throw { code: 'AUTH_FAILED', message: 'biometric cancelled' }; });
    installNativePlugin({ unlockDeviceKey: nativeUnlock });
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const my = myKeysHandler(url);
      if (my) return my;
      if (String(url).includes('/api/auth/device-enrollment-assertion')) return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
      throw new Error(`Unexpected fetch in test: ${url}`);
    }));

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('needs-reauth').textContent).toBe('true'));
    expect(screen.getByTestId('keypair-state').textContent).toBe('null'); // never fell back to the discarded cached key
  });

  test('ON but browser (no window.Capacitor): strict mode has no effect — a cached session key is still used directly, same as OFF', async () => {
    localStorage.setItem('watch_strict_device_unlock', 'true');
    await saveKeyToSession(REAL_KP.secretKey);
    // Deliberately no installNativePlugin() — window.Capacitor stays unset.
    const fetchMock = vi.fn(async () => { throw new Error('should never fetch on browser with a cached session key'); });
    vi.stubGlobal('fetch', fetchMock);

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'));
    expect(screen.getByTestId('public-key').textContent).toBe(REAL_PUB_B64);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// Profile → Device Unlock → "Require fingerprint every time I open the
// app" toggle. Re-enrollment is required because an Android Keystore key's
// authentication policy is fixed at generation time (see
// E2eeKeyStore.java's buildKeySpec) — this exercises that the setting is
// always persisted, and that a (re-)enrollment with the new policy is
// attempted whenever a real key is already available.
describe('CryptoContext.setDeviceUnlockRequireEveryOpen', () => {
  function ToggleProbe() {
    const { keyPair, setKeyPair, setDeviceUnlockRequireEveryOpen, isDeviceUnlockRequireEveryOpenEnabled } = useCrypto();
    const [settingNow, setSettingNow] = React.useState('');
    return (
      <div>
        <span data-testid="keypair-state">{keyPair ? 'present' : 'null'}</span>
        <span data-testid="setting-now">{settingNow}</span>
        <button data-testid="set-key" onClick={() => setKeyPair({
          publicKey: new Uint8Array(32).fill(1),
          secretKey: new Uint8Array(32).fill(2),
        })}>set key</button>
        <button data-testid="enable" onClick={async () => {
          await setDeviceUnlockRequireEveryOpen(true);
          setSettingNow(String(isDeviceUnlockRequireEveryOpenEnabled()));
        }}>enable</button>
        <button data-testid="disable" onClick={async () => {
          await setDeviceUnlockRequireEveryOpen(false);
          setSettingNow(String(isDeviceUnlockRequireEveryOpenEnabled()));
        }}>disable</button>
      </div>
    );
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    delete window.Capacitor;
    localStorage.setItem('watch_token', fakeToken({ id: 1, username: 'testuser' }));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('/api/auth/device-enrollment-assertion')) return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
      throw new Error(`Unexpected fetch in test: ${url}`);
    }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete window.Capacitor; localStorage.clear(); });

  test('enabling with an established key re-enrolls native with allowOverwrite:true and strict:true, and persists the setting', async () => {
    const nativeSetup = vi.fn(async () => {});
    installNativePlugin({ setupDeviceUnlock: nativeSetup });

    render(<CryptoProvider><ToggleProbe /></CryptoProvider>);
    screen.getByTestId('set-key').click();
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'));

    screen.getByTestId('enable').click();
    await waitFor(() => expect(screen.getByTestId('setting-now').textContent).toBe('true'));
    expect(nativeSetup).toHaveBeenCalledTimes(1);
    const call = nativeSetup.mock.calls[0][0];
    expect(call.allowOverwrite).toBe(true);
    expect(call.strict).toBe(true);
    expect(localStorage.getItem('watch_strict_device_unlock')).toBe('true');
  });

  test('disabling after enabling re-enrolls with strict:false and clears the persisted setting', async () => {
    const nativeSetup = vi.fn(async () => {});
    installNativePlugin({ setupDeviceUnlock: nativeSetup });

    render(<CryptoProvider><ToggleProbe /></CryptoProvider>);
    screen.getByTestId('set-key').click();
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'));

    screen.getByTestId('enable').click();
    await waitFor(() => expect(screen.getByTestId('setting-now').textContent).toBe('true'));
    nativeSetup.mockClear();

    screen.getByTestId('disable').click();
    await waitFor(() => expect(screen.getByTestId('setting-now').textContent).toBe('false'));
    expect(nativeSetup).toHaveBeenCalledTimes(1);
    expect(nativeSetup.mock.calls[0][0].strict).toBe(false);
    expect(localStorage.getItem('watch_strict_device_unlock')).toBeNull();
  });

  test('with no key established yet: the setting is still persisted, but native is never called', async () => {
    const nativeSetup = vi.fn(async () => {});
    installNativePlugin({ setupDeviceUnlock: nativeSetup });

    render(<CryptoProvider><ToggleProbe /></CryptoProvider>);
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('null'));

    screen.getByTestId('enable').click();
    await waitFor(() => expect(screen.getByTestId('setting-now').textContent).toBe('true'));
    expect(nativeSetup).not.toHaveBeenCalled();
    expect(localStorage.getItem('watch_strict_device_unlock')).toBe('true');
  });

  test('browser (no window.Capacitor): setting is persisted, native is never touched', async () => {
    // Deliberately no installNativePlugin().
    render(<CryptoProvider><ToggleProbe /></CryptoProvider>);
    screen.getByTestId('set-key').click();
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'));

    screen.getByTestId('enable').click();
    await waitFor(() => expect(screen.getByTestId('setting-now').textContent).toBe('true'));
    expect(localStorage.getItem('watch_strict_device_unlock')).toBe('true');
  });

  test('a failed re-enroll (e.g. biometric cancelled) does not throw, and the setting is still persisted', async () => {
    const nativeSetup = vi.fn(async () => { throw { code: 'AUTH_FAILED', message: 'biometric cancelled' }; });
    installNativePlugin({ setupDeviceUnlock: nativeSetup });

    render(<CryptoProvider><ToggleProbe /></CryptoProvider>);
    screen.getByTestId('set-key').click();
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'));

    // No try/catch around this click in the probe itself — a thrown error
    // here would surface as an unhandled rejection / failed assertion below.
    screen.getByTestId('enable').click();
    await waitFor(() => expect(screen.getByTestId('setting-now').textContent).toBe('true'));
    expect(localStorage.getItem('watch_strict_device_unlock')).toBe('true');
  });
});

// "Remember this browser" cold-start integration — restore order step 3
// (after warm session, after Android/Windows native, before falling back to
// the passphrase/recovery prompt). unlockViaBrowser/isBrowserDeviceUnlockAvailable
// are mocked at the module boundary (see the vi.mock at the top of this
// file) — browserDeviceUnlock.js's own real WebAuthn/crypto behavior is
// exercised thoroughly in its own test suite; these tests are about
// CryptoContext's ORCHESTRATION of that module: restore-order precedence,
// the verify-before-trust public-key check, and the fallback/never-
// regenerate guarantees every other device-unlock path in this file
// already enforces.
describe('CryptoContext cold-start BROWSER device unlock — restore, never regenerate', () => {
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
    isBrowserDeviceUnlockAvailable.mockReturnValue(true);
    unlockViaBrowser.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete window.Capacitor;
    isBrowserDeviceUnlockAvailable.mockReturnValue(false);
  });

  test('browser available + wrapper resolves + matching public key: key is restored silently, no reauth prompt (mirrors the Android success test)', async () => {
    unlockViaBrowser.mockImplementation(async () => REAL_KP.secretKey);
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const my = myKeysHandler(url);
      if (my) return my;
      throw new Error(`Unexpected fetch in test: ${url}`);
    }));

    render(<CryptoProvider><Probe /></CryptoProvider>);

    // Real, deliberately slow 600k-iteration PBKDF2 (saveKeyToSession ->
    // crypto.js) runs on this success path, same documented allowance the
    // Android equivalent test above already needs.
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'), { timeout: 5000 });
    expect(screen.getByTestId('needs-reauth').textContent).toBe('false');
    expect(screen.getByTestId('public-key').textContent).toBe(REAL_PUB_B64);
    expect(unlockViaBrowser).toHaveBeenCalledTimes(1);
  });

  // Test 10 (spec list): new browser with no wrapper falls back to passphrase.
  test('no local wrapper on this browser (NO_LOCAL_WRAPPER): falls back to reauth, no key generated, no fetch beyond my-keys', async () => {
    unlockViaBrowser.mockImplementation(async () => { throw Object.assign(new Error('no wrapper'), { code: 'NO_LOCAL_WRAPPER' }); });
    const fetchMock = vi.fn(async (url) => {
      const my = myKeysHandler(url);
      if (my) return my;
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('needs-reauth').textContent).toBe('true'));
    expect(screen.getByTestId('keypair-state').textContent).toBe('null');
    expect(unlockViaBrowser).toHaveBeenCalledTimes(1);
    // Test 9: never grounds for a new keypair.
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('save-public-key'), expect.anything());
  });

  // Test 8: browser unlock failure (any reason) falls back to passphrase.
  test('browser unlock ceremony fails (GET_FAILED — cancelled/no authenticator): falls back to reauth', async () => {
    unlockViaBrowser.mockImplementation(async () => { throw Object.assign(new Error('cancelled'), { code: 'GET_FAILED' }); });
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const my = myKeysHandler(url);
      if (my) return my;
      throw new Error(`Unexpected fetch in test: ${url}`);
    }));

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('needs-reauth').textContent).toBe('true'));
    expect(screen.getByTestId('keypair-state').textContent).toBe('null');
  });

  // Test 7: public-key mismatch rejects recovered key.
  test('unlockViaBrowser resolves a key that does NOT match the server public key: rejected, falls back to reauth, never trusted', async () => {
    const wrongKp = nacl.box.keyPair();
    unlockViaBrowser.mockImplementation(async () => wrongKp.secretKey);
    const fetchMock = vi.fn(async (url) => {
      const my = myKeysHandler(url);
      if (my) return my;
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('needs-reauth').textContent).toBe('true'));
    expect(screen.getByTestId('keypair-state').textContent).toBe('null');
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('save-public-key'), expect.anything());
  });

  test('restore-order precedence: Android/Windows native succeeding means browser unlock is never even attempted', async () => {
    const nativeUnlock = vi.fn(async () => ({ secretKeyBase64: encodeBase64(REAL_KP.secretKey) }));
    window.Capacitor = { isNativePlatform: () => true, Plugins: { SahaplayE2ee: { unlockDeviceKey: nativeUnlock } } };
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const my = myKeysHandler(url);
      if (my) return my;
      if (String(url).includes('/api/auth/device-enrollment-assertion')) {
        return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    }));

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe('present'), { timeout: 5000 });
    expect(screen.getByTestId('needs-reauth').textContent).toBe('false');
    expect(nativeUnlock).toHaveBeenCalledTimes(1);
    expect(unlockViaBrowser).not.toHaveBeenCalled();
  });

  test('browser unavailable (isBrowserDeviceUnlockAvailable false — e.g. unsupported browser): behaves exactly like before this feature existed, no attempt made', async () => {
    isBrowserDeviceUnlockAvailable.mockReturnValue(false);
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const my = myKeysHandler(url);
      if (my) return my;
      throw new Error(`Unexpected fetch in test: ${url}`);
    }));

    render(<CryptoProvider><Probe /></CryptoProvider>);

    await waitFor(() => expect(screen.getByTestId('needs-reauth').textContent).toBe('true'));
    expect(screen.getByTestId('keypair-state').textContent).toBe('null');
    expect(unlockViaBrowser).not.toHaveBeenCalled();
  });
});
