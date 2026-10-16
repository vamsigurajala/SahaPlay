import { useRef, useContext } from 'react';
import { useFrame } from '@react-three/fiber';
import { ViewContext, ZoneContext } from './parts';
import { ALL_ZONES } from '../../data/gamifyZones';

// Each room in rooms.jsx is authored in its own original 10-12 unit frame; every
// room now sits in a much larger CELL_W x CELL_D cell. The original furniture is
// anchored to the cell's back-left corner (so everything that hugs the back/left
// walls still does), and the rest of the cell — open floor for a crowd of
// avatars plus extra furniture — is filled by each room's extras below, authored
// in cell-local (u, v) = (x from the left edge, z from the back edge).
const OLD_ORIGIN = {
  study: [-16, -10], hall: [-6, -10], bedroom: [6, -10],
  kitchen: [-16, 0], gameroom: [-6, 0], lawn: [6, 0],
};

// Furniture in rooms that are not on screen is hidden (the floors and walls
// stay), so the room you are in reads as one clean space filling the view. Other
// rooms come back as you drag towards them or zoom out.
export function Cell({ id, base, children }) {
  const view = useContext(ViewContext);
  const gate = useRef();
  const z = ALL_ZONES[id];
  const w = z.world;
  const [ox, oz] = OLD_ORIGIN[id] || [0, 0];
  useFrame(() => {
    const g = gate.current;
    if (!g) return;
    const v = view.current;
    const lx = v.flip ? v.pz : v.px;
    const lz = v.flip ? v.px : v.pz;
    const show = (z.floor === (v.floor || 0) || v.cur < 0.8) && (v.focus === id || v.cur < 0.8 || Math.hypot(lx - z.center.x, lz - z.center.z) < 14.5);
    if (g.visible !== show) g.visible = show;
  });
  return (
    <group ref={gate} position={[w.x0, 0, w.z0]} userData={{ zone: id }}>
      <ZoneContext.Provider value={id}>
        {base && <group position={[-ox, 0, -oz]}>{base}</group>}
        {children}
      </ZoneContext.Provider>
    </group>
  );
}

