import { useMemo } from 'react';
import * as THREE from 'three';

// Small building blocks shared by the Veranda and the Market.

export const PI = Math.PI;
export const WOOD = '#7a4a26';
export const WOOD_DARK = '#4a2b14';
export const BRASS = '#d4af37';

export const tapper = (fn) => ({
  onClick: (e) => { if (e.delta > 6) return; e.stopPropagation(); fn(e); },
  onPointerOver: (e) => { e.stopPropagation(); try { document.body.style.cursor = 'pointer'; } catch { /* non-browser */ } },
  onPointerOut: () => { try { document.body.style.cursor = ''; } catch { /* non-browser */ } },
});

export function Cyl({ p, r, r2, h, c, rot, seg = 14, rough = 0.6, metal = 0, emissive, shadow = true }) {
  return (
    <mesh position={p} rotation={rot} castShadow={shadow}>
      <cylinderGeometry args={[r2 ?? r, r, h, seg]} />
      <meshStandardMaterial color={c} roughness={rough} metalness={metal} emissive={emissive} emissiveIntensity={emissive ? 0.9 : 0} />
    </mesh>
  );
}

// A cylinder from point a to point b.
export function Rod({ a, b, r = 0.07, c = WOOD }) {
  const { mid, len, quat } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va);
    return { mid: va.clone().add(vb).multiplyScalar(0.5), len: d.length(), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()) };
  }, [a, b]);
  return (
    <mesh position={mid} quaternion={quat} castShadow>
      <cylinderGeometry args={[r, r, len, 8]} />
      <meshStandardMaterial color={c} roughness={0.7} />
    </mesh>
  );
}
