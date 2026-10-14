import { describe, it, expect } from 'vitest';
import { FLOORPLAN_ZONES, ZONE_IDS, DEFAULT_SPAWN, zoneForPoint, FLOORPLAN_WIDTH, FLOORPLAN_HEIGHT } from './gamifyZones';

describe('gamify zones', () => {
  it('every zone center resolves back to its own zone', () => {
    for (const z of Object.values(FLOORPLAN_ZONES)) {
      expect(zoneForPoint(z.x + z.width / 2, z.y + z.height / 2)).toBe(z.id);
    }
  });

  it('zones tile the whole floor with no gaps or overlap', () => {
    const area = Object.values(FLOORPLAN_ZONES).reduce((s, z) => s + z.width * z.height, 0);
    expect(area).toBeCloseTo(FLOORPLAN_WIDTH * FLOORPLAN_HEIGHT, 4);
  });

  it('default spawn lands in the living room, and out-of-bounds points still get a zone', () => {
    expect(zoneForPoint(DEFAULT_SPAWN.x, DEFAULT_SPAWN.y)).toBe('hall');
    expect(ZONE_IDS).toContain(zoneForPoint(-50, 9999));
  });
});
