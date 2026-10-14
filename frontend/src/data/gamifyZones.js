// Gamify Mode — shared house layout.
//
// The house is laid out in WORLD units (x: -16..16, z: -10..10) — a 3x2 grid
// of rooms. "Virtual" coordinates (0-1000 x 0-600) are what avatar positions
// travel as over the socket and what the server validates; they map linearly
// onto the world floor, so the backend and every viewer agree on positions
// regardless of camera angle, window size, or whether a viewer has flipped
// their view. The backend keeps its own copy of the zone id list
// (server.js, avatar_move) — keep the two in sync.

export const WORLD_W = 32;
export const WORLD_D = 20;
export const FLOORPLAN_WIDTH = 1000;
export const FLOORPLAN_HEIGHT = 600;

const zone = (id, label, x0, x1, z0, z1) => ({
  id,
  label,
  world: { x0, x1, z0, z1 },
  x: ((x0 + WORLD_W / 2) / WORLD_W) * FLOORPLAN_WIDTH,
  y: ((z0 + WORLD_D / 2) / WORLD_D) * FLOORPLAN_HEIGHT,
  width: ((x1 - x0) / WORLD_W) * FLOORPLAN_WIDTH,
  height: ((z1 - z0) / WORLD_D) * FLOORPLAN_HEIGHT,
});

export const FLOORPLAN_ZONES = {
  study: zone('study', 'Study', -16, -6, -10, 0),
  hall: zone('hall', 'Living Room', -6, 6, -10, 0),
  bedroom: zone('bedroom', 'Bedroom', 6, 16, -10, 0),
  kitchen: zone('kitchen', 'Kitchen', -16, -6, 0, 10),
  gameroom: zone('gameroom', 'Game Room', -6, 6, 0, 10),
  lawn: zone('lawn', 'Garden', 6, 16, 0, 10),
};

export const ZONE_IDS = Object.keys(FLOORPLAN_ZONES);

// Living-room center — where an avatar with no known position (brand-new
// join, hasn't moved yet) is shown by default.
export const DEFAULT_SPAWN = { x: 500, y: 210, zone: 'hall' };

const ZONE_LIST = Object.values(FLOORPLAN_ZONES);

// Which zone does a given virtual-space point fall inside? Falls back to
// whichever zone is closest by center distance if the point is somehow
// outside every zone rect — avatars should never end up with no zone at all.
export function zoneForPoint(x, y) {
  for (const z of ZONE_LIST) {
    if (x >= z.x && x <= z.x + z.width && y >= z.y && y <= z.y + z.height) return z.id;
  }
  let closest = ZONE_LIST[0];
  let closestDist = Infinity;
  for (const z of ZONE_LIST) {
    const cx = z.x + z.width / 2;
    const cy = z.y + z.height / 2;
    const dist = (x - cx) ** 2 + (y - cy) ** 2;
    if (dist < closestDist) { closestDist = dist; closest = z; }
  }
  return closest.id;
}
