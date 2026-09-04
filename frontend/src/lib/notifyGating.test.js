import { describe, test, expect, beforeEach } from 'vitest';
import { isNotifyCategoryEnabled } from './notifyGating';

describe('isNotifyCategoryEnabled', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('defaults to enabled when nothing has ever been set (fresh install/first login)', () => {
    expect(isNotifyCategoryEnabled('calls')).toBe(true);
    expect(isNotifyCategoryEnabled('messages')).toBe(true);
  });

  test('the master notifyApp toggle off silences every category', () => {
    localStorage.setItem('notifyApp', 'false');
    localStorage.setItem('notifyCalls', 'true');
    localStorage.setItem('notifyMessages', 'true');
    expect(isNotifyCategoryEnabled('calls')).toBe(false);
    expect(isNotifyCategoryEnabled('messages')).toBe(false);
  });

  test('a single category toggle off only silences that category', () => {
    localStorage.setItem('notifyCalls', 'false');
    expect(isNotifyCategoryEnabled('calls')).toBe(false);
    expect(isNotifyCategoryEnabled('messages')).toBe(true);
  });

  test('an unrecognized category is not gated by any per-category key, only the master toggle', () => {
    expect(isNotifyCategoryEnabled('friendRequests')).toBe(true);
    localStorage.setItem('notifyApp', 'false');
    expect(isNotifyCategoryEnabled('friendRequests')).toBe(false);
  });
});
