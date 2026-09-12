import React from 'react';
import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import OneOnOneCallScreen from './OneOnOneCallScreen';

// Regression for: after ~6s of desktop mouse inactivity the call chrome
// (.ooc-topbar / .ooc-dock) auto-hides via pointer-events:none, so a click
// aimed at End Call/Mute/Video landed on the stage underneath instead and
// only re-revealed the chrome — the click had to be repeated. The fix wires
// onMouseMove={resetHideTimer} on .ooc-root, matching the existing pattern
// in CallingActivity.jsx. These tests pin the state transition the fix
// depends on (chromeVisible flipping back to true on mouse movement), not
// the CSS pointer-events behavior itself, which jsdom doesn't enforce.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key, fallback) => fallback }),
}));

vi.mock('../hooks/useSpeakingDetection', () => ({
  useSpeakingDetection: () => new Set(),
}));

function baseProps(overrides = {}) {
  return {
    mode: 'voice',
    isMicOn: true,
    isCamOn: false,
    localStream: null,
    myUsername: 'me',
    myAvatarUrl: null,
    callState: {
      peerUsername: 'alice',
      peerDisplayName: 'Alice',
      peerAvatar: null,
      groupMembers: [],
      isGroupJoin: false,
      answeredAt: Date.now(),
    },
    remoteStreams: {},
    participantMeta: {},
    networkStatus: 'good',
    toggleMic: vi.fn(),
    toggleCamera: vi.fn(),
    flipCamera: vi.fn(),
    isFlippingCamera: false,
    audioRoute: 'speaker',
    setAudioRoute: vi.fn(),
    bluetoothAudioAvailable: false,
    addMemberToCall: vi.fn(),
    isCoarsePointer: false,
    onEndCall: vi.fn(),
    isScreenSharing: false,
    screenShareStream: null,
    startScreenShare: vi.fn(),
    stopScreenShare: vi.fn(),
    onSendMessage: vi.fn(),
    ...overrides,
  };
}

describe('OneOnOneCallScreen — desktop chrome auto-hide/reveal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test('chrome is visible on mount', () => {
    const { container } = render(<OneOnOneCallScreen {...baseProps()} />);
    expect(container.querySelector('.ooc-dock').className).not.toMatch(/ooc-hidden/);
    expect(container.querySelector('.ooc-topbar').className).not.toMatch(/ooc-hidden/);
  });

  test('chrome auto-hides after 6s of inactivity', () => {
    const { container } = render(<OneOnOneCallScreen {...baseProps()} />);
    act(() => { vi.advanceTimersByTime(6001); });
    expect(container.querySelector('.ooc-dock').className).toMatch(/ooc-hidden/);
  });

  test('mouse movement on the stage reveals hidden chrome (the fix)', () => {
    const { container } = render(<OneOnOneCallScreen {...baseProps()} />);
    act(() => { vi.advanceTimersByTime(6001); });
    expect(container.querySelector('.ooc-dock').className).toMatch(/ooc-hidden/);

    fireEvent.mouseMove(container.querySelector('.ooc-root'));

    expect(container.querySelector('.ooc-dock').className).not.toMatch(/ooc-hidden/);
    expect(container.querySelector('.ooc-topbar').className).not.toMatch(/ooc-hidden/);
  });

  test('mouse movement keeps postponing the auto-hide timer', () => {
    const { container } = render(<OneOnOneCallScreen {...baseProps()} />);
    act(() => { vi.advanceTimersByTime(5000); });
    fireEvent.mouseMove(container.querySelector('.ooc-root'));
    act(() => { vi.advanceTimersByTime(5000); }); // 10s total, but only 5s since the last move
    expect(container.querySelector('.ooc-dock').className).not.toMatch(/ooc-hidden/);
  });
});
