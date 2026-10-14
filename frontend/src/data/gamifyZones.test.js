import { describe, it, expect } from 'vitest';
import { FLOORPLAN_ZONES, ZONE_IDS, DEFAULT_SPAWN, DOORWAYS, DOOR_LINKS, zoneForPoint, FLOORPLAN_WIDTH, FLOORPLAN_HEIGHT, WORLD_W, WORLD_D } from './gamifyZones';

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

  it('every doorway joins two rooms and gets a hotspot on each side landing in the other room', () => {
    // 3x3 grid: 2 doors per row between columns (6) + 3 per row boundary (6)
    expect(DOORWAYS).toHaveLength(12);
    expect(DOOR_LINKS).toHaveLength(24);
    const toVirtual = (p) => [(p.x / WORLD_W + 0.5) * FLOORPLAN_WIDTH, (p.z / WORLD_D + 0.5) * FLOORPLAN_HEIGHT];
    for (const l of DOOR_LINKS) {
      expect(zoneForPoint(...toVirtual(l.chip))).toBe(l.from);
      expect(zoneForPoint(...toVirtual(l.entry))).toBe(l.to);
    }
  });
});
