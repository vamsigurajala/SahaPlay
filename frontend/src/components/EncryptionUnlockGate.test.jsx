import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import toast from 'react-hot-toast';
import { CryptoProvider, useCrypto } from '../contexts/CryptoContext';
import EncryptionUnlockGate from './EncryptionUnlockGate';

// Stage 4 (device unlock): EncryptionUnlockGate is the single choke point
// both 'encryption_needs_passphrase' dispatch sites (Login.jsx, and
// CryptoContext's switchToPassphraseUnlock via KeyRecoveryModal) funnel
// through — these tests exercise its real event handling (not a
// re-implementation), with window.Capacitor and fetch mocked.

// react-hot-toast normally renders into a <Toaster/> nobody mounts in these
// tests — mocked so "Remember this browser" enrollment-failure tests below
// can assert the user-visible toast fired without needing a real portal.
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// Mocked file-wide, same convention as CryptoContext.test.jsx's own mock of
// this module. Default state (isBrowserDeviceUnlockAvailable -> false)
// matches what the REAL module already returns in every other test in this
// file (plain jsdom has no window.PublicKeyCredential) — so every test above
// the dedicated "Remember this browser" describe block below keeps behaving
// exactly as it did before browser device unlock existed: the checkbox
// never renders, rememberBrowser is always false, enrollBrowser is never
// called.
vi.mock('../lib/browserDeviceUnlock.js', () => ({
  isBrowserDeviceUnlockAvailable: vi.fn(() => false),
  hasBrowserDeviceUnlock: vi.fn(async () => false),
  unlockViaBrowser: vi.fn(async () => { throw new Error('not mocked in this test'); }),
  enrollBrowser: vi.fn(async () => { throw new Error('not mocked in this test'); }),
  forgetBrowser: vi.fn(async () => {}),
  describeBrowserDeviceUnlockError: vi.fn((e) => ({
    code: e?.code ?? null,
    name: e?.originalName ?? e?.name ?? null,
    message: e?.originalMessage ?? e?.message ?? null,
  })),
  // Real logic (not a stub) — these tests assert on the PRF-specific vs.
  // generic message CHOICE, so the classifier itself must behave exactly
  // like the real browserDeviceUnlock.js implementation does.
  isPrfUnsupportedError: vi.fn((e) => e?.code === 'PRF_NOT_SUPPORTED' || e?.code === 'PRF_NOT_CONFIRMED'),
}));

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

  // Root-cause report follow-up (production CREATE_FAILED investigation):
  // this exact modal (OAuthEncryptionModal's "unlock" mode, mounted here)
  // used to catch a failed "Remember this browser" enrollment with only
  // console.warn and silently close — the user had no way to know it
  // didn't work. These tests exercise the fix: a user-visible toast, and
  // confirm the failure still never affects the real unlock/recovery
  // outcome or generates a new E2EE identity.
  describe('"Remember this browser" enrollment failure is surfaced to the user (browser WebAuthn path)', () => {
    beforeEach(async () => {
      const { isBrowserDeviceUnlockAvailable, enrollBrowser } = await import('../lib/browserDeviceUnlock.js');
      isBrowserDeviceUnlockAvailable.mockReturnValue(true); // makes OAuthEncryptionModal render the checkbox
      enrollBrowser.mockReset();
    });

    afterEach(async () => {
      const { isBrowserDeviceUnlockAvailable, enrollBrowser } = await import('../lib/browserDeviceUnlock.js');
      isBrowserDeviceUnlockAvailable.mockReturnValue(false); // restore the default every other test in this file relies on
      enrollBrowser.mockReset();
      enrollBrowser.mockRejectedValue(new Error('not mocked in this test'));
      toast.error.mockClear();
      toast.success.mockClear();
    });

    test('handleUnlock: enrollBrowser rejecting (e.g. the real CREATE_FAILED reproduced in production) shows a visible error, never implies the E2EE key was lost, and the real unlock still succeeds', async () => {
      const { enrollBrowser } = await import('../lib/browserDeviceUnlock.js');
      // Shape a real BrowserDeviceUnlockError would have after the Task 1
      // fix: .code plus the preserved original DOMException name/message.
      enrollBrowser.mockRejectedValue({
        code: 'CREATE_FAILED',
        message: 'The operation either timed out or was not allowed.',
        originalName: 'NotAllowedError',
        originalMessage: 'The operation either timed out or was not allowed.',
      });

      installNativePlugin({});
      const token = fakeToken({ id: 20, username: 'erin' });
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

      // Attached only after mount-time settling (see the "avoids double
      // enrollment" test's own comment above for why) — isolates the claim
      // under test to "does the browser-enrollment-FAILURE path itself ever
      // generate a new E2EE keypair", not CryptoProvider's unrelated
      // mount-time auto-generation for a brand-new account.
      const cryptoLib = await import('../lib/crypto.js');
      const generateKeyPairSpy = vi.spyOn(cryptoLib, 'generateKeyPair');

      fireNeedsPassphrase({ encryptedPrivateKey, publicKey: REAL_PUB_B64, token });
      const passphraseInput = await screen.findByPlaceholderText(/Min 8 characters/i);
      fireEvent.change(passphraseInput, { target: { value: 'my-encryption-passphrase' } });
      fireEvent.click(screen.getByRole('checkbox')); // "Remember this browser"
      fireEvent.submit(passphraseInput.closest('form'));

      // The real unlock succeeds regardless of the enrollment failure.
      await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe(REAL_PUB_B64));
      await waitFor(() => expect(enrollBrowser).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(toast.error).toHaveBeenCalled());

      const [message] = toast.error.mock.calls[0];
      expect(message).toMatch(/couldn.t remember this browser/i);
      expect(message).toMatch(/password again next time/i);
      // Never implies the E2EE key/identity itself was lost or needs recovery.
      expect(message).not.toMatch(/lost|deleted|gone|recover your (key|account)/i);

      expect(generateKeyPairSpy).not.toHaveBeenCalled();
      generateKeyPairSpy.mockRestore();
    });

    test('handleRecover: enrollBrowser rejecting shows the same visible error; recovery itself still succeeds and no new keypair is generated', async () => {
      const { enrollBrowser } = await import('../lib/browserDeviceUnlock.js');
      // A non-PRF failure code deliberately — this test is about the
      // GENERIC failure message on the recovery path; the dedicated PRF
      // describe-block tests below cover the PRF-specific message.
      enrollBrowser.mockRejectedValue({
        code: 'REGISTER_VERIFY_FAILED',
        message: 'Registration verification failed',
      });

      const RECOVERY_PHRASE = 'ABCDEFGHIJKLMNOPQRSTUVWX';
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(RECOVERY_PHRASE.trim().toLowerCase()));
      const recoveryKp = nacl.box.keyPair.fromSecretKey(new Uint8Array(hashBuf));
      const recoveryPubB64 = encodeBase64(recoveryKp.publicKey);

      installNativePlugin({});
      const token = fakeToken({ id: 21, username: 'frank' });
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
      await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).not.toBe('null'), { timeout: 5000 });

      const cryptoLib = await import('../lib/crypto.js');
      const generateKeyPairSpy = vi.spyOn(cryptoLib, 'generateKeyPair');

      fireNeedsPassphrase({ encryptedPrivateKey: 'server-blob', publicKey: recoveryPubB64, token });
      await screen.findByPlaceholderText(/Min 8 characters/i);
      fireEvent.click(screen.getByText(/forgot passphrase/i));

      const recoveryInput = await screen.findByPlaceholderText(/ABCDEFGH/i);
      fireEvent.change(recoveryInput, { target: { value: RECOVERY_PHRASE } });
      fireEvent.change(screen.getByPlaceholderText(`Min 8 characters`), { target: { value: 'brand-new-passphrase' } });
      fireEvent.change(screen.getByPlaceholderText(/Re-enter passphrase/i), { target: { value: 'brand-new-passphrase' } });
      fireEvent.click(screen.getByRole('checkbox')); // "Remember this browser"
      fireEvent.submit(recoveryInput.closest('form'));

      await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe(recoveryPubB64));
      await waitFor(() => expect(enrollBrowser).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      expect(toast.error.mock.calls[0][0]).toMatch(/couldn.t remember this browser/i);

      expect(generateKeyPairSpy).not.toHaveBeenCalled();
      generateKeyPairSpy.mockRestore();
    });

    test('enrollBrowser succeeding shows no error toast (regression guard on the new wiring)', async () => {
      const { enrollBrowser } = await import('../lib/browserDeviceUnlock.js');
      enrollBrowser.mockResolvedValue({ credentialId: 'fake-credential-id' });

      installNativePlugin({});
      const token = fakeToken({ id: 22, username: 'grace' });
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

      fireNeedsPassphrase({ encryptedPrivateKey, publicKey: REAL_PUB_B64, token });
      const passphraseInput = await screen.findByPlaceholderText(/Min 8 characters/i);
      fireEvent.change(passphraseInput, { target: { value: 'my-encryption-passphrase' } });
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.submit(passphraseInput.closest('form'));

      await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe(REAL_PUB_B64));
      await waitFor(() => expect(enrollBrowser).toHaveBeenCalledTimes(1));
      expect(toast.error).not.toHaveBeenCalled();
    });

    // PRF-specific messaging follow-up: when the device/authenticator
    // itself is the reason enrollment can't work (confirmed in production:
    // create() succeeds, PRF is never enabled — see browserDeviceUnlock.js's
    // isPrfUnsupportedError doc comment), the user should see a message
    // that says so specifically, not the generic "couldn't remember this
    // browser" wording that implies a transient/retryable failure.
    test('enrollBrowser rejecting with PRF_NOT_SUPPORTED shows the PRF-specific message, not the generic one; unlock still succeeds; no new keypair generated', async () => {
      const { enrollBrowser } = await import('../lib/browserDeviceUnlock.js');
      enrollBrowser.mockRejectedValue({ code: 'PRF_NOT_SUPPORTED', message: 'This browser/authenticator does not support the WebAuthn PRF extension.' });

      installNativePlugin({});
      const token = fakeToken({ id: 23, username: 'heidi' });
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

      const cryptoLib = await import('../lib/crypto.js');
      const generateKeyPairSpy = vi.spyOn(cryptoLib, 'generateKeyPair');

      fireNeedsPassphrase({ encryptedPrivateKey, publicKey: REAL_PUB_B64, token });
      const passphraseInput = await screen.findByPlaceholderText(/Min 8 characters/i);
      fireEvent.change(passphraseInput, { target: { value: 'my-encryption-passphrase' } });
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.submit(passphraseInput.closest('form'));

      await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe(REAL_PUB_B64));
      await waitFor(() => expect(enrollBrowser).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(toast.error).toHaveBeenCalled());

      const [message] = toast.error.mock.calls[0];
      expect(message).toMatch(/doesn.t support secure browser unlock/i);
      expect(message).toMatch(/encryption passphrase/i);
      // NOT the generic "couldn't remember" wording — PRF classification
      // must actually change which message is shown, not just log
      // differently.
      expect(message).not.toMatch(/couldn.t remember this browser/i);
      expect(message).not.toMatch(/lost|deleted|gone/i); // still never implies the E2EE key was lost

      expect(generateKeyPairSpy).not.toHaveBeenCalled();
      generateKeyPairSpy.mockRestore();
    });

    test('enrollBrowser rejecting with PRF_NOT_CONFIRMED (create() OK, authentication-time probe failed) also shows the PRF-specific message', async () => {
      const { enrollBrowser } = await import('../lib/browserDeviceUnlock.js');
      enrollBrowser.mockRejectedValue({ code: 'PRF_NOT_CONFIRMED', message: 'This authenticator did not return a PRF result on authentication.' });

      installNativePlugin({});
      const token = fakeToken({ id: 24, username: 'ivan' });
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

      fireNeedsPassphrase({ encryptedPrivateKey, publicKey: REAL_PUB_B64, token });
      const passphraseInput = await screen.findByPlaceholderText(/Min 8 characters/i);
      fireEvent.change(passphraseInput, { target: { value: 'my-encryption-passphrase' } });
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.submit(passphraseInput.closest('form'));

      await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe(REAL_PUB_B64));
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      expect(toast.error.mock.calls[0][0]).toMatch(/doesn.t support secure browser unlock/i);
    });

    test('a non-PRF failure (e.g. CREATE_FAILED) still shows the generic message, not the PRF-specific one', async () => {
      const { enrollBrowser } = await import('../lib/browserDeviceUnlock.js');
      enrollBrowser.mockRejectedValue({ code: 'CREATE_FAILED', message: 'The operation either timed out or was not allowed.' });

      installNativePlugin({});
      const token = fakeToken({ id: 25, username: 'judy' });
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

      fireNeedsPassphrase({ encryptedPrivateKey, publicKey: REAL_PUB_B64, token });
      const passphraseInput = await screen.findByPlaceholderText(/Min 8 characters/i);
      fireEvent.change(passphraseInput, { target: { value: 'my-encryption-passphrase' } });
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.submit(passphraseInput.closest('form'));

      await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe(REAL_PUB_B64));
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      expect(toast.error.mock.calls[0][0]).toMatch(/couldn.t remember this browser/i);
      expect(toast.error.mock.calls[0][0]).not.toMatch(/doesn.t support secure browser unlock/i);
    });
  });
});
