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
//
// Native (Android/Windows) device unlock ONLY — this component's earlier
// browser-only WebAuthn PRF "Remember this browser" shortcut was removed
// (see EncryptionUnlockGate.jsx's own header comment), so a plain browser
// tab always goes straight to the passphrase modal; there is nothing more
// to mock/assert for that path beyond the first test below.

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

// CryptoProvider's own mount effect, given a my-keys response of
// { publicKey: null, encryptedPrivateKey: null } (used throughout this file
// to keep the mount effect from attempting a real device-unlock restore —
// see each test's own comment), now ALSO dispatches
// 'encryption_needs_passphrase' ({ isSetup: true, ... }) itself, instead of
// silently auto-generating a keypair as it used to. That dispatch and this
// test file's own explicit fireNeedsPassphrase(...) calls target the exact
// same event/ctx state, so firing the test's real event too early would race
// the mount effect's own (irrelevant) one and risk it winning last, clobbering
// the test's intended ctx. Waiting for the setup modal the mount effect's own
// dispatch produces to actually render first guarantees that dispatch (and
// its internal 300ms setTimeout — see EncryptionUnlockGate.jsx) has already
// fully resolved before the test fires its own event, which is then
// guaranteed to be the last (and therefore winning) one.
async function waitForMountEffectSetupDispatch() {
  await waitFor(() => expect(screen.getByText(/Set an encryption passphrase/i)).toBeInTheDocument());
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

  afterEach(async () => {
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
    await waitForMountEffectSetupDispatch();

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
    await waitForMountEffectSetupDispatch();

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
    await waitForMountEffectSetupDispatch();

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
      await waitForMountEffectSetupDispatch();

      const nativeSetup = vi.fn(async () => ({}));
      window.Capacitor.Plugins.SahaplayE2ee.setupDeviceUnlock = nativeSetup;

      fireNeedsPassphrase({ encryptedPrivateKey, publicKey: REAL_PUB_B64, token });
      // The mount effect's OWN (mode='set') modal is still on screen for a
      // moment until THIS event's ctx replaces it — its passphrase input
      // shares the exact same placeholder text as the 'unlock' mode input
      // below, so wait for the unlock-specific title before touching any
      // input, or fireEvent risks typing into the wrong (about to be
      // unmounted) form.
      await waitFor(() => expect(screen.getByText(/Enter your encryption passphrase/i)).toBeInTheDocument());
      const passphraseInput = screen.getByPlaceholderText(/Min 8 characters/i);
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
      await waitForMountEffectSetupDispatch();

      const nativeSetup = vi.fn(async () => ({}));
      window.Capacitor.Plugins.SahaplayE2ee.setupDeviceUnlock = nativeSetup;

      fireNeedsPassphrase({ encryptedPrivateKey: 'server-blob', publicKey: recoveryPubB64, token });
      // See test B's comment — wait for the unlock-mode title specifically
      // before interacting, since the mount effect's own (mode='set') modal
      // shares the exact same passphrase-input placeholder text.
      await waitFor(() => expect(screen.getByText(/Enter your encryption passphrase/i)).toBeInTheDocument());
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
      await waitForMountEffectSetupDispatch();

      const nativeSetup = vi.fn(async () => { throw { code: 'HARDWARE_UNAVAILABLE', message: 'Keystore unavailable' }; });
      window.Capacitor.Plugins.SahaplayE2ee.setupDeviceUnlock = nativeSetup;

      fireNeedsPassphrase({ encryptedPrivateKey, publicKey: REAL_PUB_B64, token });
      // See test B's comment — wait for the unlock-mode title specifically
      // before interacting, since the mount effect's own (mode='set') modal
      // shares the exact same passphrase-input placeholder text.
      await waitFor(() => expect(screen.getByText(/Enter your encryption passphrase/i)).toBeInTheDocument());
      const passphraseInput = screen.getByPlaceholderText(/Min 8 characters/i);
      fireEvent.change(passphraseInput, { target: { value: 'my-encryption-passphrase' } });
      fireEvent.submit(passphraseInput.closest('form'));

      // Unlock still succeeds (keyPair is the real, correct key) even though
      // enrollment underneath it fails. decryptPrivateKey above is the same
      // real, deliberately slow PBKDF2 — see the timeout note earlier in
      // this file.
      await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).toBe(REAL_PUB_B64), { timeout: 5000 });
      await waitFor(() => expect(nativeSetup).toHaveBeenCalledTimes(1), { timeout: 5000 });
      expect(screen.queryByText(/hardware.*unavailable/i)).not.toBeInTheDocument();
    });
  });

  // Security fix: password reset WITHOUT a recovery key intentionally leaves
  // an EXISTING account with no encryptedPrivateKey/publicKey at all (see
  // server.js's /api/reset-password) — indistinguishable, from the client's
  // point of view, from a legacy pre-E2EE account. Login.jsx and
  // CryptoContext's mount effect both now dispatch
  // 'encryption_needs_passphrase' with { isSetup: true } for this state
  // instead of silently generating a keypair themselves; this is the ONE
  // place that new keypair actually gets created — only after the user
  // explicitly submits a passphrase here.
  describe('isSetup flow — explicit new-identity setup after a password reset without a recovery key (or a legacy account)', () => {
    // These use a real watch_token + my-keys mock (like every other test in
    // this file) and let CryptoProvider's OWN mount effect dispatch
    // encryption_needs_passphrase naturally, rather than fabricating the
    // event by hand — exercising the actual production dispatch this fix
    // introduced, not a re-implementation of it.
    test('TEST 1: shows the "set an encryption passphrase" setup UI, and does not touch the network or generate any key before the user submits it', async () => {
      localStorage.setItem('watch_token', fakeToken({ id: 20, username: 'erin' }));
      localStorage.setItem('watch_username', 'erin');
      const fetchMock = vi.fn(async (url) => {
        if (String(url).includes('/api/auth/my-keys')) {
          return { ok: true, json: async () => ({ publicKey: null, encryptedPrivateKey: null }) };
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
      });
      vi.stubGlobal('fetch', fetchMock);

      render(<CryptoProvider><Probe /><EncryptionUnlockGate /></CryptoProvider>);
      await waitForMountEffectSetupDispatch();

      expect(screen.getByPlaceholderText(/Min 8 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/Set passphrase & continue/i)).toBeInTheDocument();
      // Still a genuinely fresh identity — nothing generated or uploaded yet.
      expect(screen.getByTestId('keypair-state').textContent).toBe('null');
      expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('setup-keys'), expect.anything());
      expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('save-public-key'), expect.anything());
    });

    test('TEST 2: submitting a passphrase generates exactly one new keypair, uploads it via setup-keys, and unlocks E2EE with a matching public/secret key pair', async () => {
      localStorage.setItem('watch_token', fakeToken({ id: 21, username: 'erin' }));
      localStorage.setItem('watch_username', 'erin');
      let setupKeysBody = null;
      const fetchMock = vi.fn(async (url, opts) => {
        if (String(url).includes('/api/auth/my-keys')) {
          return { ok: true, json: async () => ({ publicKey: null, encryptedPrivateKey: null }) };
        }
        if (String(url).includes('/api/auth/setup-keys')) {
          setupKeysBody = JSON.parse(opts.body);
          return { ok: true, json: async () => ({ success: true }) };
        }
        if (String(url).includes('/api/auth/device-enrollment-assertion')) {
          return { ok: true, json: async () => ({ assertion: 'fresh-assertion' }) };
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
      });
      vi.stubGlobal('fetch', fetchMock);

      render(<CryptoProvider><Probe /><EncryptionUnlockGate /></CryptoProvider>);
      await waitForMountEffectSetupDispatch();

      const passphraseInput = screen.getByPlaceholderText(/Min 8 characters/i);
      fireEvent.change(passphraseInput, { target: { value: 'brand-new-encryption-passphrase' } });
      fireEvent.change(screen.getByPlaceholderText(/Re-enter passphrase/i), { target: { value: 'brand-new-encryption-passphrase' } });
      fireEvent.submit(passphraseInput.closest('form'));

      // encryptPrivateKey below is real, deliberately slow 600k-iteration
      // PBKDF2 (crypto.js) — can exceed waitFor's default 1000ms under
      // full-suite CPU contention (same documented allowance used
      // elsewhere in this file/CryptoContext.test.jsx/Login.test.jsx).
      await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).not.toBe('null'), { timeout: 5000 });

      // publicKey and encryptedPrivateKey both exist and were sent to the server.
      expect(setupKeysBody).toBeTruthy();
      expect(setupKeysBody.publicKey).toBeTruthy();
      expect(setupKeysBody.encryptedPrivateKey).toBeTruthy();
      // The public key the server was given matches the in-memory secret
      // key CryptoContext now holds — the exact same generated keypair, not
      // two different ones.
      expect(screen.getByTestId('keypair-state').textContent).toBe(setupKeysBody.publicKey);

      // The private key unwraps ONLY with the passphrase just submitted —
      // never the login password (which was never even provided here).
      const { decryptPrivateKey } = await import('../lib/crypto.js');
      const recovered = await decryptPrivateKey(setupKeysBody.encryptedPrivateKey, 'brand-new-encryption-passphrase');
      const recoveredPubB64 = encodeBase64(nacl.box.keyPair.fromSecretKey(recovered).publicKey);
      expect(recoveredPubB64).toBe(setupKeysBody.publicKey);
    });

    // Recovery-phrase display gap fix: after this exact isSetup flow
    // succeeds, the user used to never see the recovery phrase that was
    // just generated and hashed — handleSetPassphrase computed it, hashed
    // it, sent the hash to setup-keys, and then simply discarded it.
    describe('recovery phrase display after a successful isSetup flow', () => {
      async function completeSetup({ passphrase = 'brand-new-encryption-passphrase', id = 40, username = 'hank' } = {}) {
        localStorage.setItem('watch_token', fakeToken({ id, username }));
        localStorage.setItem('watch_username', username);
        let setupKeysBody = null;
        const fetchMock = vi.fn(async (url, opts) => {
          if (String(url).includes('/api/auth/my-keys')) {
            return { ok: true, json: async () => ({ publicKey: null, encryptedPrivateKey: null }) };
          }
          if (String(url).includes('/api/auth/setup-keys')) {
            setupKeysBody = JSON.parse(opts.body);
            return { ok: true, json: async () => ({ success: true }) };
          }
          throw new Error(`Unexpected fetch in test: ${url}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<CryptoProvider><Probe /><EncryptionUnlockGate /></CryptoProvider>);
        await waitForMountEffectSetupDispatch();

        const passphraseInput = screen.getByPlaceholderText(/Min 8 characters/i);
        fireEvent.change(passphraseInput, { target: { value: passphrase } });
        fireEvent.change(screen.getByPlaceholderText(/Re-enter passphrase/i), { target: { value: passphrase } });
        fireEvent.submit(passphraseInput.closest('form'));

        // encryptPrivateKey below is real, deliberately slow 600k-iteration
        // PBKDF2 (crypto.js) — can exceed waitFor's default 1000ms under
        // full-suite CPU contention (same documented allowance used
        // elsewhere in this file/CryptoContext.test.jsx/Login.test.jsx).
        await waitFor(() => expect(screen.getByTestId('keypair-state').textContent).not.toBe('null'), { timeout: 5000 });
        return { getSetupKeysBody: () => setupKeysBody };
      }

      test('TEST 1: RecoveryPhraseModal appears once the new E2EE identity is established', async () => {
        await completeSetup();
        await waitFor(() => expect(screen.getByText(/Your Recovery Phrase/i)).toBeInTheDocument(), { timeout: 5000 });
        // The passphrase-setup modal is gone — replaced by the recovery
        // phrase step, not shown alongside it.
        expect(screen.queryByText(/Set an encryption passphrase/i)).not.toBeInTheDocument();
      });

      test('TEST 2: the displayed phrase is the EXACT phrase whose hash was submitted to setup-keys — never a second, freshly-generated one', async () => {
        const { getSetupKeysBody } = await completeSetup();
        await waitFor(() => expect(screen.getByText(/Your Recovery Phrase/i)).toBeInTheDocument(), { timeout: 5000 });

        // Reveal to read the displayed phrase back out of the DOM. This is
        // secretKeyToMnemonic's real 24-word BIP39 output (space-separated),
        // not the 24-letter scheme other flows in this app use — Recovery
        // PhraseModal renders each word in its own .recovery-phrase-word span.
        fireEvent.click(screen.getByText(/Click to reveal phrase/i));
        const displayedWords = Array.from(document.querySelectorAll('.recovery-phrase-word')).map(el => el.textContent);
        expect(displayedWords).toHaveLength(24);
        const displayedPhrase = displayedWords.join(' ');

        const { hashRecoveryPhrase } = await import('../lib/crypto.js');
        const displayedHash = await hashRecoveryPhrase(displayedPhrase);
        expect(displayedHash).toBe(getSetupKeysBody().recoveryKeyHash);
      });

      test('TEST 4: not acknowledging the recovery phrase does not silently dismiss it or let the setup-passphrase prompt reappear', async () => {
        await completeSetup();
        await waitFor(() => expect(screen.getByText(/Your Recovery Phrase/i)).toBeInTheDocument(), { timeout: 5000 });

        // Give any stray timers/effects a chance to run without ever
        // clicking reveal/acknowledge/continue.
        await new Promise(r => setTimeout(r, 350));

        // Still showing the SAME recovery-phrase gate — not dismissed, and
        // not replaced by the (already-completed) passphrase-setup modal
        // either, which would look like the flow silently reset/abandoned
        // the phrase entirely.
        expect(screen.getByText(/Your Recovery Phrase/i)).toBeInTheDocument();
        expect(screen.queryByText(/Set an encryption passphrase/i)).not.toBeInTheDocument();
        // The continue button is disabled until reveal + acknowledge — the
        // ONLY way past this screen is actually confirming it.
        expect(screen.getByText(/Reveal phrase first/i)).toBeDisabled();
      });

      test('confirming the recovery phrase (reveal + acknowledge + continue) dismisses the gate', async () => {
        await completeSetup();
        await waitFor(() => expect(screen.getByText(/Your Recovery Phrase/i)).toBeInTheDocument(), { timeout: 5000 });

        fireEvent.click(screen.getByText(/Click to reveal phrase/i));
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByText(/I've saved it/i));

        await waitFor(() => expect(screen.queryByText(/Your Recovery Phrase/i)).not.toBeInTheDocument());
      });
    });

    test('a mismatched confirm-passphrase is rejected locally and never reaches the network', async () => {
      localStorage.setItem('watch_token', fakeToken({ id: 22, username: 'frank' }));
      localStorage.setItem('watch_username', 'frank');
      const fetchMock = vi.fn(async (url) => {
        if (String(url).includes('/api/auth/my-keys')) {
          return { ok: true, json: async () => ({ publicKey: null, encryptedPrivateKey: null }) };
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
      });
      vi.stubGlobal('fetch', fetchMock);

      render(<CryptoProvider><Probe /><EncryptionUnlockGate /></CryptoProvider>);
      await waitForMountEffectSetupDispatch();

      const passphraseInput = screen.getByPlaceholderText(/Min 8 characters/i);
      fireEvent.change(passphraseInput, { target: { value: 'one-passphrase' } });
      fireEvent.change(screen.getByPlaceholderText(/Re-enter passphrase/i), { target: { value: 'a-different-one' } });
      fireEvent.submit(passphraseInput.closest('form'));

      await waitFor(() => expect(screen.getByText(/do not match/i)).toBeInTheDocument());
      expect(screen.getByTestId('keypair-state').textContent).toBe('null');
      expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('setup-keys'), expect.anything());
    });
  });
});
