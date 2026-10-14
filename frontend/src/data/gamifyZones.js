// Gamify Mode — Phase 1 static floor-plan config.
//
// Fixed virtual coordinate space (1000 x 600 units), independent of the
// actual rendered pixel size of GamifyFloorPlan's container — the component
// scales this uniformly to fit whatever space it's given, so avatar
// positions (sent over the socket in these same virtual units) stay valid
// and comparable across viewers regardless of their own window size.
//
// Placeholder flat-color rectangles only for Phase 1 — real furniture/room
// art is a later phase.

export const FLOORPLAN_WIDTH = 1000;
export const FLOORPLAN_HEIGHT = 600;

export const FLOORPLAN_ZONES = {
  hall: { id: 'hall', label: 'Hall', x: 0, y: 0, width: 600, height: 600, color: '#2b2f77' },
  bedroom: { id: 'bedroom', label: 'Bedroom', x: 600, y: 0, width: 400, height: 300, color: '#6b3f6b' },
  lawn: { id: 'lawn', label: 'Lawn', x: 600, y: 300, width: 400, height: 300, color: '#2f6b3f' },
};

// TV + couch props, positioned in the SAME virtual coordinate space as the
// zones above (not relative to the Hall's own x/y) — simplest for hit-testing
// and rendering, since everything shares one coordinate system.
export const HALL_PROPS = {
  tv: { x: 420, y: 40, width: 140, height: 90, color: '#111111' },
  couch: { x: 60, y: 420, width: 220, height: 90, color: '#8a5a3b' },
};

// Hall center — where an avatar with no known position (brand-new join,
// hasn't moved yet) is shown by default.
export const DEFAULT_SPAWN = { x: 300, y: 300, zone: 'hall' };

const ZONE_LIST = Object.values(FLOORPLAN_ZONES);

// Which zone does a given virtual-space point fall inside? Falls back to
// whichever zone is closest by center distance if the point is somehow
// outside every zone rect (e.g. dragged slightly past an edge) — avatars
// should never end up with no zone at all.
export function zoneForPoint(x, y) {
  for (const zone of ZONE_LIST) {
    if (x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height) {
      return zone.id;
    }
  }
  let closest = ZONE_LIST[0];
  let closestDist = Infinity;
  for (const zone of ZONE_LIST) {
    const cx = zone.x + zone.width / 2;
    const cy = zone.y + zone.height / 2;
    const dist = (x - cx) ** 2 + (y - cy) ** 2;
    if (dist < closestDist) { closestDist = dist; closest = zone; }
  }
  return closest.id;
}

// Keep a point inside the overall floor-plan bounds (dragging shouldn't be
// able to push an avatar off the edge of the scene entirely).
export function clampToFloorplan(x, y) {
  return {
    x: Math.max(0, Math.min(FLOORPLAN_WIDTH, x)),
    y: Math.max(0, Math.min(FLOORPLAN_HEIGHT, y)),
  };
}
