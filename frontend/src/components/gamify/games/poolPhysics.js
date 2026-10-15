// Pure 8-ball pool physics + a simple computer opponent. Units are pixels on an
// 800 x 400 playing surface; time is in seconds.

export const TABLE = { w: 800, h: 400, r: 10, pocketR: 19 };
export const MAX_SPEED = 1700;
const REST_BALL = 0.96;
const REST_WALL = 0.82;

export const POCKETS = [
  [0, 0], [TABLE.w / 2, 0], [TABLE.w, 0],
  [0, TABLE.h], [TABLE.w / 2, TABLE.h], [TABLE.w, TABLE.h],
];

export const groupOf = (id) => (id === 0 ? 'cue' : id === 8 ? 'eight' : id < 8 ? 'solid' : 'stripe');

// Cue ball + the standard triangle. The 8 sits in the middle of the third row and
// the two back corners hold one solid and one stripe.
export function rackBalls(rng = Math.random) {
  const balls = [{ id: 0, x: 200, y: TABLE.h / 2, vx: 0, vy: 0, out: false }];
  const r = TABLE.r;
  const dx = r * 2 * Math.cos(Math.PI / 6) + 0.6;
  const rest = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const solidIdx = rest.findIndex(n => n < 8);
  const stripeIdx = rest.findIndex(n => n > 8);
  // corner slots are positions 10 and 14 in rack order (before the 8 is slotted in)
  const slots = [];
  for (let row = 0; row < 5; row++) for (let k = 0; k <= row; k++) slots.push([row, k]);
  const order = new Array(15).fill(0);
  order[4] = 8;
  const pool = [...rest];
  const takeAt = (idx) => pool.splice(idx, 1)[0];
  order[10] = takeAt(pool.indexOf(rest[solidIdx]));
  order[14] = takeAt(pool.indexOf(rest[stripeIdx]));
  for (let i = 0; i < 15; i++) if (!order[i]) order[i] = pool.shift();
  slots.forEach(([row, k], i) => {
    balls.push({ id: order[i], x: 560 + row * dx, y: TABLE.h / 2 + (k - row / 2) * (r * 2 + 0.6), vx: 0, vy: 0, out: false });
  });
  return balls;
}

export const speedOf = (b) => Math.hypot(b.vx, b.vy);
export const allStopped = (balls) => balls.every(b => b.out || (b.vx === 0 && b.vy === 0));

function sub(balls, h, ev) {
  const R = TABLE.r;
  for (const b of balls) {
    if (b.out) continue;
    b.x += b.vx * h;
    b.y += b.vy * h;
    for (const [px, py] of POCKETS) {
      if (Math.hypot(b.x - px, b.y - py) < TABLE.pocketR) {
        b.out = true; b.vx = 0; b.vy = 0;
        ev.pocketed.push(b.id);
        break;
      }
    }
    if (b.out) continue;
    if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * REST_WALL; }
    else if (b.x > TABLE.w - R) { b.x = TABLE.w - R; b.vx = -Math.abs(b.vx) * REST_WALL; }
    if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * REST_WALL; }
    else if (b.y > TABLE.h - R) { b.y = TABLE.h - R; b.vy = -Math.abs(b.vy) * REST_WALL; }
    // friction: smooth drag plus a constant rolling resistance
    const drag = Math.exp(-0.55 * h);
    b.vx *= drag; b.vy *= drag;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 0) {
      const ns = sp - 22 * h;
      if (ns <= 6) { b.vx = 0; b.vy = 0; } else { b.vx *= ns / sp; b.vy *= ns / sp; }
    }
  }
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (a.out) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const c = balls[j];
      if (c.out) continue;
      const dx = a.x - c.x;
      const dy = a.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d >= R * 2 || d === 0) continue;
      const nx = dx / d;
      const ny = dy / d;
      const overlap = (R * 2 - d) / 2;
      a.x += nx * overlap; a.y += ny * overlap;
      c.x -= nx * overlap; c.y -= ny * overlap;
      const rel = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
      if (rel < 0) {
        const imp = -(1 + REST_BALL) * rel / 2;
        a.vx += imp * nx; a.vy += imp * ny;
        c.vx -= imp * nx; c.vy -= imp * ny;
        ev.hits += 1;
        if (ev.firstHit == null && (a.id === 0 || c.id === 0)) ev.firstHit = a.id === 0 ? c.id : a.id;
      }
    }
  }
}

