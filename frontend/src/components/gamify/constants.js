// TV mounted on the living room's back wall. Room.jsx's real player element is
// CSS-matrix3d'd onto this exact quad (GamifyFloorPlan's TvProjector), so the
// video genuinely appears to play on this screen. TV_NATIVE_* must match
// GAMIFY_TV_NATIVE_WIDTH/HEIGHT in Room.jsx.
export const TV = { cx: 0, cy: 2.75, z: -9.86, w: 4.8 };
export const TV_NATIVE_W = 420;
export const TV_NATIVE_H = 270;
export const TV_H = TV.w * (TV_NATIVE_H / TV_NATIVE_W);

export const NEON_PINK = '#ff4fd8';
export const NEON_CYAN = '#3ee8ff';
export const NEON_VIOLET = '#8b5cff';
export const NEON_AMBER = '#ffb347';
