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

// Laptop/tablet video fit option: a phone's portrait camera used to be shown
// with object-fit:cover, i.e. stretched/cropped to fill a laptop window. Large
// screens now default to 'contain' (whole portrait frame, "mobile view") and
// get a toggle to expand it to fill the screen. Phones are unchanged.
describe('OneOnOneCallScreen — laptop/tablet video fit option', () => {
  const setViewport = (w, h) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: h });
  };
  const videoProps = () => baseProps({
    mode: 'video',
    isCamOn: true,
    remoteStreams: { alice: { getVideoTracks: () => [{}], getAudioTracks: () => [] } },
    participantMeta: { alice: { camOn: true, micOn: true } },
  });
  const mainVideoFit = (container) => container.querySelector('video')?.style.objectFit;

  beforeEach(() => {
    localStorage.clear();
    // jsdom has no media playback.
    window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  });
  afterEach(() => { cleanup(); setViewport(1024, 768); });

  test('laptop/tablet: shows the toggle and defaults to mobile view (contain)', () => {
    setViewport(1440, 900);
    const { container } = render(<OneOnOneCallScreen {...videoProps()} />);
    expect(container.querySelector('.ooc-fit-toggle')).not.toBeNull();
    expect(mainVideoFit(container)).toBe('contain');
  });

  test('clicking the toggle expands to full screen (cover) and remembers the choice', () => {
    setViewport(1440, 900);
    const { container } = render(<OneOnOneCallScreen {...videoProps()} />);
    fireEvent.click(container.querySelector('.ooc-fit-toggle'));
    expect(mainVideoFit(container)).toBe('cover');
    expect(localStorage.getItem('sp_call_video_fit')).toBe('fill');
    fireEvent.click(container.querySelector('.ooc-fit-toggle'));
    expect(mainVideoFit(container)).toBe('contain');
    expect(localStorage.getItem('sp_call_video_fit')).toBe('fit');
  });

  test('a saved "fill" preference is honoured on the next call', () => {
    setViewport(1440, 900);
    localStorage.setItem('sp_call_video_fit', 'fill');
    const { container } = render(<OneOnOneCallScreen {...videoProps()} />);
    expect(mainVideoFit(container)).toBe('cover');
  });

  test('phone-sized screens get no toggle and keep the old full-bleed behaviour', () => {
    setViewport(390, 844);
    const { container } = render(<OneOnOneCallScreen {...videoProps()} />);
    expect(container.querySelector('.ooc-fit-toggle')).toBeNull();
    expect(mainVideoFit(container)).toBe('cover');
  });

  test('a phone in landscape (short side < 600) still counts as a phone', () => {
    setViewport(850, 400);
    const { container } = render(<OneOnOneCallScreen {...videoProps()} />);
    expect(container.querySelector('.ooc-fit-toggle')).toBeNull();
    expect(mainVideoFit(container)).toBe('cover');
  });

  test('voice calls never show the toggle', () => {
    setViewport(1440, 900);
    const { container } = render(<OneOnOneCallScreen {...baseProps()} />);
    expect(container.querySelector('.ooc-fit-toggle')).toBeNull();
  });
});
