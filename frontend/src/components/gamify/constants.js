// TV mounted on the living room's back wall. Room.jsx's real player element is
// CSS-matrix3d'd onto this exact quad (GamifyFloorPlan's TvProjector), so the
// video genuinely appears to play on this screen. TV_NATIVE_* must match
// GAMIFY_TV_NATIVE_WIDTH/HEIGHT in Room.jsx.
//
// TV_LOCAL is the TV in the living room's own authoring frame (rooms.jsx);
// TV is the same screen in world space, after the room's placement shift.
// hall was authored with its origin at (-6, -10); it now sits in the hall cell
import { FLOORPLAN_ZONES, FLOOR2_ZONES, FLOOR_Y } from '../../data/gamifyZones';
export const HALL_SHIFT = { x: FLOORPLAN_ZONES.hall.world.x0 + 6, z: FLOORPLAN_ZONES.hall.world.z0 + 10 };
export const TV_LOCAL = { cx: 0, cy: 2.75, z: -9.86, w: 4.8 };
export const TV = { cx: TV_LOCAL.cx + HALL_SHIFT.x, cy: TV_LOCAL.cy, z: TV_LOCAL.z + HALL_SHIFT.z, w: TV_LOCAL.w };
export const TV_NATIVE_W = 420;
export const TV_NATIVE_H = 270;
export const TV_H = TV.w * (TV_NATIVE_H / TV_NATIVE_W);
// The upstairs hall's TV (floor2.jsx): the video plays here instead while you are upstairs.
const UP = FLOOR2_ZONES.f2hall.world;
export const TV_UP = { cx: UP.x0 + 9, cy: FLOOR_Y + 2.5, z: UP.z0 + 0.51, w: 5.0 };
export const TV_UP_H = TV_UP.w * (TV_NATIVE_H / TV_NATIVE_W);

export const NEON_PINK = '#ff4fd8';
export const NEON_CYAN = '#3ee8ff';
export const NEON_VIOLET = '#8b5cff';
export const NEON_AMBER = '#ffb347';
