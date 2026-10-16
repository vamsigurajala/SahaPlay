import { describe, it, expect } from 'vitest';
import { ball, chase, cpuBowl, cpuBat, outcomeText } from './handCricketLogic';

const fixed = (v) => () => v;

describe('hand cricket rules', () => {
  it('the same number is out, a different number scores the batter number', () => {
    expect(ball(4, 4)).toEqual({ out: true, runs: 0 });
    expect(ball(6, 2)).toEqual({ out: false, runs: 6 });
    expect(ball(1, 6)).toEqual({ out: false, runs: 1 });
  });

  it('the chase ends as soon as the computer passes your score', () => {
    expect(chase(21, 20, false)).toBe('cpu');
    expect(chase(20, 20, false)).toBe(null);
  });

  it('when the computer is out it loses, ties or (rarely) never wins on the last ball', () => {
    expect(chase(14, 20, true)).toBe('you');
    expect(chase(20, 20, true)).toBe('tie');
    expect(outcomeText('tie')).toMatch(/tied/);
  });

  it('the computer always shows a legal number', () => {
    for (let i = 0; i < 200; i++) {
      const b = cpuBowl([1, 1, 1, 2], Math.random);
      const a = cpuBat(Math.floor(Math.random() * 12), Math.random);
      expect(b).toBeGreaterThanOrEqual(1); expect(b).toBeLessThanOrEqual(6);
      expect(a).toBeGreaterThanOrEqual(1); expect(a).toBeLessThanOrEqual(6);
    }
  });

  it('it goes for the exact runs it needs when close, and guesses a spammed number', () => {
    expect(cpuBat(4, fixed(0.1))).toBe(4);
    expect(cpuBowl([5, 5, 5, 2], fixed(0.1))).toBe(5);
    expect(cpuBowl([5, 5, 5, 2], fixed(0.9))).toBe(6);
  });
});
