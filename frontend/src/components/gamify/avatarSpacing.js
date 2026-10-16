// Keeps people from standing on top of each other. When you drop your avatar (or walk
// through a door, or visit a friend) on a spot that is already taken, you are placed
// right beside whoever is there instead.

export const MIN_GAP = 1.15; // how close two avatars may stand, in house units
const RINGS = [1.25, 2.1, 3.0];
const STEPS = 16;

const near = (x, z, others, gap) => others.find(o => Math.hypot(o.x - x, o.z - z) < gap);

// want: { x, z }; others: [{ x, z }] on the same floor; clamp: (x, z) => { x, z } keeps the spot inside the house.
export function freeSpot(want, others, clamp = (x, z) => ({ x, z })) {
  const first = near(want.x, want.z, others, MIN_GAP);
  if (!first) return want;
  // start on the side you came from, so you end up next to them rather than across them
  let base = Math.atan2(want.z - first.z, want.x - first.x);
  if (Math.hypot(want.x - first.x, want.z - first.z) < 0.01) base = 0;
  for (const r of RINGS) {
    for (let i = 0; i < STEPS; i++) {
      // 0, +1, -1, +2, -2 ... so the nearest angle to where you aimed is tried first
      const k = i === 0 ? 0 : (i % 2 ? (i + 1) / 2 : -i / 2);
      const a = base + (k * 2 * Math.PI) / STEPS;
      const c = clamp(first.x + Math.cos(a) * r, first.z + Math.sin(a) * r);
      if (!near(c.x, c.z, others, MIN_GAP * 0.95)) return c;
    }
  }
  return want; // a very full room: stand where you aimed
}
