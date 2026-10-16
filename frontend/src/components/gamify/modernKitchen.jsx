import { Box, Plant, Chair, Stool, WallWindow, useOpenProp, PropDot } from './parts';
import { Cyl } from './shopParts';

const PI = Math.PI;

// The upstairs kitchen. Deliberately nothing like the Indian kitchen downstairs: a calm
// modern kitchen in sage green, white quartz and oak, with a black induction hob, a
// breakfast island, a window-seat nook and a round dining table. The fridge, hob, oven and
// glass cabinet are still tappable, like the ones downstairs.

const SAGE = '#86a090';
const SAGE_DARK = '#5f7a6a';
const QUARTZ = '#f4f2ec';
const OAK = '#c99d68';
const OAK_DARK = '#9a7448';
const BLACK = '#1e1f23';
const BRASS = '#c8a24a';
const CREAM = '#efe6d2';

const Pull = ({ p, w = 0.5, v = false }) => <Box p={p} s={v ? [0.03, w, 0.03] : [w, 0.03, 0.03]} c={BRASS} metal={0.8} rough={0.3} shadow={false} />;

function Seams({ x0, x1, y, z, n }) {
  // thin dark gaps between handleless cabinet doors
  return Array.from({ length: n + 1 }).map((_, i) => <Box key={i} p={[x0 + ((x1 - x0) * i) / n, y, z]} s={[0.02, 0.86, 0.02]} c={SAGE_DARK} shadow={false} />);
}

function Ring({ p, r = 0.22, c = '#ff6a3a' }) {
  return <mesh position={p} rotation={[-PI / 2, 0, 0]}><ringGeometry args={[r * 0.82, r, 28]} /><meshBasicMaterial color={c} toneMapped={false} /></mesh>;
}

