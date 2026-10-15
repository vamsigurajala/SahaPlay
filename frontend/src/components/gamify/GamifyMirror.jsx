import React, { useRef, useContext } from 'react';
import { useFrame } from '@react-three/fiber';
import { ViewContext } from './parts';

// Mirrors the whole house (and the avatars standing in it) left<->right. A
// pure view preference: avatar positions travel in shared virtual coordinates,
// so a flipped viewer and a normal viewer still agree on who is where.
// (three.js flips triangle winding automatically for negative-determinant objects.)
export default function MirrorRoot({ children }) {
  const view = useContext(ViewContext);
  const ref = useRef();
  const applied = useRef(null);
  useFrame(() => {
    const g = ref.current;
    if (!g || applied.current === view.current.flip) return;
    applied.current = view.current.flip;
    // Reflection across the plane x = z (swap the x and z axes). A fixed
    // isometric camera at (+d, +h, +d) sits ON that plane, so this is exactly a
    // left<->right mirror of the screen image — cutaway walls stay on the far
    // side — which a plain x-negation is not.
    if (applied.current) g.matrix.set(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1);
    else g.matrix.identity();
    g.matrixWorldNeedsUpdate = true;
  });
  return <group ref={ref} matrixAutoUpdate={false}>{children}</group>;
}
