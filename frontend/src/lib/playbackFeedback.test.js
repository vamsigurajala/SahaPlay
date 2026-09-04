import { describe, test, expect } from 'vitest';
import { getCenterFeedbackType } from './playbackFeedback';

describe('getCenterFeedbackType', () => {
  // Regression for the exact bug this session: the center flash used to show
  // the icon for the state being LEFT instead of the state being ENTERED,
  // so tapping to pause briefly showed a Pause icon (the state just left)
  // while the bottom bar had already flipped to show Play.
  test('tapping while playing (about to pause) shows the "play" icon — the state being entered', () => {
    expect(getCenterFeedbackType(true)).toBe('play');
  });

  test('tapping while paused (about to play) shows the "pause" icon — the state being entered', () => {
    expect(getCenterFeedbackType(false)).toBe('pause');
  });
});
