import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { CryptoProvider } from './contexts/CryptoContext';
import Login from './Login';

// TEST 3 (recovery-phrase display gap fix): proves the PRE-EXISTING
// "brand-new account creates its E2EE identity and is shown its recovery
// phrase" flow is byte-for-byte unaffected by this session's change, which
// only touched EncryptionUnlockGate.jsx's separate isSetup path (used for a
// password-reset-without-recovery-key or legacy account at LOGIN, not
// first-time key creation). This file deliberately does NOT mock
// OAuthEncryptionModal or RecoveryPhraseModal (unlike Login.test.jsx, which
// mocks both away to keep its own device-unlock-focused tests simple) so the
// real Login.jsx -> completeOAuthLogin -> handleOAuthSetPassphrase -> real
// RecoveryPhraseModal chain actually renders and can be exercised end to end.
const navigateSpy = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateSpy,
  useLocation: () => ({ state: {}, search: '' }),
  Link: ({ children, ...props }) => <a {...props}>{children}</a>,
}));
// Renders a real, clickable stand-in for the Google button so the test can
// drive the actual onSuccess callback Login.jsx wires up — @react-oauth/
// google's real widget needs a live Google script/origin that doesn't exist
// in jsdom, but everything downstream of onSuccess (completeOAuthLogin
// onward) is Login.jsx's own real, unmocked code.
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess }) => (
    <button onClick={() => onSuccess({ credential: 'fake-google-credential' })}>
      Continue with Google (test stub)
    </button>
  ),
}));
vi.mock('./components/SeoHead', () => ({ default: () => null }));
vi.mock('./lib/nativeGoogleAuth', () => ({ openNativeGoogleSignIn: vi.fn() }));
vi.mock('./lib/nativePush', () => ({ resyncPushTokenAfterLogin: vi.fn() }));

function renderLogin() {
  return render(<CryptoProvider><Login /></CryptoProvider>);
}

describe('Login.jsx — brand-new Google account key setup + recovery phrase (unaffected by the EncryptionUnlockGate isSetup fix)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test('TEST 3: a brand-new Google account still gets the real OAuthEncryptionModal set-passphrase step, then the real RecoveryPhraseModal with a genuine phrase', async () => {
    const token = 'header.' + btoa(JSON.stringify({ id: 30, username: 'gina' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '.sig';
    let setupKeysBody = null;
    const fetchMock = vi.fn(async (url, opts) => {
      const u = String(url);
      if (u.includes('/api/auth/google')) {
        return { ok: true, json: async () => ({ token, username: 'gina', role: 'user', needsKeySetup: true, isNewAccount: true }) };
      }
      if (u.includes('/api/auth/setup-keys')) {
        setupKeysBody = JSON.parse(opts.body);
        return { ok: true, json: async () => ({ success: true }) };
      }
      throw new Error(`Unexpected fetch in test: ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderLogin();
    fireEvent.click(screen.getByText(/Continue with Google \(test stub\)/i));

    // The real OAuthEncryptionModal, mode='set', OAuth-flavored copy.
    const passphraseInput = await screen.findByPlaceholderText(/Min 8 characters/i);
    fireEvent.change(passphraseInput, { target: { value: 'ginas-encryption-passphrase' } });
    fireEvent.change(screen.getByPlaceholderText(/Re-enter passphrase/i), { target: { value: 'ginas-encryption-passphrase' } });
    fireEvent.submit(passphraseInput.closest('form'));

    // The real RecoveryPhraseModal — same component, same required
    // reveal-and-acknowledge gate the signup flow has always used.
    // encryptPrivateKey (inside handleOAuthSetPassphrase) is real,
    // deliberately slow 600k-iteration PBKDF2 (crypto.js) — can exceed
    // waitFor's default 1000ms under full-suite CPU contention (same
    // documented allowance used throughout this repo's other crypto tests).
    await waitFor(() => expect(screen.getByText(/Your Recovery Phrase/i)).toBeInTheDocument(), { timeout: 5000 });
    expect(setupKeysBody).toBeTruthy();
    expect(setupKeysBody.recoveryKeyHash).toBeTruthy();

    fireEvent.click(screen.getByText(/Click to reveal phrase/i));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText(/I've saved it/i));

    await waitFor(() => expect(screen.queryByText(/Your Recovery Phrase/i)).not.toBeInTheDocument());
    expect(navigateSpy).toHaveBeenCalled();
  });
});
