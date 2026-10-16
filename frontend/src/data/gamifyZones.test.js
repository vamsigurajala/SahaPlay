import { describe, it, expect } from 'vitest';
import { FLOORPLAN_ZONES, ZONE_IDS, DEFAULT_SPAWN, DOORWAYS, DOOR_LINKS, DOOR_LINKS_F2, STAIR_LINKS, GATE_LINKS, FLOOR2_ZONES, zoneForPoint, FLOORPLAN_WIDTH, FLOORPLAN_HEIGHT, WORLD_W, WORLD_D } from './gamifyZones';

describe('gamify zones', () => {
  it('every zone center resolves back to its own zone', () => {
    for (const z of Object.values(FLOORPLAN_ZONES)) {
      expect(zoneForPoint(z.x + z.width / 2, z.y + z.height / 2)).toBe(z.id);
    }
  });

  it('zones do not overlap: the 3x3 house plus the cricket ground fill 10 of the 12 grid cells', () => {
    const area = Object.values(FLOORPLAN_ZONES).reduce((s, z) => s + z.width * z.height, 0);
    expect(area).toBeCloseTo((FLOORPLAN_WIDTH * FLOORPLAN_HEIGHT * 10) / 12, 4);
  });

  it('the front yard gate links to the cricket ground and back', () => {
    const toVirtual = (p) => [(p.x / WORLD_W + 0.5) * FLOORPLAN_WIDTH, (p.z / WORLD_D + 0.5) * FLOORPLAN_HEIGHT];
    expect(GATE_LINKS).toHaveLength(2);
    for (const l of GATE_LINKS) {
      expect(zoneForPoint(...toVirtual(l.chip))).toBe(l.from);
      expect(zoneForPoint(...toVirtual(l.entry))).toBe(l.to);
    }
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

  it('upstairs rooms resolve on floor 1 and every link lands in its destination room', () => {
    const toVirtual = (p) => [(p.x / WORLD_W + 0.5) * FLOORPLAN_WIDTH, (p.z / WORLD_D + 0.5) * FLOORPLAN_HEIGHT];
    for (const z of Object.values(FLOOR2_ZONES)) {
      expect(zoneForPoint(z.x + z.width / 2, z.y + z.height / 2, 1)).toBe(z.id);
    }
    for (const l of [...DOOR_LINKS_F2, ...STAIR_LINKS]) {
      const floor = (id) => (id.startsWith('f2') ? 1 : 0);
      expect(zoneForPoint(...toVirtual(l.entry), floor(l.to))).toBe(l.to);
      expect(zoneForPoint(...toVirtual(l.chip), floor(l.from))).toBe(l.from);
    }
  });
});
