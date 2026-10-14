// Gamify Mode — shared zone layout.
//
// "Virtual" coordinates (1000 x 600 units) are what avatars' positions travel
// as over the socket and what the server validates against. They're
// independent of how the 3D scene is drawn: components/gamify/Avatar3D.jsx
// maps them linearly onto the 3D room's floor, so the backend and every
// viewer agree on positions regardless of camera angle or window size.

export const FLOORPLAN_WIDTH = 1000;
export const FLOORPLAN_HEIGHT = 600;

export const FLOORPLAN_ZONES = {
  hall: { id: 'hall', label: 'Hall', x: 0, y: 0, width: 600, height: 600 },
  bedroom: { id: 'bedroom', label: 'Bedroom', x: 600, y: 0, width: 400, height: 300 },
  lawn: { id: 'lawn', label: 'Lawn', x: 600, y: 300, width: 400, height: 300 },
};

// Hall center — where an avatar with no known position (brand-new join,
// hasn't moved yet) is shown by default.
export const DEFAULT_SPAWN = { x: 300, y: 300, zone: 'hall' };

const ZONE_LIST = Object.values(FLOORPLAN_ZONES);

// Which zone does a given virtual-space point fall inside? Falls back to
// whichever zone is closest by center distance if the point is somehow
// outside every zone rect — avatars should never end up with no zone at all.
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
