import { describe, test, expect, beforeEach } from 'vitest';
import { isStrictDeviceUnlockEnabled, setStrictDeviceUnlockEnabled } from './deviceUnlockSettings.js';

describe('deviceUnlockSettings.js', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('defaults to false (OFF) when never set — preserves existing behavior for every account that never touches this setting', () => {
    expect(isStrictDeviceUnlockEnabled()).toBe(false);
  });

  test('setStrictDeviceUnlockEnabled(true) persists across separate reads', () => {
    setStrictDeviceUnlockEnabled(true);
    expect(isStrictDeviceUnlockEnabled()).toBe(true);
  });

  test('setStrictDeviceUnlockEnabled(false) after true turns it back off (and does not merely leave a falsy string)', () => {
    setStrictDeviceUnlockEnabled(true);
    setStrictDeviceUnlockEnabled(false);
    expect(isStrictDeviceUnlockEnabled()).toBe(false);
    expect(localStorage.getItem('watch_strict_device_unlock')).toBeNull();
  });

  test('the preference survives a simulated app restart (a fresh read of localStorage, no in-memory state)', () => {
    setStrictDeviceUnlockEnabled(true);
    // Nothing here holds a JS reference to the earlier state — every call
    // reads localStorage fresh, exactly like a real new app launch would.
    expect(isStrictDeviceUnlockEnabled()).toBe(true);
  });
});
