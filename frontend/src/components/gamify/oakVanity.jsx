import { Box, useOpenProp, PropDot } from './parts';
import { Cyl } from './shopParts';

const PI = Math.PI;
const OAK = '#c99d68';
const OAK_DARK = '#9a7448';
const BRASS = '#c8a24a';

// The upstairs dressing table. It is not the pink, gold-trimmed vanity with the round
// mirror and bulbs from the ground-floor bedroom: this one is a slim oak desk with a
// tall arched mirror leaning on the wall, a rattan pouf, a perfume tray and a vase of
// pampas grass. Tap it for the shelf of makeup, like the other one.
export default function OakVanity({ p, rot = 0 }) {
  const open = useOpenProp('cosmetics');
  return (
    <group position={p} rotation={[0, rot, 0]} {...open}>
      <PropDot position={[0, 2.6, 0.4]} kind="cosmetics" />
      {/* desk: oak top, slim drawer, open shelf with a basket */}
      <Box p={[0, 0.9, 0]} s={[2.1, 0.07, 0.85]} c={OAK} r={0.02} />
      <Box p={[0, 0.78, 0.05]} s={[0.9, 0.16, 0.7]} c={OAK_DARK} r={0.02} />
      <Box p={[0, 0.78, 0.41]} s={[0.84, 0.12, 0.02]} c={OAK} shadow={false} />
      <Cyl p={[0, 0.78, 0.44]} r={0.04} h={0.03} c={BRASS} metal={0.8} rot={[PI / 2, 0, 0]} shadow={false} />
      {[[-0.95, -0.34], [0.95, -0.34], [-0.95, 0.34], [0.95, 0.34]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.43, z]} rotation={[z > 0 ? 0.05 : -0.05, 0, x > 0 ? -0.05 : 0.05]} castShadow>
          <cylinderGeometry args={[0.03, 0.045, 0.86, 8]} /><meshStandardMaterial color={OAK_DARK} roughness={0.7} />
        </mesh>
      ))}
      <Box p={[0, 0.22, 0]} s={[1.9, 0.04, 0.7]} c={OAK} shadow={false} />
      <Cyl p={[-0.55, 0.38, 0]} r={0.26} r2={0.3} h={0.32} c="#c9a96a" rough={1} shadow={false} />
      <Cyl p={[0.55, 0.32, 0.02]} r={0.18} h={0.18} c="#efe6d2" shadow={false} />

      {/* tall arched mirror leaning on the wall at the left of the desk */}
      <group position={[-1.45, 0, -0.38]} rotation={[-0.09, 0, 0]}>
        <Box p={[0, 1.15, 0]} s={[1.0, 2.3, 0.06]} c={OAK_DARK} shadow={false} />
        <mesh position={[0, 2.3, 0]} rotation={[PI / 2, 0, 0]}><cylinderGeometry args={[0.5, 0.5, 0.06, 24, 1, false, -PI / 2, PI]} /><meshStandardMaterial color={OAK_DARK} /></mesh>
        <Box p={[0, 1.15, 0.035]} s={[0.84, 2.14, 0.01]} c="#d9eef5" emissive="#bfe0ee" ei={0.35} shadow={false} />
        <mesh position={[0, 2.3, 0.035]}><circleGeometry args={[0.42, 20, 0, PI]} /><meshBasicMaterial color="#d9eef5" toneMapped={false} /></mesh>
        <mesh position={[0.1, 1.2, 0.045]} rotation={[0, 0, 0.45]}><planeGeometry args={[0.1, 1.6]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.3} /></mesh>
      </group>

      {/* a small round tabletop mirror */}
      <Cyl p={[-0.6, 1.0, -0.2]} r={0.08} h={0.1} c={BRASS} metal={0.8} shadow={false} />
      <mesh position={[-0.6, 1.4, -0.2]} rotation={[0.1, 0, 0]}><cylinderGeometry args={[0.36, 0.36, 0.04, 24]} /><meshStandardMaterial color={BRASS} metalness={0.6} roughness={0.3} /></mesh>
      <mesh position={[-0.6, 1.4, -0.175]} rotation={[0.1, 0, 0]}><circleGeometry args={[0.3, 20]} /><meshBasicMaterial color="#d9eef5" toneMapped={false} /></mesh>

      {/* perfume tray, jewellery stand and pampas vase */}
      <Box p={[0.2, 0.95, 0.15]} s={[0.7, 0.025, 0.36]} c={BRASS} metal={0.7} rough={0.3} shadow={false} />
      {[[0.0, '#e8b4c8', 0.2], [0.2, '#b8d4e8', 0.28], [0.4, '#e8d8a0', 0.16]].map(([dx, col, h], i) => (
        <Cyl key={i} p={[0.0 + dx, 0.97 + h / 2, 0.15]} r={0.05} h={h} c={col} rough={0.15} shadow={false} />
      ))}
      <Cyl p={[0.78, 1.0, 0.0]} r={0.02} h={0.22} c={BRASS} metal={0.8} shadow={false} />
      {[0, 1, 2, 3].map(i => <mesh key={i} position={[0.78 + (i % 2 ? 0.08 : -0.08), 1.08 + i * 0.03, 0]} rotation={[0, 0, i % 2 ? -0.7 : 0.7]}><boxGeometry args={[0.16, 0.012, 0.012]} /><meshStandardMaterial color={BRASS} metalness={0.8} roughness={0.3} /></mesh>)}
      <Cyl p={[-0.9, 1.05, 0.1]} r={0.1} r2={0.07} h={0.3} c="#efe6d2" shadow={false} />
      {[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[-0.9 + (i - 2) * 0.07, 1.4 + (i % 2) * 0.05, 0.1]} rotation={[0, 0, (i - 2) * 0.28]}><cylinderGeometry args={[0.012, 0.03, 0.55, 5]} /><meshStandardMaterial color="#e6d5b0" /></mesh>)}

      {/* wall sconces either side of the desk */}
      {[-0.45, 0.95].map(x => (
        <group key={x} position={[x, 2.0, -0.42]}>
          <Box p={[0, 0, 0]} s={[0.1, 0.4, 0.06]} c={BRASS} metal={0.7} shadow={false} />
          <mesh position={[0, 0.05, 0.1]}><sphereGeometry args={[0.1, 10, 8]} /><meshBasicMaterial color="#fff0cf" toneMapped={false} /></mesh>
        </group>
      ))}

      {/* rattan pouf instead of a stool */}
      <Cyl p={[-0.2, 0.3, 0.95]} r={0.4} h={0.6} c="#cdb48a" rough={1} seg={20} />
      {[0.12, 0.3, 0.48].map(y => <Cyl key={y} p={[-0.2, y, 0.95]} r={0.405} h={0.025} c="#a8895a" rough={1} seg={20} shadow={false} />)}
      <Cyl p={[-0.2, 0.62, 0.95]} r={0.36} h={0.08} c="#efe6d2" rough={1} seg={20} shadow={false} />
    </group>
  );
}
