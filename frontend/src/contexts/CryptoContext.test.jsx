import React from 'react';
import { describe, test, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
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
      <button data-testid="set-key" onClick={() => setKeyPair({
        publicKey: new Uint8Array(32).fill(1),
        secretKey: new Uint8Array(32).fill(2),
      })}>
        set key
      </button>
    </div>
  );
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
