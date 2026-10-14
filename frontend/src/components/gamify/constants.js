// TV mounted on the living room's back wall. Room.jsx's real player element is
// CSS-matrix3d'd onto this exact quad (GamifyFloorPlan's TvProjector), so the
// video genuinely appears to play on this screen. TV_NATIVE_* must match
// GAMIFY_TV_NATIVE_WIDTH/HEIGHT in Room.jsx.
//
// TV_LOCAL is the TV in the living room's own authoring frame (rooms.jsx);
// TV is the same screen in world space, after the room's placement shift.
export const HALL_SHIFT = { x: -3, z: -6 };
export const TV_LOCAL = { cx: 0, cy: 2.75, z: -9.86, w: 4.8 };
export const TV = { cx: TV_LOCAL.cx + HALL_SHIFT.x, cy: TV_LOCAL.cy, z: TV_LOCAL.z + HALL_SHIFT.z, w: TV_LOCAL.w };
export const TV_NATIVE_W = 420;
export const TV_NATIVE_H = 270;
export const TV_H = TV.w * (TV_NATIVE_H / TV_NATIVE_W);

export const NEON_PINK = '#ff4fd8';
export const NEON_CYAN = '#3ee8ff';
export const NEON_VIOLET = '#8b5cff';
export const NEON_AMBER = '#ffb347';
