import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import { CryptoProvider, useCrypto } from '../contexts/CryptoContext';
import EncryptionUnlockGate from './EncryptionUnlockGate';

// Stage 4 (device unlock): EncryptionUnlockGate is the single choke point
// both 'encryption_needs_passphrase' dispatch sites (Login.jsx, and
// CryptoContext's switchToPassphraseUnlock via KeyRecoveryModal) funnel
// through — these tests exercise its real event handling (not a
// re-implementation), with window.Capacitor and fetch mocked.

function Probe() {
  const { keyPair } = useCrypto();
  return <span data-testid="keypair-state">{keyPair ? encodeBase64(keyPair.publicKey) : 'null'}</span>;
}

function installNativePlugin(pluginMock) {
  window.Capacitor = {
    isNativePlatform: () => true,
    Plugins: { SahaplayE2ee: pluginMock },
  };
}

function fakeToken(payload) {
  const b64url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'HS256' })}.${b64url(payload)}.fakesignature`;
}

function fireNeedsPassphrase(detail) {
  window.dispatchEvent(new CustomEvent('encryption_needs_passphrase', { detail }));
}

describe('EncryptionUnlockGate — device-unlock shortcut for the independent-passphrase prompt', () => {
  const REAL_KP = nacl.box.keyPair();
  const REAL_PUB_B64 = encodeBase64(REAL_KP.publicKey);

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    delete window.Capacitor;
    // No watch_token set -> CryptoProvider's own mount effect takes the
    // guest branch and settles quickly with an unrelated identity, which is
    // fine: these tests only assert on what happens AFTER the event fires.
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete window.Capacitor;
  });

  test('browser (no window.Capacitor): shows the passphrase modal immediately, device unlock never attempted', async () => {
    render(<CryptoProvider><Probe /><EncryptionUnlockGate /></CryptoProvider>);
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).not.toBe('null'));

    fireNeedsPassphrase({ encryptedPrivateKey: 'server-blob', publicKey: REAL_PUB_B64, token: fakeToken({ id: 1 }) });

    await waitFor(() => expect(screen.getByPlaceholderText(/Min 8 characters/i)).toBeInTheDocument());
  });

  test('Android + enrolled + matching public key: modal never appears, key is restored via device unlock', async () => {
    const nativeUnlock = vi.fn(async () => ({ secretKeyBase64: encodeBase64(REAL_KP.secretKey) }));
    installNativePlugin({ unlockDeviceKey: nativeUnlock });
    const token = fakeToken({ id: 7, username: 'alice' });
    localStorage.setItem('watch_token', token);
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('/api/auth/my-keys')) {
        // CryptoProvider's own mount effect also runs against this token;
        // an unrelated 'no key yet' response just lets it settle quickly
        // with its own (irrelevant to this test) auto-generated identity.
        return { ok: true, json: async () => ({ publicKey: null, encryptedPrivateKey: null }) };
      }
      if (String(url).includes('/api/auth/device-enrollment-assertion')) {
        return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    }));

    render(<CryptoProvider><Probe /><EncryptionUnlockGate /></CryptoProvider>);
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).not.toBe('null'));

    fireNeedsPassphrase({ encryptedPrivateKey: 'server-blob', publicKey: REAL_PUB_B64, token });

    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe(REAL_PUB_B64));
    expect(screen.queryByPlaceholderText(/Min 8 characters/i)).not.toBeInTheDocument();
    expect(nativeUnlock).toHaveBeenCalledTimes(1);
  });

  test('Android device unlock returns a key that does not match the server public key: rejected, falls back to the passphrase modal', async () => {
    const wrongKp = nacl.box.keyPair();
    const nativeUnlock = vi.fn(async () => ({ secretKeyBase64: encodeBase64(wrongKp.secretKey) }));
    installNativePlugin({ unlockDeviceKey: nativeUnlock });
    const token = fakeToken({ id: 7 });
    localStorage.setItem('watch_token', token);
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('/api/auth/my-keys')) {
        // CryptoProvider's own mount effect also runs against this token;
        // an unrelated 'no key yet' response just lets it settle quickly
        // with its own (irrelevant to this test) auto-generated identity.
        return { ok: true, json: async () => ({ publicKey: null, encryptedPrivateKey: null }) };
      }
      if (String(url).includes('/api/auth/device-enrollment-assertion')) {
        return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    }));

    render(<CryptoProvider><Probe /><EncryptionUnlockGate /></CryptoProvider>);
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).not.toBe('null'));

    fireNeedsPassphrase({ encryptedPrivateKey: 'server-blob', publicKey: REAL_PUB_B64, token });

    await waitFor(() => expect(screen.getByPlaceholderText(/Min 8 characters/i)).toBeInTheDocument());
    expect(screen.getByTestId('keypair-state').textContent).not.toBe(REAL_PUB_B64);
  });

  test('Android device unlock fails (not enrolled / native error): falls back to the passphrase modal, no raw error surfaced to keyPair state', async () => {
    const nativeUnlock = vi.fn(async () => { throw { code: 'NO_KEY_FOR_ACCOUNT', message: 'not enrolled' }; });
    installNativePlugin({ unlockDeviceKey: nativeUnlock });
    const token = fakeToken({ id: 7 });
    localStorage.setItem('watch_token', token);
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('/api/auth/my-keys')) {
        // CryptoProvider's own mount effect also runs against this token;
        // an unrelated 'no key yet' response just lets it settle quickly
        // with its own (irrelevant to this test) auto-generated identity.
        return { ok: true, json: async () => ({ publicKey: null, encryptedPrivateKey: null }) };
      }
      if (String(url).includes('/api/auth/device-enrollment-assertion')) {
        return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    }));

    render(<CryptoProvider><Probe /><EncryptionUnlockGate /></CryptoProvider>);
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).not.toBe('null'));

    fireNeedsPassphrase({ encryptedPrivateKey: 'server-blob', publicKey: REAL_PUB_B64, token });

    await waitFor(() => expect(screen.getByPlaceholderText(/Min 8 characters/i)).toBeInTheDocument());
  });
});
