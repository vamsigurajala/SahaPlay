import React from 'react';
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import SupportModal from './SupportModal';
import { isPullToRefreshBlocked } from '../lib/pullToRefreshGate';

// SupportModal sits position:fixed on top of whatever page opened it without
// unmounting that page (Profile, AppSettings, Navbar/BottomNav) — scrolling
// the modal's own content used to chain into the page behind it and trigger
// the browser/WebView's native pull-to-refresh, reloading the whole app just
// from scrolling inside a modal (fixed this session). The fix wires the
// modal's isOpen lifecycle to the app's shared blockPullToRefresh() /
// unblockPullToRefresh() gate — these tests pin that lifecycle using the
// REAL gate module (not a mock), so they fail if the gate's counter
// semantics ever regress, not just if the component stops calling it.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key, fallback) => fallback }),
}));

describe('SupportModal — pull-to-refresh gate lifecycle', () => {
  afterEach(() => {
    cleanup();
  });

  test('renders nothing and leaves the gate untouched while closed', () => {
    const { container } = render(<SupportModal isOpen={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    expect(isPullToRefreshBlocked()).toBe(false);
  });

  test('blocks pull-to-refresh while open', () => {
    render(<SupportModal isOpen={true} onClose={() => {}} />);
    expect(isPullToRefreshBlocked()).toBe(true);
  });

  test('unblocks pull-to-refresh once unmounted (modal closed by the host page)', () => {
    const { unmount } = render(<SupportModal isOpen={true} onClose={() => {}} />);
    expect(isPullToRefreshBlocked()).toBe(true);
    unmount();
    expect(isPullToRefreshBlocked()).toBe(false);
  });

  test('unblocks when isOpen flips to false without unmounting', () => {
    const { rerender } = render(<SupportModal isOpen={true} onClose={() => {}} />);
    expect(isPullToRefreshBlocked()).toBe(true);
    rerender(<SupportModal isOpen={false} onClose={() => {}} />);
    expect(isPullToRefreshBlocked()).toBe(false);
  });

  test('two overlapping opens only unblock once both have closed (counter, not boolean)', () => {
    // Regression for the exact reason isPullToRefreshBlocked is a counter:
    // this modal opening on top of another already-open blocking overlay
    // must not let the first one's close accidentally unblock the second.
    const first = render(<SupportModal isOpen={true} onClose={() => {}} />);
    const second = render(<SupportModal isOpen={true} onClose={() => {}} />);
    expect(isPullToRefreshBlocked()).toBe(true);
    first.unmount();
    expect(isPullToRefreshBlocked()).toBe(true);
    second.unmount();
    expect(isPullToRefreshBlocked()).toBe(false);
  });

  test('Escape closes the modal via onClose while open', () => {
    const onClose = vi.fn();
    render(<SupportModal isOpen={true} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Escape does nothing while closed (no listener attached)', () => {
    const onClose = vi.fn();
    render(<SupportModal isOpen={false} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  test('renders the legal contact option added alongside the reload fix', () => {
    render(<SupportModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('legal@sahaplay.com')).toBeInTheDocument();
  });
});
