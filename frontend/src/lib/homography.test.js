import { describe, it, expect } from 'vitest';
import { solveHomography, applyHomography, homographyMatrix3d } from './homography';

describe('homography', () => {
  it('maps the source rectangle corners exactly onto the destination quad', () => {
    const dst = [[100, 50], [420, 80], [400, 300], [90, 260]];
    const sol = solveHomography(420, 270, dst);
    const src = [[0, 0], [420, 0], [420, 270], [0, 270]];
    src.forEach(([x, y], i) => {
      const [X, Y] = applyHomography(sol, x, y);
      expect(X).toBeCloseTo(dst[i][0], 4);
      expect(Y).toBeCloseTo(dst[i][1], 4);
    });
  });

  it('is the identity (translation only) for an axis-aligned same-size quad', () => {
    const sol = solveHomography(200, 100, [[10, 20], [210, 20], [210, 120], [10, 120]]);
    const [X, Y] = applyHomography(sol, 100, 50);
    expect(X).toBeCloseTo(110, 4);
    expect(Y).toBeCloseTo(70, 4);
  });

  it('emits a matrix3d() string, and null for a degenerate quad', () => {
    expect(homographyMatrix3d(420, 270, [[0, 0], [100, 0], [100, 100], [0, 100]])).toMatch(/^matrix3d\(/);
    expect(homographyMatrix3d(420, 270, [[5, 5], [5, 5], [5, 5], [5, 5]])).toBeNull();
  });
});
