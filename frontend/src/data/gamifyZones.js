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
// The house is 3 rows deep. In front of it lies a street (row 3) and, across the
// road, the open-air cricket ground (row 4) — so the ground is not attached to the house.
export const HOUSE_ROWS = 3;
export const ROWS = 5;
export const HOUSE_D = CELL_D * HOUSE_ROWS;
export const WORLD_W = CELL_W * COLS;
export const WORLD_D = CELL_D * ROWS;
export const FLOORPLAN_WIDTH = 1000;
export const FLOORPLAN_HEIGHT = 600;

// Where each doorway is cut, in cell-local units measured from the cell's
// back (z) or left (x) edge. Chosen per door to keep clear of furniture on both
// sides (rooms.jsx) — change them together.
const V_DOOR_AT = [[5, 6.8], [12.5, 12.5], [8, 8]]; // [row][col] — doors between col c and c+1
const H_DOOR_AT = [[8.5, 6.6, 4.8], [10.5, 15.6, 8.4]]; // [row boundary][col] — doors between row r and r+1

// Second floor: sits FLOOR_Y above the ground floor, over the back two rows.
export const FLOOR_Y = 5.8;

const zone = (id, label, col, row, floor = 0) => {
  const x0 = -WORLD_W / 2 + col * CELL_W;
  const z0 = -WORLD_D / 2 + row * CELL_D;
  const x1 = x0 + CELL_W;
  const z1 = z0 + CELL_D;
  return {
    id,
    label,
    col,
    row,
    floor,
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
  terrace: zone('terrace', 'Veranda', 0, 2),
  frontyard: zone('frontyard', 'Front Yard', 1, 2),
  courtyard: zone('courtyard', 'Courtyard', 2, 2),
  street: zone('street', 'Street', 1, 3),
  cricket: zone('cricket', 'Cricket Ground', 1, 4),
  market: zone('market', 'Market', 2, 4),
};

// Upstairs: two bedrooms, a living room, a kitchen and a balcony (the
// remaining cell in the front row is open air). Same x/z grid as downstairs, so
// avatar positions keep using the same virtual coordinates; only the zone id
// says which floor you are on.
export const FLOOR2_ZONES = {
  f2bed1: zone('f2bed1', 'Master Bedroom', 0, 0, 1),
  f2hall: zone('f2hall', 'Upstairs Hall', 1, 0, 1),
  f2bed2: zone('f2bed2', 'Guest Bedroom', 2, 0, 1),
  f2kitchen: zone('f2kitchen', 'Upstairs Kitchen', 0, 1, 1),
  f2balcony: zone('f2balcony', 'Balcony', 1, 1, 1),
};
export const ALL_ZONES = { ...FLOORPLAN_ZONES, ...FLOOR2_ZONES };
export const ZONE_IDS = Object.keys(ALL_ZONES);
const ZONE_LIST = Object.values(FLOORPLAN_ZONES);
const ZONE_LIST_2 = Object.values(FLOOR2_ZONES);
const byCell = (c, r) => ZONE_LIST.find(z => z.col === c && z.row === r);

// Every doorway between two neighbouring rooms. axis 'v' = a doorway cut into a
// wall that runs along z (joins left/right neighbours); 'h' = cut into the wall
// along x (joins the back row to the front row).
export const DOORWAYS = [];
for (let r = 0; r < HOUSE_ROWS; r++) {
  for (let c = 0; c < COLS - 1; c++) {
    const a = byCell(c, r);
    const b = byCell(c + 1, r);
    DOORWAYS.push({ axis: 'v', x: b.world.x0, z: a.world.z0 + V_DOOR_AT[r][c], a: a.id, b: b.id });
  }
}
for (let r = 0; r < HOUSE_ROWS - 1; r++) {
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

// Upstairs doorways (cell-local offsets from the back / left edge) and links.
const F2_DOORS = [
  { axis: 'v', x: -9, z: -WORLD_D / 2 + 6, a: 'f2bed1', b: 'f2hall' },
  { axis: 'v', x: 9, z: -WORLD_D / 2 + 6, a: 'f2hall', b: 'f2bed2' },
  { axis: 'v', x: -9, z: -WORLD_D / 2 + CELL_D + 12.5, a: 'f2kitchen', b: 'f2balcony' },
  { axis: 'h', x: -27 + 8.5, z: -WORLD_D / 2 + CELL_D, a: 'f2bed1', b: 'f2kitchen' },
  { axis: 'h', x: 0, z: -WORLD_D / 2 + CELL_D, a: 'f2hall', b: 'f2balcony' },
];
export const DOORWAYS_F2 = F2_DOORS;
const linksFor = (d) => (d.axis === 'v'
  ? [
    { from: d.a, to: d.b, chip: { x: d.x - 2.2, z: d.z }, entry: { x: d.x + 3.2, z: d.z } },
    { from: d.b, to: d.a, chip: { x: d.x + 2.2, z: d.z }, entry: { x: d.x - 3.2, z: d.z } },
  ]
  : [
    { from: d.a, to: d.b, chip: { x: d.x, z: d.z - 2.2 }, entry: { x: d.x, z: d.z + 3.2 } },
    { from: d.b, to: d.a, chip: { x: d.x, z: d.z + 2.2 }, entry: { x: d.x, z: d.z - 3.2 } },
  ]);
export const DOOR_LINKS_F2 = F2_DOORS.flatMap(linksFor);

// Stairs between floors: a chip in `from` that walks you to `entry` in `to`.
const hallZ = FLOORPLAN_ZONES.hall.world;
const f2hallZ = FLOOR2_ZONES.f2hall.world;
const yardZ = FLOORPLAN_ZONES.frontyard;
export const STAIR_LINKS = [
  { from: 'hall', to: 'f2hall', label: 'Go upstairs', dir: 'up', chip: { x: hallZ.x0 + 3.2, z: hallZ.z0 + 12.5 }, entry: { x: f2hallZ.x0 + 4, z: f2hallZ.z0 + 13 } },
  { from: 'frontyard', to: 'f2hall', label: 'Go to next floor', dir: 'up', chip: { x: yardZ.world.x0 + 13.4, z: yardZ.world.z1 - 2.6 }, entry: { x: f2hallZ.x0 + 4, z: f2hallZ.z0 + 13 } },
  { from: 'f2hall', to: 'hall', label: 'Go downstairs', dir: 'down', chip: { x: f2hallZ.x0 + 3.2, z: f2hallZ.z0 + 12.5 }, entry: { x: hallZ.x0 + 4, z: hallZ.z0 + 13 } },
];
// Open boundaries (gates), not doorways: the front-yard gate onto the street, and the
// street across the road to the cricket ground.
const streetZ = FLOORPLAN_ZONES.street;
const cricketZ = FLOORPLAN_ZONES.cricket;
const marketZ = FLOORPLAN_ZONES.market;
export const GATE_LINKS = [
  { from: 'frontyard', to: 'street', label: 'Go to the street', chip: { x: yardZ.world.x0 + 13.2, z: yardZ.world.z1 - 3.2 }, entry: { x: streetZ.world.x0 + 9, z: streetZ.world.z0 + 2 } },
  { from: 'street', to: 'frontyard', label: 'Back to the house', chip: { x: streetZ.world.x0 + 13.4, z: streetZ.world.z0 + 1.8 }, entry: { x: yardZ.world.x0 + 9, z: yardZ.world.z1 - 3.4 } },
  { from: 'street', to: 'cricket', label: 'Cricket ground', chip: { x: streetZ.world.x0 + 13.4, z: streetZ.world.z1 - 1.8 }, entry: { x: cricketZ.world.x0 + 9, z: cricketZ.world.z0 + 3 } },
  { from: 'cricket', to: 'market', label: 'Market', chip: { x: cricketZ.world.x1 - 2.4, z: cricketZ.world.z0 + 12.5 }, entry: { x: marketZ.world.x0 + 4.5, z: marketZ.world.z0 + 10 } },
  { from: 'market', to: 'cricket', label: 'Cricket ground', chip: { x: marketZ.world.x0 + 2.6, z: marketZ.world.z0 + 13.6 }, entry: { x: cricketZ.world.x1 - 4, z: cricketZ.world.z0 + 12 } },
  { from: 'cricket', to: 'street', label: 'Back to the street', chip: { x: cricketZ.world.x0 + 13.4, z: cricketZ.world.z0 + 2.8 }, entry: { x: streetZ.world.x0 + 9, z: streetZ.world.z1 - 2 } },
];
export const ALL_LINKS = [...DOOR_LINKS, ...DOOR_LINKS_F2, ...STAIR_LINKS, ...GATE_LINKS];

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
export function zoneForPoint(x, y, floor = 0) {
  const list = floor ? ZONE_LIST_2 : ZONE_LIST;
  for (const z of list) {
    if (x >= z.x && x <= z.x + z.width && y >= z.y && y <= z.y + z.height) return z.id;
  }
  let closest = list[0];
  let closestDist = Infinity;
  for (const z of list) {
    const cx = z.x + z.width / 2;
    const cy = z.y + z.height / 2;
    const dist = (x - cx) ** 2 + (y - cy) ** 2;
    if (dist < closestDist) { closestDist = dist; closest = z; }
  }
  return closest.id;
}