// Advances the table by dt seconds. `ev` collects { pocketed: [ids], firstHit, hits }.
export function stepPool(balls, dt, ev = { pocketed: [], firstHit: null, hits: 0 }) {
  let maxV = 0;
  for (const b of balls) if (!b.out) maxV = Math.max(maxV, Math.hypot(b.vx, b.vy));
  const n = Math.max(1, Math.ceil((maxV * dt) / (TABLE.r * 0.5)));
  for (let i = 0; i < n; i++) sub(balls, dt / n, ev);
  return ev;
}

export function shoot(balls, angle, power) {
  const cue = balls[0];
  const p = Math.max(0.05, Math.min(1, power));
  cue.vx = Math.cos(angle) * p * MAX_SPEED;
  cue.vy = Math.sin(angle) * p * MAX_SPEED;
}

// Distance from point (px,py) to the segment a-b.
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Where the cue ball's aim line first touches a ball or cushion (for the guide line).
export function aimTrace(balls, angle) {
  const cue = balls[0];
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = 1e9;
  let hit = null;
  for (const b of balls) {
    if (b.out || b.id === 0) continue;
    const ox = b.x - cue.x;
    const oy = b.y - cue.y;
    const proj = ox * dx + oy * dy;
    if (proj <= 0) continue;
    const perp = Math.abs(ox * dy - oy * dx);
    if (perp >= TABLE.r * 2) continue;
    const t = proj - Math.sqrt(Math.max(0, (TABLE.r * 2) ** 2 - perp * perp));
    if (t < best) { best = t; hit = b; }
  }
  const tx = dx > 0 ? (TABLE.w - TABLE.r - cue.x) / dx : dx < 0 ? (TABLE.r - cue.x) / dx : 1e9;
  const ty = dy > 0 ? (TABLE.h - TABLE.r - cue.y) / dy : dy < 0 ? (TABLE.r - cue.y) / dy : 1e9;
  const wall = Math.min(tx, ty);
  const t = Math.min(best, wall);
  return { x: cue.x + dx * t, y: cue.y + dy * t, ball: best <= wall ? hit : null };
}

// The balls a player is allowed to hit next.
export function legalTargets(balls, group) {
  const live = balls.filter(b => !b.out && b.id !== 0);
  if (!group) return live.filter(b => b.id !== 8);
  const mine = live.filter(b => groupOf(b.id) === group);
  return mine.length ? mine : live.filter(b => b.id === 8);
}

// Simple computer player: ghost-ball aiming at the easiest clean pot, with a little
// human-like error. Falls back to a plain hit on the nearest legal ball.
export function cpuChoose(balls, group, rng = Math.random, error = 0.018) {
  const cue = balls[0];
  const R = TABLE.r;
  const targets = legalTargets(balls, group);
  let best = null;
  const clear = (ax, ay, bx, by, skipIds) => balls.every(b => b.out || b.id === 0 || skipIds.includes(b.id) || segDist(b.x, b.y, ax, ay, bx, by) > R * 2 - 1);
  for (const t of targets) {
    for (const [px, py] of POCKETS) {
      const ux = px - t.x;
      const uy = py - t.y;
      const ul = Math.hypot(ux, uy) || 1;
      const gx = t.x - (ux / ul) * R * 2;
      const gy = t.y - (uy / ul) * R * 2;
      if (gx < R || gx > TABLE.w - R || gy < R || gy > TABLE.h - R) continue;
      const cx = gx - cue.x;
      const cy = gy - cue.y;
      const cl = Math.hypot(cx, cy) || 1;
      const cut = (cx / cl) * (ux / ul) + (cy / cl) * (uy / ul);
      if (cut < 0.25) continue;
      if (!clear(cue.x, cue.y, gx, gy, [t.id]) || !clear(t.x, t.y, px, py, [t.id])) continue;
      const score = cl + ul * 1.4 + (1 - cut) * 220;
      if (!best || score < best.score) best = { score, angle: Math.atan2(cy, cx), power: Math.max(0.3, Math.min(0.95, 0.22 + (cl + ul) / 1050)) };
    }
  }
  if (!best) {
    const pool = targets.length ? targets : balls.filter(b => !b.out && b.id !== 0);
    const near = [...pool].sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y))[0];
    return { angle: Math.atan2(near.y - cue.y, near.x - cue.x) + (rng() - 0.5) * 0.08, power: 0.55 };
  }
  const noise = (rng() + rng() + rng() - 1.5) * error * 2;
  return { angle: best.angle + noise, power: best.power };
}
