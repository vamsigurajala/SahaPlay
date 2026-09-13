import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import { encryptPrivateKey } from './lib/crypto.js';
import { CryptoProvider } from './contexts/CryptoContext';
import Login from './Login';

// Stage 5 fix: Login.jsx is the missing half of the device-unlock feature —
// every place it successfully obtains this account's real E2EE secret key
// now also calls enrollDeviceUnlockSilently() (see CryptoContext.jsx's own
// doc comment) so a real Android install can actually remember the device
// key after the first login. These tests exercise Login.jsx's real
// handleLogin against a real <CryptoProvider>, mocking only the
// third-party/native dependencies (react-router-dom, @react-oauth/google,
// SeoHead/react-helmet-async, RecoveryPhraseModal, OAuthEncryptionModal,
// nativeGoogleAuth, nativePush) that would otherwise need their own
// provider setup unrelated to what's under test here — fetch, native
// Capacitor plugin, and the actual CryptoContext are all real.
const navigateSpy = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateSpy,
  useLocation: () => ({ state: {}, search: '' }),
  Link: ({ children, ...props }) => <a {...props}>{children}</a>,
}));
vi.mock('@react-oauth/google', () => ({ GoogleLogin: () => null }));
vi.mock('./components/SeoHead', () => ({ default: () => null }));
vi.mock('./components/RecoveryPhraseModal', () => ({ default: () => null }));
vi.mock('./components/OAuthEncryptionModal', () => ({ default: () => null }));
vi.mock('./lib/nativeGoogleAuth', () => ({ openNativeGoogleSignIn: vi.fn() }));
vi.mock('./lib/nativePush', () => ({ resyncPushTokenAfterLogin: vi.fn() }));

function installNativePlugin(pluginMock) {
  window.Capacitor = {
    isNativePlatform: () => true,
    Plugins: { SahaplayE2ee: pluginMock },
  };
}

