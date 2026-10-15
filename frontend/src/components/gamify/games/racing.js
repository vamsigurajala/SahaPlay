// Track + car helpers for the racing game (pure, so they can be tested).

export const TRACK_W = 1400;
export const TRACK_H = 900;
export const ROAD = 96; // road width

const CONTROL = [
  [300, 150], [700, 110], [1100, 160], [1280, 330], [1150, 520], [1180, 740],
  [850, 800], [600, 640], [400, 760], [170, 640], [150, 400], [220, 260],
];

// Closed Catmull-Rom spline through the control points.
export function buildTrack(perSegment = 22) {
  const n = CONTROL.length;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const p0 = CONTROL[(i - 1 + n) % n];
    const p1 = CONTROL[i];
    const p2 = CONTROL[(i + 1) % n];
    const p3 = CONTROL[(i + 2) % n];
    for (let k = 0; k < perSegment; k++) {
      const t = k / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      pts.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  return pts;
}

export const TRACK = buildTrack();

// Nearest centre-line sample to (x,y), searching a window around `near`.
export function nearestIndex(x, y, near, window = 14) {
  const n = TRACK.length;
  let best = near;
  let bd = Infinity;
  for (let k = -window; k <= window; k++) {
    const i = (near + k + n) % n;
    const d = (TRACK[i][0] - x) ** 2 + (TRACK[i][1] - y) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return { idx: best, dist: Math.sqrt(bd) };
}

// Updates a car's lap counter from how its nearest-sample index moved.
export function advanceLap(car, newIdx) {
  const n = TRACK.length;
  const old = car.idx;
  if (old > n * 0.8 && newIdx < n * 0.2) car.lap += 1;
  else if (old < n * 0.2 && newIdx > n * 0.8) car.lap -= 1;
  car.idx = newIdx;
  car.prog = car.lap * n + newIdx;
}

export const startGrid = () => {
  const [x0, y0] = TRACK[0];
  const [x1, y1] = TRACK[3];
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const slots = [[-34, -22], [-34, 22], [-84, -22], [-84, 22]]; // [back, side]
  return slots.map(([back, side]) => ({
    x: x0 + Math.cos(ang) * back - Math.sin(ang) * side,
    y: y0 + Math.sin(ang) * back + Math.cos(ang) * side,
    a: ang,
  }));
};

export const wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// Steering + throttle for an AI car aiming at a point `look` samples ahead.
export function aiControl(car, look = 7) {
  const n = TRACK.length;
  const target = TRACK[(car.idx + look) % n];
  const want = Math.atan2(target[1] - car.y, target[0] - car.x);
  const diff = wrapAngle(want - car.a);
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  const sharp = Math.abs(diff);
  const throttle = sharp > 0.7 ? 0.35 : sharp > 0.4 ? 0.7 : 1;
  return { steer, throttle };
}
