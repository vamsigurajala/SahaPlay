import { describe, it, expect } from 'vitest';
import { judge, leave, nextBall, WINDOW } from './cricketLogic';

const fixed = (v) => () => v;

describe('cricket rules', () => {
  it('perfect timing is a six, good timing a four', () => {
    expect(judge(0.01, 0, 0, fixed(0.5)).runs).toBe(6);
    expect(judge(-0.1, 0, 0, fixed(0.5)).runs).toBe(4);
  });
  it('decent timing scores one to three runs', () => {
    const r = judge(0.2, 0, 0, fixed(0.1));
    expect(r.runs).toBeGreaterThanOrEqual(1);
    expect(r.runs).toBeLessThanOrEqual(3);
    expect(r.wicket).toBe(false);
  });
  it('a thick edge can be caught or run for one', () => {
    expect(judge(0.3, 0, 0, fixed(0.1)).wicket).toBe(true);
    const safe = judge(0.3, 0, 0, fixed(0.9));
    expect(safe.wicket).toBe(false);
    expect(safe.runs).toBe(1);
  });
  it('a very early or late swing misses; a straight ball then bowls you', () => {
    expect(judge(-WINDOW.edge - 0.1, 0, 0, fixed(0.1))).toMatchObject({ wicket: true, kind: 'bowled' });
    expect(judge(WINDOW.edge + 0.1, 0, 1, fixed(0.1))).toMatchObject({ wicket: false, kind: 'miss', runs: 0 });
  });
  it('hitting across the line costs runs', () => {
    expect(judge(0.01, -1, 1, fixed(0.5)).runs).toBe(4);
    expect(judge(0.1, 1, -1, fixed(0.5)).runs).toBe(2);
    expect(judge(0.01, 1, 1, fixed(0.5)).runs).toBe(6);
  });
  it('leaving a wide ball is safe, leaving a straight one is not', () => {
    expect(leave(1, fixed(0.1)).wicket).toBe(false);
    expect(leave(0, fixed(0.1)).wicket).toBe(true);
    expect(leave(0, fixed(0.99)).wicket).toBe(false);
  });
  it('deliveries get faster through the innings', () => {
    expect(nextBall(0, fixed(0.5)).dur).toBeGreaterThan(nextBall(9, fixed(0.5)).dur);
  });
});