function decodeBase64ToBytes(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function submitLoginForm(username, password) {
  const usernameInput = screen.getByPlaceholderText('name@example.com');
  const passwordInput = screen.getByPlaceholderText('••••••••');
  fireEvent.change(usernameInput, { target: { value: username } });
  fireEvent.change(passwordInput, { target: { value: password } });
  fireEvent.submit(passwordInput.closest('form'));
}

function renderLogin() {
  return render(<CryptoProvider><Login /></CryptoProvider>);
}

describe('Login.jsx — device unlock enrollment wired into every successful key-acquisition path', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    delete window.Capacitor;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete window.Capacitor;
  });

  test('A. existing (non-migrated) password account: login password decrypts the existing key -> enrollDeviceUnlockSilently native setup called exactly once, with the real secret key', async () => {
    const realKp = nacl.box.keyPair();
    const encryptedPrivateKey = await encryptPrivateKey(realKp.secretKey, 'correct horse battery staple');
    const token = 'header.' + btoa(JSON.stringify({ id: 5, username: 'alice' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '.sig';

    const nativeSetup = vi.fn(async () => ({}));
    installNativePlugin({ setupDeviceUnlock: nativeSetup });

    const fetchMock = vi.fn(async (url, opts) => {
      const u = String(url);
      if (u.includes('/api/login')) {
        return { ok: true, json: async () => ({ token, username: 'alice', role: 'user', encryptedPrivateKey, publicKey: encodeBase64(realKp.publicKey) }) };
      }
      if (u.includes('/api/auth/device-enrollment-assertion')) {
        return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
      }
      throw new Error(`Unexpected fetch in test: ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderLogin();
    await submitLoginForm('alice', 'correct horse battery staple');

    // decryptPrivateKey is real PBKDF2-SHA256 at 600k iterations (crypto.js,
    // deliberately slow, OWASP 2024 guidance) — under full-suite CPU
    // contention this occasionally exceeds waitFor's default 1000ms, same
    // documented allowance CryptoContext.test.jsx already uses for the
    // same reason.
    await waitFor(() => expect(nativeSetup).toHaveBeenCalledTimes(1), { timeout: 5000 });
    const [[setupArg]] = nativeSetup.mock.calls;
    expect(decodeBase64ToBytes(setupArg.secretKeyBase64)).toEqual(realKp.secretKey);
    expect(setupArg.allowOverwrite).toBe(false);
  });

  test('E. brand-new password account: after the fresh keypair is created and uploaded, enrollDeviceUnlockSilently is called exactly once', async () => {
    const token = 'header.' + btoa(JSON.stringify({ id: 9, username: 'newperson' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '.sig';
    const nativeSetup = vi.fn(async () => ({}));
    installNativePlugin({ setupDeviceUnlock: nativeSetup });

    const fetchMock = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/api/login')) {
        return { ok: true, json: async () => ({ token, username: 'newperson', role: 'user', encryptedPrivateKey: null, publicKey: null }) };
      }
      if (u.includes('/api/auth/setup-keys')) {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (u.includes('/api/auth/device-enrollment-assertion')) {
        return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
      }
      throw new Error(`Unexpected fetch in test: ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderLogin();
    await submitLoginForm('newperson', 'brand-new-password');

    // encryptPrivateKey (wrapping the brand-new key) is the same real,
    // deliberately slow PBKDF2 operation — see the timeout note above.
    await waitFor(() => expect(nativeSetup).toHaveBeenCalledTimes(1), { timeout: 5000 });
  });

  test('F. browser (no window.Capacitor): existing-account login never attempts native enrollment', async () => {
    const realKp = nacl.box.keyPair();
    const encryptedPrivateKey = await encryptPrivateKey(realKp.secretKey, 'correct horse battery staple');
    const token = 'header.' + btoa(JSON.stringify({ id: 5, username: 'alice' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '.sig';

    // Deliberately no installNativePlugin() — window.Capacitor stays unset.
    const fetchMock = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/api/login')) {
        return { ok: true, json: async () => ({ token, username: 'alice', role: 'user', encryptedPrivateKey, publicKey: encodeBase64(realKp.publicKey) }) };
      }
      throw new Error(`Unexpected fetch in test: ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderLogin();
    await submitLoginForm('alice', 'correct horse battery staple');

    await waitFor(() => expect(navigateSpy).toHaveBeenCalled());
    // Give the async decrypt/enroll microtasks a chance to run (real,
    // deliberately slow PBKDF2 — see the timeout note above), then confirm
    // the assertion endpoint (the only way enrollment could have reached
    // the network) was never hit.
    await new Promise(r => setTimeout(r, 1200));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('device-enrollment-assertion'), expect.anything());
  });

  test('G. enrollment failure does not fail login or affect the established key', async () => {
    const realKp = nacl.box.keyPair();
    const encryptedPrivateKey = await encryptPrivateKey(realKp.secretKey, 'correct horse battery staple');
    const token = 'header.' + btoa(JSON.stringify({ id: 5, username: 'alice' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '.sig';

    const nativeSetup = vi.fn(async () => { throw { code: 'HARDWARE_UNAVAILABLE', message: 'Keystore unavailable' }; });
    installNativePlugin({ setupDeviceUnlock: nativeSetup });

    const fetchMock = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/api/login')) {
        return { ok: true, json: async () => ({ token, username: 'alice', role: 'user', encryptedPrivateKey, publicKey: encodeBase64(realKp.publicKey) }) };
      }
      if (u.includes('/api/auth/device-enrollment-assertion')) {
        return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
      }
      throw new Error(`Unexpected fetch in test: ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderLogin();
    await submitLoginForm('alice', 'correct horse battery staple');

    await waitFor(() => expect(nativeSetup).toHaveBeenCalledTimes(1), { timeout: 5000 });
    // Login itself is unaffected — no error surfaced, navigate() still fired.
    expect(navigateSpy).toHaveBeenCalled();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});
