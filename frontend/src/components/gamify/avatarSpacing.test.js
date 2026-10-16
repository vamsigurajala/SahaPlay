import { describe, it, expect } from 'vitest';
import { freeSpot, MIN_GAP } from './avatarSpacing';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

describe('standing beside someone, not on top of them', () => {
  it('leaves you where you aimed when the spot is free', () => {
    expect(freeSpot({ x: 5, z: 5 }, [{ x: 10, z: 10 }])).toEqual({ x: 5, z: 5 });
    expect(freeSpot({ x: 5, z: 5 }, [])).toEqual({ x: 5, z: 5 });
  });

  it('puts you right beside the person whose spot you aimed at', () => {
    const other = { x: 5, z: 5 };
    const r = freeSpot({ x: 5.1, z: 5 }, [other]);
    expect(dist(r, other)).toBeGreaterThanOrEqual(MIN_GAP * 0.95);
    expect(dist(r, other)).toBeLessThan(2);
  });

  it('puts you on the side you came from', () => {
    const r = freeSpot({ x: 3, z: 5 }, [{ x: 3.4, z: 5 }]);
    expect(r.x).toBeLessThan(3.4);
  });

  it('finds the next free place when people already stand around', () => {
    const o = { x: 0, z: 0 };
    const crowd = [o, { x: 1.25, z: 0 }, { x: -1.25, z: 0 }];
    const r = freeSpot({ x: 0, z: 0 }, crowd);
    for (const c of crowd) expect(dist(r, c)).toBeGreaterThanOrEqual(MIN_GAP * 0.95);
  });

  it('stays inside the house when the room is clamped', () => {
    const clamp = (x, z) => ({ x: Math.min(x, 10), z });
    const r = freeSpot({ x: 10, z: 0 }, [{ x: 10, z: 0 }], clamp);
    expect(r.x).toBeLessThanOrEqual(10);
    expect(dist(r, { x: 10, z: 0 })).toBeGreaterThanOrEqual(MIN_GAP * 0.95);
  });
});
