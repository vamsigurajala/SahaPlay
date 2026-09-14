import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
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
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).not.toBe('null'), { timeout: 5000 });

    fireNeedsPassphrase({ encryptedPrivateKey: 'server-blob', publicKey: REAL_PUB_B64, token: fakeToken({ id: 1 }) });

    await waitFor(() => expect(screen.getByPlaceholderText(/Min 8 characters/i)).toBeInTheDocument());
  });

  test('Android + enrolled + matching public key: modal never appears, key is restored via device unlock, and no re-enrollment attempt is made (avoids double enrollment)', async () => {
    const nativeUnlock = vi.fn(async () => ({ secretKeyBase64: encodeBase64(REAL_KP.secretKey) }));
    // Deliberately no setupDeviceUnlock yet — CryptoProvider's own mount
    // effect also runs against this token (see the my-keys mock below) and,
    // since Stage 5, silently attempts to enroll ITS OWN irrelevant
    // auto-generated identity too. Attaching the setupDeviceUnlock spy only
    // AFTER that mount-time settling keeps this test's assertions about
    // ONLY what happens next (the device-unlock-shortcut path).
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

    const nativeSetup = vi.fn(async () => ({}));
    window.Capacitor.Plugins.SahaplayE2ee.setupDeviceUnlock = nativeSetup;

    fireNeedsPassphrase({ encryptedPrivateKey: 'server-blob', publicKey: REAL_PUB_B64, token });

    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe(REAL_PUB_B64));
    expect(screen.queryByPlaceholderText(/Min 8 characters/i)).not.toBeInTheDocument();
    expect(nativeUnlock).toHaveBeenCalledTimes(1);
    // Give any stray fire-and-forget enrollment microtask a tick, then
    // confirm it never fired — this key was already restored FROM an
    // existing device wrapper, so re-enrolling would be a pointless
    // redundant native round-trip on every single warm/cold start.
    await new Promise(r => setTimeout(r, 20));
    expect(nativeSetup).not.toHaveBeenCalled();
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
    // CryptoProvider's own mount-effect auto-generation calls saveKeyToSession,
    // which wraps the key with a real, deliberately slow 600k-iteration
    // PBKDF2 (crypto.js) — can occasionally exceed waitFor's default 1000ms
    // under CPU contention (same documented allowance used elsewhere, e.g.
    // Login.test.jsx / CryptoContext.test.jsx).
    await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).not.toBe('null'), { timeout: 5000 });

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

  // Stage 5 fix: the two real success paths through THIS component's own
  // passphrase-prompt fallback UI — B (migrated account, passphrase
  // unlock) and C (recovery phrase) — are exactly where the missing
  // enrollment call was wired in.
  describe('device unlock enrollment wired into the passphrase-prompt success paths', () => {
    test('B. successful encryption-passphrase unlock (handleUnlock) enrolls device unlock exactly once, with the real secret key', async () => {
      // No setupDeviceUnlock yet — see the comment on the earlier "avoids
      // double enrollment" test for why the spy is attached only after
      // CryptoProvider's own mount-time settling (its irrelevant
      // auto-generated identity would otherwise also try to enroll and
      // contaminate the call count/argument assertions below).
      installNativePlugin({});
      const token = fakeToken({ id: 12, username: 'bob' });
      localStorage.setItem('watch_token', token);
      vi.stubGlobal('fetch', vi.fn(async (url) => {
        if (String(url).includes('/api/auth/my-keys')) {
          return { ok: true, json: async () => ({ publicKey: null, encryptedPrivateKey: null }) };
        }
        if (String(url).includes('/api/auth/device-enrollment-assertion')) {
          return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
      }));

      const { encryptPrivateKey } = await import('../lib/crypto.js');
      const encryptedPrivateKey = await encryptPrivateKey(REAL_KP.secretKey, 'my-encryption-passphrase');

      render(<CryptoProvider><Probe /><EncryptionUnlockGate /></CryptoProvider>);
      await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).not.toBe('null'));

      const nativeSetup = vi.fn(async () => ({}));
      window.Capacitor.Plugins.SahaplayE2ee.setupDeviceUnlock = nativeSetup;

      fireNeedsPassphrase({ encryptedPrivateKey, publicKey: REAL_PUB_B64, token });
      const passphraseInput = await screen.findByPlaceholderText(/Min 8 characters/i);
      fireEvent.change(passphraseInput, { target: { value: 'my-encryption-passphrase' } });
      fireEvent.submit(passphraseInput.closest('form'));

      await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe(REAL_PUB_B64));
      await waitFor(() => expect(nativeSetup).toHaveBeenCalledTimes(1));
      const [[setupArg]] = nativeSetup.mock.calls;
      expect(decodeBase64(setupArg.secretKeyBase64)).toEqual(REAL_KP.secretKey);
      expect(setupArg.allowOverwrite).toBe(false);
    });

    test('C. successful recovery-phrase recovery (handleRecover) enrolls device unlock exactly once', async () => {
      const RECOVERY_PHRASE = 'ABCDEFGHIJKLMNOPQRSTUVWX';
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(RECOVERY_PHRASE.trim().toLowerCase()));
      const recoveryKp = nacl.box.keyPair.fromSecretKey(new Uint8Array(hashBuf));
      const recoveryPubB64 = encodeBase64(recoveryKp.publicKey);

      installNativePlugin({});
      const token = fakeToken({ id: 13, username: 'carol' });
      localStorage.setItem('watch_token', token);
      vi.stubGlobal('fetch', vi.fn(async (url) => {
        if (String(url).includes('/api/auth/my-keys')) {
          return { ok: true, json: async () => ({ publicKey: null, encryptedPrivateKey: null }) };
        }
        if (String(url).includes('/api/auth/device-enrollment-assertion')) {
          return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
        }
        if (String(url).includes('/api/auth/setup-keys')) {
          return { ok: true, json: async () => ({ success: true }) };
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
      }));

      render(<CryptoProvider><Probe /><EncryptionUnlockGate /></CryptoProvider>);
      // Real, deliberately slow 600k-iteration PBKDF2 (crypto.js) runs as
      // part of this mount — can occasionally exceed waitFor's default
      // 1000ms under full-suite CPU contention (same documented allowance
      // used elsewhere in this file/CryptoContext.test.jsx).
      await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).not.toBe('null'), { timeout: 5000 });

      const nativeSetup = vi.fn(async () => ({}));
      window.Capacitor.Plugins.SahaplayE2ee.setupDeviceUnlock = nativeSetup;

      fireNeedsPassphrase({ encryptedPrivateKey: 'server-blob', publicKey: recoveryPubB64, token });
      await screen.findByPlaceholderText(/Min 8 characters/i);
      fireEvent.click(screen.getByText(/forgot passphrase/i));

      const recoveryInput = await screen.findByPlaceholderText(/ABCDEFGH/i);
      fireEvent.change(recoveryInput, { target: { value: RECOVERY_PHRASE } });
      fireEvent.change(screen.getByPlaceholderText(`Min 8 characters`), { target: { value: 'brand-new-passphrase' } });
      fireEvent.change(screen.getByPlaceholderText(/Re-enter passphrase/i), { target: { value: 'brand-new-passphrase' } });
      fireEvent.submit(recoveryInput.closest('form'));

      await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe(recoveryPubB64));
      await waitFor(() => expect(nativeSetup).toHaveBeenCalledTimes(1));
      const [[setupArg]] = nativeSetup.mock.calls;
      expect(decodeBase64(setupArg.secretKeyBase64)).toEqual(recoveryKp.secretKey);
    });

    test('enrollment failure during handleUnlock does not fail the unlock or affect the restored key', async () => {
      installNativePlugin({});
      const token = fakeToken({ id: 14, username: 'dave' });
      localStorage.setItem('watch_token', token);
      vi.stubGlobal('fetch', vi.fn(async (url) => {
        if (String(url).includes('/api/auth/my-keys')) {
          return { ok: true, json: async () => ({ publicKey: null, encryptedPrivateKey: null }) };
        }
        if (String(url).includes('/api/auth/device-enrollment-assertion')) {
          return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
      }));

      const { encryptPrivateKey } = await import('../lib/crypto.js');
      const encryptedPrivateKey = await encryptPrivateKey(REAL_KP.secretKey, 'my-encryption-passphrase');

      render(<CryptoProvider><Probe /><EncryptionUnlockGate /></CryptoProvider>);
      await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).not.toBe('null'), { timeout: 5000 });

      const nativeSetup = vi.fn(async () => { throw { code: 'HARDWARE_UNAVAILABLE', message: 'Keystore unavailable' }; });
      window.Capacitor.Plugins.SahaplayE2ee.setupDeviceUnlock = nativeSetup;

      fireNeedsPassphrase({ encryptedPrivateKey, publicKey: REAL_PUB_B64, token });
      const passphraseInput = await screen.findByPlaceholderText(/Min 8 characters/i);
      fireEvent.change(passphraseInput, { target: { value: 'my-encryption-passphrase' } });
      fireEvent.submit(passphraseInput.closest('form'));

      // Unlock still succeeds (keyPair is the real, correct key) even though
      // enrollment underneath it fails.
      await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe(REAL_PUB_B64));
      await waitFor(() => expect(nativeSetup).toHaveBeenCalledTimes(1));
      expect(screen.queryByText(/hardware.*unavailable/i)).not.toBeInTheDocument();
    });
  });
});
