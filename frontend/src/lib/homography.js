// Solves the 2D perspective transform (homography) that maps the corners of a
// w x h rectangle onto an arbitrary four-point quad, so a flat DOM element
// (the real video player) can be CSS-matrix3d'd exactly onto a TV screen that
// is drawn at an angle in a 3D scene.
//
// dst corners are in the same order as the source rectangle: top-left,
// top-right, bottom-right, bottom-left, in the destination's pixel space.

export function solveHomography(w, h, dst) {
  const src = [[0, 0], [w, 0], [w, h], [0, h]];
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [X, Y] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y);
  }
  // Gaussian elimination with partial pivoting on the 8x8 system.
  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    const div = A[col][col];
    if (Math.abs(div) < 1e-12) return null;
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / div;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  const sol = new Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let c = r + 1; c < n; c++) s -= A[r][c] * sol[c];
    sol[r] = s / A[r][r];
  }
  return sol; // [a, b, c, d, e, f, g, h]
}

export function applyHomography(sol, x, y) {
  const [a, b, c, d, e, f, g, h] = sol;
  const k = g * x + h * y + 1;
  return [(a * x + b * y + c) / k, (d * x + e * y + f) / k];
}

export function homographyMatrix3d(w, h, dst) {
  const s = solveHomography(w, h, dst);
  if (!s) return null;
  const [a, b, c, d, e, f, g, hh] = s;
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
}