export default function ModernKitchen({ set = 'up' }) {
  const openFridge = useOpenProp('fridge', set);
  const openStove = useOpenProp('stove', set);
  const openOven = useOpenProp('oven', set);
  const openCupboard = useOpenProp('cupboard');
  return (
    <group>
      {/* white tile wall behind both runs, with a thin oak rail */}
      <Box p={[4.4, 1.7, 0.18]} s={[4.4, 1.3, 0.05]} c="#fbfaf6" shadow={false} />
      <Box p={[14.2, 1.7, 0.18]} s={[6.8, 1.3, 0.05]} c="#fbfaf6" shadow={false} />
      <Box p={[14.2, 2.4, 0.2]} s={[6.8, 0.05, 0.05]} c={OAK} shadow={false} />

      {/* ── tall double-door fridge in the corner, black steel ── */}
      <group {...openFridge}>
        <PropDot position={[1.3, 4.2, 1.2]} kind="fridge" arg={set} />
        <Box p={[1.3, 1.8, 1.2]} s={[1.6, 3.6, 1.6]} c="#30343c" r={0.05} metal={0.55} rough={0.3} />
        <Box p={[1.3, 1.8, 2.02]} s={[0.03, 3.5, 0.03]} c="#14161a" shadow={false} />
        <Box p={[0.95, 2.0, 2.06]} s={[0.05, 1.3, 0.06]} c="#c9ccd4" metal={0.8} rough={0.25} shadow={false} />
        <Box p={[1.65, 2.0, 2.06]} s={[0.05, 1.3, 0.06]} c="#c9ccd4" metal={0.8} rough={0.25} shadow={false} />
        <Box p={[1.3, 2.9, 2.04]} s={[0.55, 0.4, 0.02]} c="#0e1a20" emissive="#3aa0c0" ei={0.35} shadow={false} />
      </group>

      {/* ── cooking run: sage base, quartz top, black induction hob, slim glass hood ── */}
      <Box p={[4.4, 0.5, 0.95]} s={[4.4, 1.0, 1.3]} c={SAGE} r={0.03} />
      <Box p={[4.4, 1.04, 0.95]} s={[4.5, 0.08, 1.4]} c={QUARTZ} rough={0.2} metal={0.1} />
      <Seams x0={2.3} x1={6.5} y={0.5} z={1.61} n={4} />
      {[2.9, 3.9, 4.9, 5.9].map(x => <Pull key={x} p={[x, 0.86, 1.64]} w={0.3} />)}
      <group {...openStove}>
        <PropDot position={[4.4, 1.9, 0.95]} kind="stove" arg={set} />
        <Box p={[4.4, 1.09, 0.95]} s={[1.9, 0.03, 1.0]} c={BLACK} rough={0.1} metal={0.4} />
        {[[-0.5, -0.2], [0.5, -0.2], [-0.45, 0.25], [0.45, 0.25]].map(([dx, dz], i) => <Ring key={i} p={[4.4 + dx, 1.115, 0.95 + dz]} r={i < 2 ? 0.26 : 0.2} c={i === 1 ? '#ff6a3a' : '#5a3a34'} />)}
        {/* a pot with a lid and a small saucepan */}
        <Cyl p={[4.9, 1.38, 0.75]} r={0.28} h={0.5} c="#d7dbe2" metal={0.85} rough={0.25} />
        <Cyl p={[4.9, 1.66, 0.75]} r={0.3} h={0.05} c="#c3c8d0" metal={0.85} rough={0.25} />
        <Cyl p={[3.95, 1.3, 1.2]} r={0.17} h={0.3} c={BLACK} metal={0.6} />
        <Box p={[3.58, 1.3, 1.2]} s={[0.3, 0.03, 0.05]} c={BLACK} shadow={false} />
      </group>
      <Box p={[4.4, 3.35, 0.7]} s={[1.9, 0.12, 1.0]} c={BLACK} rough={0.15} metal={0.5} rot={0} />
      <Box p={[4.4, 4.2, 0.35]} s={[0.6, 1.7, 0.4]} c={BLACK} rough={0.2} metal={0.5} />
      <Box p={[4.4, 3.27, 0.7]} s={[1.5, 0.02, 0.7]} c="#fff1cf" emissive="#ffe9b8" ei={0.9} shadow={false} />

      {/* ── tall oven tower on the left wall ── */}
      <group {...openOven}>
        <PropDot position={[0.9, 4.5, 5.0]} kind="oven" arg={set} />
        <Box p={[0.95, 1.95, 5.0]} s={[1.4, 3.9, 2.4]} c={SAGE} r={0.04} />
        <Box p={[1.67, 2.1, 5.0]} s={[0.03, 0.9, 1.7]} c={BLACK} metal={0.5} rough={0.15} />
        <Box p={[1.69, 2.1, 5.0]} s={[0.02, 0.62, 1.34]} c="#0e1a2a" emissive="#1a3a6a" ei={0.45} shadow={false} />
        <Pull p={[1.72, 2.65, 5.0]} w={1.2} />
        <Box p={[1.67, 3.1, 5.0]} s={[0.03, 0.45, 1.7]} c="#cfd3da" metal={0.8} rough={0.25} />
        <Box p={[1.67, 1.0, 5.0]} s={[0.03, 1.5, 1.8]} c={SAGE_DARK} shadow={false} />
      </group>

      {/* ── sink and appliance run ── */}
      <Box p={[14.2, 0.5, 0.95]} s={[6.8, 1.0, 1.3]} c={SAGE} r={0.03} />
      <Box p={[14.2, 1.04, 0.95]} s={[6.9, 0.08, 1.4]} c={QUARTZ} rough={0.2} metal={0.1} />
      <Seams x0={10.9} x1={17.5} y={0.5} z={1.61} n={7} />
      {[11.4, 12.4, 13.4, 15.2, 16.3, 17.1].map(x => <Pull key={x} p={[x, 0.86, 1.64]} w={0.3} />)}
      {/* double steel sink with a black gooseneck tap */}
      <Box p={[12.4, 1.09, 0.95]} s={[1.9, 0.03, 0.85]} c="#aab0bc" metal={0.8} rough={0.3} />
      <Box p={[12.0, 1.1, 0.95]} s={[0.8, 0.03, 0.62]} c="#6a707c" shadow={false} />
      <Box p={[12.85, 1.1, 0.95]} s={[0.8, 0.03, 0.62]} c="#6a707c" shadow={false} />
      <Cyl p={[12.4, 1.4, 0.45]} r={0.035} h={0.6} c={BLACK} metal={0.6} shadow={false} />
      <mesh position={[12.4, 1.72, 0.62]} rotation={[0, PI / 2, 0]}><torusGeometry args={[0.17, 0.03, 8, 16, PI]} /><meshStandardMaterial color={BLACK} metalness={0.6} roughness={0.3} /></mesh>
      {/* dishwasher */}
      <Box p={[14.5, 0.5, 1.63]} s={[1.0, 0.92, 0.03]} c="#cfd3da" metal={0.8} rough={0.3} />
      <Box p={[14.5, 0.85, 1.67]} s={[0.8, 0.03, 0.03]} c={BLACK} shadow={false} />
      {/* coffee station: machine, grinder and mugs */}
      <Box p={[16.5, 1.38, 0.8]} s={[0.7, 0.6, 0.55]} c={BLACK} metal={0.5} rough={0.3} r={0.04} />
      <Box p={[16.5, 1.18, 1.1]} s={[0.4, 0.04, 0.2]} c="#cfd3da" metal={0.8} shadow={false} />
      <Cyl p={[16.0, 1.2, 1.15]} r={0.08} h={0.14} c={CREAM} shadow={false} />
      <Cyl p={[16.95, 1.2, 1.2]} r={0.08} h={0.14} c="#d9906a" shadow={false} />
      {/* floating oak shelves with jars, plates and a trailing plant */}
      {[2.0, 2.8].map((y, i) => <Box key={y} p={[13.0, y, 0.35]} s={[3.6, 0.07, 0.4]} c={OAK} shadow={false} />)}
      {[11.6, 12.2, 12.8].map((x, i) => <Cyl key={x} p={[x, 2.16 + i * 0.02, 0.35]} r={0.11} h={0.28 + i * 0.04} c={['#f4f0e6', '#e3d6bd', '#dbe4dc'][i]} shadow={false} />)}
      {[0, 1, 2].map(i => <Box key={i} p={[14.0 + i * 0.12, 2.0 + 0.1 + i * 0.05, 0.35]} s={[0.04, 0.5, 0.45]} c="#fbfaf6" rot={0} shadow={false} />)}
      <Plant p={[14.8, 2.04, 0.35]} scale={0.34} pot="#d9906a" />
      <Box p={[12.6, 3.1, 0.32]} s={[0.9, 0.04, 0.3]} c={OAK} shadow={false} />
      {[12.3, 12.6, 12.9].map((x, i) => <Cyl key={x} p={[x, 3.3, 0.32]} r={0.07} h={0.3} c={['#c0d0c4', '#efe6d2', '#d6b88a'][i]} shadow={false} />)}
      {/* glass-fronted wall cabinet (tap for the utensils) */}
      <group {...openCupboard}>
        <PropDot position={[16.0, 4.2, 0.45]} kind="cupboard" />
        <Box p={[16.1, 3.35, 0.45]} s={[2.4, 1.5, 0.7]} c={SAGE} r={0.03} />
        <Box p={[16.1, 3.35, 0.82]} s={[2.0, 1.1, 0.03]} c="#cfe6ea" opacity={0.45} shadow={false} />
        <Box p={[16.1, 3.35, 0.8]} s={[2.1, 1.2, 0.02]} c={BRASS} metal={0.7} shadow={false} />
      </group>

      {/* ── breakfast island with oak waterfall end and three stools ── */}
      <Box p={[9.4, 0.55, 5.2]} s={[4.6, 1.1, 1.5]} c={SAGE_DARK} r={0.04} />
      <Box p={[9.4, 1.14, 5.2]} s={[4.8, 0.08, 1.7]} c={QUARTZ} rough={0.2} metal={0.1} />
      <Box p={[11.82, 0.6, 5.2]} s={[0.1, 1.2, 1.7]} c={OAK} r={0.02} />
      {[7.9, 9.4, 10.9].map(x => <Stool key={x} p={[x, 0, 6.55]} c={OAK} />)}
      {/* fruit bowl, board and glasses on the island */}
      <Cyl p={[8.3, 1.28, 5.0]} r={0.28} r2={0.18} h={0.16} c={CREAM} shadow={false} />
      {[[8.2, 4.95], [8.4, 5.05], [8.3, 5.15]].map(([x, z], i) => <mesh key={i} position={[x, 1.42, z]}><sphereGeometry args={[0.09, 10, 8]} /><meshStandardMaterial color={['#e86a3a', '#e8c23a', '#8cc152'][i]} /></mesh>)}
      <Box p={[10.2, 1.2, 5.3]} s={[0.8, 0.04, 0.4]} c={OAK_DARK} shadow={false} />
      {[9.4, 9.6].map(x => <Cyl key={x} p={[x, 1.32, 4.8]} r={0.05} h={0.2} c="#e9f2f5" shadow={false} />)}
      {/* two glass globe pendants */}
      {[8.5, 10.3].map(x => (
        <group key={x}>
          <Cyl p={[x, 3.9, 5.2]} r={0.012} h={1.4} c={BLACK} shadow={false} />
          <mesh position={[x, 3.0, 5.2]}><sphereGeometry args={[0.28, 16, 12]} /><meshStandardMaterial color="#fff6dc" emissive="#ffe3a0" emissiveIntensity={0.8} transparent opacity={0.85} /></mesh>
        </group>
      ))}

      {/* ── window-seat nook on the left wall ── */}
      <WallWindow p={[0.1, 3.0, 9.8]} rot={PI / 2} w={3.6} h={2.0} color="#cfe8f0" frame="#ffffff" />
      <Box p={[0.7, 0.3, 9.8]} s={[1.3, 0.6, 4.2]} c={OAK} r={0.03} />
      <Box p={[0.7, 0.66, 9.8]} s={[1.2, 0.14, 4.0]} c={CREAM} r={0.06} rough={1} />
      {[8.6, 11.0].map(z => <Box key={z} p={[0.55, 1.05, z]} s={[0.4, 0.4, 0.4]} c={z < 10 ? '#d9906a' : SAGE} r={0.08} rot={0.2} rough={1} shadow={false} />)}
      <Box p={[0.7, 0.1, 9.8]} s={[1.0, 0.18, 3.8]} c={OAK_DARK} shadow={false} />
      <Plant p={[0.8, 0.0, 12.6]} scale={1.1} pot="#d9c8aa" color="#3f9e5a" />

      {/* ── round dining table on a jute rug ── */}
      <mesh position={[12.8, 0.02, 11.6]} rotation={[-PI / 2, 0, 0]}><circleGeometry args={[2.7, 36]} /><meshStandardMaterial color="#cdb68a" roughness={1} /></mesh>
      <mesh position={[12.8, 0.03, 11.6]} rotation={[-PI / 2, 0, 0]}><ringGeometry args={[2.3, 2.45, 36]} /><meshStandardMaterial color="#b49a6c" roughness={1} /></mesh>
      <Cyl p={[12.8, 0.95, 11.6]} r={1.3} h={0.08} c={QUARTZ} rough={0.25} seg={36} />
      <Cyl p={[12.8, 0.45, 11.6]} r={0.18} h={0.9} c={OAK} />
      <Cyl p={[12.8, 0.05, 11.6]} r={0.7} h={0.1} c={OAK_DARK} seg={28} />
      {[0, 1, 2, 3].map(i => {
        const a = (i * PI) / 2 + PI / 4;
        return <Chair key={i} p={[12.8 + Math.sin(a) * 1.85, 0, 11.6 + Math.cos(a) * 1.85]} rot={a + PI} c={i % 2 ? SAGE : OAK} />;
      })}
      {[0, 1, 2, 3].map(i => {
        const a = (i * PI) / 2 + PI / 4;
        return <Cyl key={i} p={[12.8 + Math.sin(a) * 0.85, 1.0, 11.6 + Math.cos(a) * 0.85]} r={0.28} h={0.02} c="#ffffff" shadow={false} />;
      })}
      <Cyl p={[12.8, 1.2, 11.6]} r={0.1} r2={0.07} h={0.32} c="#dbe8e2" shadow={false} />
      {[0, 1, 2].map(i => <mesh key={i} position={[12.8 + (i - 1) * 0.09, 1.5, 11.6]} rotation={[0, 0, (i - 1) * 0.3]}><cylinderGeometry args={[0.012, 0.012, 0.5, 5]} /><meshStandardMaterial color="#c9b27a" /></mesh>)}
      {/* a big woven dome light */}
      <Cyl p={[12.8, 4.1, 11.6]} r={0.012} h={1.4} c={BLACK} shadow={false} />
      <mesh position={[12.8, 3.35, 11.6]}><sphereGeometry args={[0.6, 20, 10, 0, PI * 2, 0, PI / 2]} /><meshStandardMaterial color="#d6b88a" roughness={1} side={2} /></mesh>
      <pointLight position={[9.8, 3.0, 8.0]} intensity={40} distance={10} color="#fff0d2" decay={2} />

      <Plant p={[17.0, 0, 14.6]} scale={1.3} pot="#d9c8aa" color="#3f9e5a" />
    </group>
  );
}
