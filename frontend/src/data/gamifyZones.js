// Gamify Mode — shared house layout.
//
// The house is a 3x2 grid of large rooms laid out in WORLD units. The camera
// shows ONE room at a time (filling the screen) and glides between them, so
// every cell is big enough to hold a crowd. "Virtual" coordinates
// (0-1000 x 0-600) are what avatar positions travel as over the socket and what
// the server validates; they map linearly onto the world floor, so the backend
// and every viewer agree on positions regardless of camera angle, window size,
// or whether a viewer has flipped their view. The backend keeps its own copy of
// the zone id list (server.js, avatar_move) — keep the two in sync.

export const CELL_W = 18; // along x
export const CELL_D = 16; // along z
export const COLS = 3;
export const ROWS = 3;
export const WORLD_W = CELL_W * COLS;
export const WORLD_D = CELL_D * ROWS;
export const FLOORPLAN_WIDTH = 1000;
export const FLOORPLAN_HEIGHT = 600;

// Where each doorway is cut, in cell-local units measured from the cell's
// back (z) or left (x) edge. Chosen per door to keep clear of furniture on both
// sides (rooms.jsx) — change them together.
const V_DOOR_AT = [[5, 6.8], [12.5, 12.5], [8, 8]]; // [row][col] — doors between col c and c+1
const H_DOOR_AT = [[8.5, 6.6, 4.8], [10.5, 15.6, 8.4]]; // [row boundary][col] — doors between row r and r+1

const zone = (id, label, col, row) => {
  const x0 = -WORLD_W / 2 + col * CELL_W;
  const z0 = -WORLD_D / 2 + row * CELL_D;
  const x1 = x0 + CELL_W;
  const z1 = z0 + CELL_D;
  return {
    id,
    label,
    col,
    row,
    world: { x0, x1, z0, z1 },
    center: { x: (x0 + x1) / 2, z: (z0 + z1) / 2 },
    x: ((x0 + WORLD_W / 2) / WORLD_W) * FLOORPLAN_WIDTH,
    y: ((z0 + WORLD_D / 2) / WORLD_D) * FLOORPLAN_HEIGHT,
    width: ((x1 - x0) / WORLD_W) * FLOORPLAN_WIDTH,
    height: ((z1 - z0) / WORLD_D) * FLOORPLAN_HEIGHT,
  };
};

export const FLOORPLAN_ZONES = {
  study: zone('study', 'Study', 0, 0),
  hall: zone('hall', 'Living Room', 1, 0),
  bedroom: zone('bedroom', 'Bedroom', 2, 0),
  kitchen: zone('kitchen', 'Kitchen', 0, 1),
  gameroom: zone('gameroom', 'Game Room', 1, 1),
  lawn: zone('lawn', 'Garden', 2, 1),
  terrace: zone('terrace', 'Terrace', 0, 2),
  frontyard: zone('frontyard', 'Front Yard', 1, 2),
  courtyard: zone('courtyard', 'Courtyard', 2, 2),
};

export const ZONE_IDS = Object.keys(FLOORPLAN_ZONES);
const ZONE_LIST = Object.values(FLOORPLAN_ZONES);
const byCell = (c, r) => ZONE_LIST.find(z => z.col === c && z.row === r);

// Every doorway between two neighbouring rooms. axis 'v' = a doorway cut into a
// wall that runs along z (joins left/right neighbours); 'h' = cut into the wall
// along x (joins the back row to the front row).
export const DOORWAYS = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS - 1; c++) {
    const a = byCell(c, r);
    const b = byCell(c + 1, r);
    DOORWAYS.push({ axis: 'v', x: b.world.x0, z: a.world.z0 + V_DOOR_AT[r][c], a: a.id, b: b.id });
  }
}
for (let r = 0; r < ROWS - 1; r++) {
  for (let c = 0; c < COLS; c++) {
    const a = byCell(c, r);
    const b = byCell(c, r + 1);
    DOORWAYS.push({ axis: 'h', x: a.world.x0 + H_DOOR_AT[r][c], z: b.world.z0, a: a.id, b: b.id });
  }
}

// One clickable "go to <room>" hotspot per side of each doorway. `chip` is where
// the hotspot floats (inside the room you're leaving); `entry` is where your
// avatar lands (just inside the room you're entering).
export const DOOR_LINKS = DOORWAYS.flatMap(d => (d.axis === 'v'
  ? [
    { from: d.a, to: d.b, chip: { x: d.x - 2.2, z: d.z }, entry: { x: d.x + 3.2, z: d.z } },
    { from: d.b, to: d.a, chip: { x: d.x + 2.2, z: d.z }, entry: { x: d.x - 3.2, z: d.z } },
  ]
  : [
    { from: d.a, to: d.b, chip: { x: d.x, z: d.z - 2.2 }, entry: { x: d.x, z: d.z + 3.2 } },
    { from: d.b, to: d.a, chip: { x: d.x, z: d.z + 2.2 }, entry: { x: d.x, z: d.z - 3.2 } },
  ]));

export const worldToVirtual = (wx, wz) => ({
  x: (wx / WORLD_W + 0.5) * FLOORPLAN_WIDTH,
  y: (wz / WORLD_D + 0.5) * FLOORPLAN_HEIGHT,
});

// Open floor in the living room, in front of the TV area — where an avatar
// with no known position (brand-new join) is shown by default.
const hall = FLOORPLAN_ZONES.hall;
const spawn = worldToVirtual(hall.world.x0 + 12, hall.world.z0 + 9);
export const DEFAULT_SPAWN = { x: spawn.x, y: spawn.y, zone: 'hall' };

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
