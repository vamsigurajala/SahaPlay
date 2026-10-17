import React, { useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Box, Neon, Plant, Tree, BeanBag, Rug, Table, Stool, FloorLamp, useOpenProp, PropDot } from './parts';
import { Cell } from './cell';
import { NEON_PINK, NEON_VIOLET, NEON_AMBER } from './constants';
import { Supercar3D, Superbike3D, Bicycle3D } from './vehicles';
import { DriveableSupercar } from './DriveableVehicle';

const PI = Math.PI;

// Compound wall along the street edge of a cell (cell-local z = 15.8), so the
// Veranda and the Courtyard are closed off from the road just like the Front Yard.
export function StreetWall({ color = '#27272a', cap = '#3f3f46', lamp = NEON_AMBER }) {
  return (
    <group>
      <Box p={[9, 0.9, 15.8]} s={[18, 1.8, 0.38]} c={color} r={0.03} />
      <Box p={[9, 1.85, 15.8]} s={[18.2, 0.12, 0.48]} c={cap} />
      {[0.3, 17.7].map(x => (
        <group key={x}>
          <Box p={[x, 1.2, 15.8]} s={[0.7, 2.4, 0.7]} c={cap} r={0.05} />
          <Box p={[x, 2.5, 15.8]} s={[0.9, 0.18, 0.9]} c={color} />
          <mesh position={[x, 2.8, 15.8]}><sphereGeometry args={[0.22, 14, 12]} /><meshBasicMaterial color={lamp} toneMapped={false} /></mesh>
        </group>
      ))}
    </group>
  );
}

// ============================================================================
// COURTYARD REALISTIC 3D COMPONENTS (Authentic Indian Heritage Aangan)
// ============================================================================

// 1. Royal Carved Teakwood Jhula with Animated Gentle Sway
function RoyalHeritageJhula({ p, rot = 0, w = 2.5 }) {
  const swingRef = useRef();
  useFrame((state) => {
    if (swingRef.current) {
      swingRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 1.3) * 0.045;
    }
  });

  return (
    <group position={p} rotation={[0, rot, 0]}>
      {/* Heavy Carved A-frame Timber Pillars with Brass Accents */}
      {[-w / 2 - 0.28, w / 2 + 0.28].map(x => (
        <group key={x}>
          <Box p={[x, 0.15, 0]} s={[0.45, 0.3, 1.6]} c="#4a2a12" r={0.04} />
          <mesh position={[x, 1.7, 0.52]} rotation={[-0.22, 0, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.09, 3.4, 12]} />
            <meshStandardMaterial color="#5c3418" roughness={0.7} />
          </mesh>
          <mesh position={[x, 1.7, -0.52]} rotation={[0.22, 0, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.09, 3.4, 12]} />
            <meshStandardMaterial color="#5c3418" roughness={0.7} />
          </mesh>
          <mesh position={[x, 1.4, 0.44]} rotation={[-0.22, 0, 0]}>
            <torusGeometry args={[0.09, 0.02, 8, 16]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[x, 1.4, -0.44]} rotation={[0.22, 0, 0]}>
            <torusGeometry args={[0.09, 0.02, 8, 16]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[x, 3.5, 0]}>
            <sphereGeometry args={[0.13, 14, 12]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.25} />
          </mesh>
        </group>
      ))}

      {/* Heavy Sculpted Top Crossbeam */}
      <mesh position={[0, 3.4, 0]} rotation={[0, 0, PI / 2]} castShadow>
        <cylinderGeometry args={[0.095, 0.095, w + 1.1, 14]} />
        <meshStandardMaterial color="#4a2a12" roughness={0.65} />
      </mesh>
      {[-w / 2 - 0.55, w / 2 + 0.55].map(x => (
        <mesh key={x} position={[x, 3.4, 0]}>
          <coneGeometry args={[0.12, 0.24, 10]} />
          <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.25} />
        </mesh>
      ))}

      {/* SWINGING SEAT ASSEMBLY */}
      <group position={[0, 3.3, 0]}>
        <group ref={swingRef}>
          {[-w / 2 + 0.15, w / 2 - 0.15].map(x => (
            <group key={x}>
              <mesh position={[x, -1.2, 0]}>
                <cylinderGeometry args={[0.022, 0.022, 2.3, 8]} />
                <meshStandardMaterial color="#eab308" metalness={0.85} roughness={0.25} />
              </mesh>
              {[-0.4, -0.9, -1.5, -2.0].map(y => (
                <mesh key={y} position={[x, y, 0]}>
                  <torusGeometry args={[0.045, 0.015, 8, 12]} />
                  <meshStandardMaterial color="#fbbf24" metalness={0.85} roughness={0.2} />
                </mesh>
              ))}
            </group>
          ))}

          <group position={[0, -2.35, 0]}>
            <Box p={[0, 0.06, 0]} s={[w - 0.1, 0.12, 1.05]} c="#5c3418" r={0.04} shadow />
            <Box p={[0, 0.55, -0.48]} s={[w - 0.1, 0.08, 0.08]} c="#4a2a12" />
            <Box p={[0, 0.88, -0.48]} s={[w - 0.1, 0.1, 0.1]} c="#4a2a12" r={0.02} />
            {Array.from({ length: 9 }).map((_, i) => {
              const sx = -w / 2 + 0.35 + i * ((w - 0.7) / 8);
              return (
                <mesh key={i} position={[sx, 0.72, -0.48]}>
                  <cylinderGeometry args={[0.018, 0.018, 0.28, 8]} />
                  <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.3} />
                </mesh>
              );
            })}
            {[-w / 2 + 0.05, w / 2 - 0.05].map(x => (
              <Box key={x} p={[x, 0.35, -0.1]} s={[0.08, 0.45, 0.8]} c="#5c3418" r={0.03} />
            ))}

            <Box p={[0, 0.18, -0.02]} s={[w - 0.28, 0.14, 0.9]} c="#991b1b" r={0.06} />
            <Box p={[0, 0.25, 0.4]} s={[w - 0.32, 0.02, 0.06]} c="#f59e0b" emissive="#f59e0b" shadow={false} />

            {[-w / 2 + 0.32, w / 2 - 0.32].map(x => (
              <group key={x} position={[x, 0.32, 0]} rotation={[PI / 2, 0, 0]}>
                <mesh>
                  <cylinderGeometry args={[0.13, 0.13, 0.65, 14]} />
                  <meshStandardMaterial color="#c2410c" roughness={0.65} />
                </mesh>
                {[-0.34, 0.34].map(y => (
                  <mesh key={y} position={[0, y, 0]}>
                    <coneGeometry args={[0.05, 0.08, 8]} />
                    <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.3} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}

// 2. Sacred Carved Sandstone Tulsi Vrindavan with Glowing Diya & Manjari
function RealisticTulsiVrindavan({ p }) {
  const openHerbs = useOpenProp('garden', 'herbs');
  return (
    <group position={p} {...openHerbs}>
      <PropDot position={[0, 2.7, 0]} kind="garden" arg="herbs" />

      {/* Stepped Architectural Sandstone Pedestal */}
      <Box p={[0, 0.16, 0]} s={[1.9, 0.32, 1.9]} c="#d4b490" r={0.04} shadow />
      <Box p={[0, 0.6, 0]} s={[1.45, 0.6, 1.45]} c="#c49d74" r={0.03} shadow />
      {[
        [0, 0.6, 0.74, 0],
        [0, 0.6, -0.74, PI],
        [0.74, 0.6, 0, PI / 2],
        [-0.74, 0.6, 0, -PI / 2],
      ].map(([x, y, z, rot], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, rot, 0]}>
          <Box p={[0, 0, 0]} s={[0.32, 0.38, 0.06]} c="#5c3818" shadow={false} />
          <mesh position={[0, -0.12, 0.04]}>
            <cylinderGeometry args={[0.06, 0.04, 0.04, 8]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.8} />
          </mesh>
          <mesh position={[0, -0.06, 0.04]}>
            <coneGeometry args={[0.025, 0.08, 6]} />
            <meshBasicMaterial color="#fef08a" toneMapped={false} />
          </mesh>
        </group>
      ))}

      <Box p={[0, 1.0, 0]} s={[1.65, 0.22, 1.65]} c="#d4b490" r={0.04} />
      <mesh position={[0, 1.12, 0]}>
        <cylinderGeometry args={[0.68, 0.68, 0.06, 18]} />
        <meshStandardMaterial color="#2d1c10" roughness={0.95} />
      </mesh>

      <group position={[0, 1.15, 0]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.07, 0.5, 8]} />
          <meshStandardMaterial color="#4a2e16" roughness={0.9} />
        </mesh>
        {[
          [0, 0.55, 0, 0.42, '#2d7a3e'],
          [0.22, 0.45, 0.18, 0.35, '#3a8f4c'],
          [-0.24, 0.48, -0.15, 0.36, '#286a34'],
          [0.18, 0.52, -0.22, 0.34, '#3a8f4c'],
          [-0.2, 0.42, 0.2, 0.33, '#2d7a3e'],
          [0, 0.72, 0, 0.3, '#328444'],
        ].map(([x, y, z, r, col], i) => (
          <group key={i} position={[x, y, z]}>
            <mesh castShadow>
              <sphereGeometry args={[r, 10, 8]} />
              <meshStandardMaterial color={col} roughness={0.7} />
            </mesh>
          </group>
        ))}
        {[
          [0, 0.95, 0],
          [0.18, 0.82, 0.14],
          [-0.16, 0.85, -0.12],
          [0.14, 0.8, -0.16],
          [-0.15, 0.78, 0.15],
        ].map(([x, y, z], i) => (
          <group key={i} position={[x, y, z]}>
            <mesh position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.015, 0.03, 0.22, 6]} />
              <meshStandardMaterial color="#8b5cf6" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.22, 0]}>
              <sphereGeometry args={[0.028, 6, 6]} />
              <meshStandardMaterial color="#c084fc" />
            </mesh>
          </group>
        ))}
      </group>

      {[
        [1.15, 0.35, 1.15],
        [-1.15, 0.35, 1.15],
        [1.15, 0.35, -1.15],
        [-1.15, 0.35, -1.15],
      ].map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh position={[0, 0.01, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.02, 14]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.08, 0.04, 0.06, 10]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.11, 0]}>
            <coneGeometry args={[0.035, 0.1, 8]} />
            <meshBasicMaterial color="#fef08a" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.11, 0]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.3} toneMapped={false} />
          </mesh>
        </group>
      ))}

      <group position={[0.7, 0.35, 0.7]}>
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.06, 0.04, 0.08, 10]} />
          <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

// 3. Antique Dark Charcoal & Terracotta Stone Well (Kuan)
function RealisticKuan({ p }) {
  // Changed color to deep antique charcoal / aged slate masonry with warm terracotta coping
  return (
    <group position={p}>
      {/* Dark Charcoal Aged Slate Masonry Outer Well Cylinder */}
      <mesh position={[0, 0.58, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.2, 1.28, 1.16, 28]} />
        <meshStandardMaterial color="#2d3139" roughness={0.85} />
      </mesh>
      {/* Terracotta / Rust-Copper Coping Stone Rim on Top */}
      <mesh position={[0, 1.18, 0]}>
        <cylinderGeometry args={[1.34, 1.34, 0.16, 28]} />
        <meshStandardMaterial color="#9a3412" roughness={0.7} />
      </mesh>
      {/* Black Wrought-Iron Reinforcing Ring */}
      <mesh position={[0, 0.65, 0]}>
        <torusGeometry args={[1.25, 0.03, 8, 28]} />
        <meshStandardMaterial color="#09090b" metalness={0.8} />
      </mesh>

      {/* Inner Deep Reflective Water Surface with Ripple Rings */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[1.05, 1.05, 0.02, 24]} />
        <meshStandardMaterial
          color="#0284c7"
          emissive="#0369a1"
          emissiveIntensity={0.5}
          roughness={0.15}
          metalness={0.2}
        />
      </mesh>
      {[0.4, 0.75].map((r, i) => (
        <mesh key={i} position={[0, 0.61, 0]} rotation={[-PI / 2, 0, 0]}>
          <ringGeometry args={[r - 0.03, r, 24]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.35} />
        </mesh>
      ))}

      {/* Heavy Weathered Timber Pulley Structure */}
      {[-0.92, 0.92].map(x => (
        <group key={x}>
          <mesh position={[x, 1.9, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.09, 1.6, 10]} />
            <meshStandardMaterial color="#38210f" roughness={0.8} />
          </mesh>
          <Box p={[x, 1.2, 0]} s={[0.2, 0.1, 0.2]} c="#09090b" metal={0.8} />
        </group>
      ))}
      <mesh position={[0, 2.65, 0]} rotation={[0, 0, PI / 2]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 2.2, 10]} />
        <meshStandardMaterial color="#38210f" roughness={0.8} />
      </mesh>

      {/* Cast Iron Pulley Wheel */}
      <group position={[0, 2.45, 0]}>
        <mesh rotation={[0, 0, PI / 2]}>
          <cylinderGeometry args={[0.18, 0.18, 0.05, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.4, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.9, 8]} />
          <meshStandardMaterial color="#d97706" roughness={0.9} />
        </mesh>
      </group>

      {/* Suspended Hammered Brass / Copper Water Bucket (Balti) */}
      <group position={[0, 1.65, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.18, 0.14, 0.32, 14]} />
          <meshStandardMaterial color="#ea580c" metalness={0.75} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <torusGeometry args={[0.14, 0.014, 8, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.8} />
        </mesh>
      </group>

      {/* Traditional Hammered Brass Water Pot (Ghada) on Coping Ledge */}
      <group position={[0.95, 1.28, 0.45]}>
        <mesh castShadow>
          <sphereGeometry args={[0.18, 14, 12]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.1, 0.06, 0.08, 12]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.85} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

// 4. ANIMATED MULTI-TIERED WATER FOUNTAIN WITH CONTINUOUS WATER FLOW
function RealisticWaterFountain({ p }) {
  const streamTopRef = useRef();
  const streamMidRef = useRef();
  const jetRef = useRef();
  const ripplesRef = useRef();

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    // Central jet pulsing animation
    if (jetRef.current) {
      jetRef.current.scale.y = 1 + Math.sin(time * 6) * 0.18;
      jetRef.current.scale.x = 1 + Math.cos(time * 5) * 0.12;
      jetRef.current.scale.z = jetRef.current.scale.x;
    }
    // Water stream flow animations
    if (streamTopRef.current) {
      streamTopRef.current.rotation.y = time * 0.35;
    }
    if (streamMidRef.current) {
      streamMidRef.current.rotation.y = -time * 0.25;
    }
    // Expanding ripple rings
    if (ripplesRef.current) {
      const s = 1 + ((time * 0.8) % 1) * 0.6;
      ripplesRef.current.scale.set(s, s, 1);
    }
  });

  return (
    <group position={p}>
      {/* ── FOUNTAIN STONE ARCHITECTURE ── */}
      {/* Grand Lower Basin Octagonal Plinth */}
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.3, 2.45, 0.44, 32]} />
        <meshStandardMaterial color="#baa080" roughness={0.75} />
      </mesh>
      {/* Scalloped Stone Coping Rim */}
      <mesh position={[0, 0.44, 0]}>
        <torusGeometry args={[2.35, 0.1, 12, 36]} />
        <meshStandardMaterial color="#c9ae8d" roughness={0.65} />
      </mesh>

      {/* Grand Basin Water Disc */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[2.2, 2.2, 0.04, 32]} />
        <meshStandardMaterial
          color="#0284c7"
          emissive="#0369a1"
          emissiveIntensity={0.5}
          roughness={0.15}
          metalness={0.3}
        />
      </mesh>

      {/* Central Pedestal Column */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.58, 0.9, 20]} />
        <meshStandardMaterial color="#baa080" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <torusGeometry args={[0.5, 0.08, 10, 24]} />
        <meshStandardMaterial color="#c9ae8d" />
      </mesh>

      {/* Middle Tier Overflow Basin Bowl */}
      <mesh position={[0, 1.35, 0]} castShadow>
        <cylinderGeometry args={[1.32, 0.55, 0.32, 28]} />
        <meshStandardMaterial color="#c9ae8d" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[1.25, 1.25, 0.04, 28]} />
        <meshStandardMaterial
          color="#0284c7"
          emissive="#0369a1"
          emissiveIntensity={0.55}
          roughness={0.15}
        />
      </mesh>

      {/* Upper Column & Finial Cup */}
      <mesh position={[0, 1.82, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.34, 0.64, 16]} />
        <meshStandardMaterial color="#baa080" roughness={0.7} />
      </mesh>
      <mesh position={[0, 2.18, 0]}>
        <cylinderGeometry args={[0.62, 0.28, 0.24, 20]} />
        <meshStandardMaterial color="#c9ae8d" roughness={0.65} />
      </mesh>

      {/* ── ANIMATED MOVING WATER FLOWS ── */}

      {/* Central Spouting Water Jet */}
      <group ref={jetRef} position={[0, 2.28, 0]}>
        <mesh position={[0, 0.26, 0]}>
          <cylinderGeometry args={[0.04, 0.09, 0.55, 10]} />
          <meshBasicMaterial color="#e0f2fe" transparent opacity={0.85} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.52, 0]}>
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      </group>

      {/* Top Tier Cascading Water Streams (Falling into Mid Basin) */}
      <group ref={streamTopRef} position={[0, 2.18, 0]}>
        {Array.from({ length: 6 }).map((_, i) => {
          const ang = i * ((PI * 2) / 6);
          const x = Math.cos(ang) * 0.58;
          const z = Math.sin(ang) * 0.58;
          return (
            <mesh key={i} position={[x, -0.4, z]} rotation={[0.25 * Math.sin(ang), 0, -0.25 * Math.cos(ang)]}>
              <cylinderGeometry args={[0.02, 0.035, 0.72, 6]} />
              <meshBasicMaterial color="#7dd3fc" transparent opacity={0.7} toneMapped={false} />
            </mesh>
          );
        })}
      </group>

      {/* Middle Tier Cascading Water Streams (Falling into Grand Lower Basin) */}
      <group ref={streamMidRef} position={[0, 1.48, 0]}>
        {Array.from({ length: 10 }).map((_, i) => {
          const ang = i * ((PI * 2) / 10);
          const x = Math.cos(ang) * 1.24;
          const z = Math.sin(ang) * 1.24;
          return (
            <mesh key={i} position={[x, -0.55, z]} rotation={[0.28 * Math.sin(ang), 0, -0.28 * Math.cos(ang)]}>
              <cylinderGeometry args={[0.025, 0.045, 1.05, 6]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} toneMapped={false} />
            </mesh>
          );
        })}
      </group>

      {/* Animated Expanding Water Ripple Rings in Lower Basin */}
      <group ref={ripplesRef} position={[0, 0.42, 0]} rotation={[-PI / 2, 0, 0]}>
        {[1.1, 1.6, 2.0].map((rad, i) => (
          <mesh key={i}>
            <ringGeometry args={[rad - 0.04, rad, 32]} />
            <meshBasicMaterial color="#bae6fd" transparent opacity={0.45 - i * 0.12} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// 5. Handcrafted Sheesham Charpai (Khatia) & Royal Chai Nook
function RealisticCharpaiNook({ p, rot = 0 }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      {[[-1.15, -0.65], [1.15, -0.65], [-1.15, 0.65], [1.15, 0.65]].map(([x, z], i) => (
        <group key={i}>
          <mesh position={[x, 0.3, z]} castShadow>
            <cylinderGeometry args={[0.075, 0.06, 0.6, 12]} />
            <meshStandardMaterial color="#5c3418" roughness={0.7} />
          </mesh>
          <mesh position={[x, 0.04, z]}>
            <cylinderGeometry args={[0.065, 0.065, 0.08, 12]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
          </mesh>
        </group>
      ))}

      <Box p={[0, 0.58, -0.65]} s={[2.45, 0.12, 0.12]} c="#5c3418" r={0.02} />
      <Box p={[0, 0.58, 0.65]} s={[2.45, 0.12, 0.12]} c="#5c3418" r={0.02} />
      <Box p={[-1.15, 0.58, 0]} s={[0.12, 0.12, 1.4]} c="#5c3418" r={0.02} />
      <Box p={[1.15, 0.58, 0]} s={[0.12, 0.12, 1.4]} c="#5c3418" r={0.02} />

      {Array.from({ length: 10 }).map((_, i) => (
        <Box
          key={i}
          p={[-0.95 + i * 0.21, 0.61, 0]}
          s={[0.14, 0.03, 1.2]}
          c={i % 2 === 0 ? '#f8fafc' : '#1e3a8a'}
          shadow={false}
        />
      ))}
      {[-0.4, 0, 0.4].map((z, i) => (
        <Box key={i} p={[0, 0.63, z]} s={[2.2, 0.02, 0.08]} c="#d97706" shadow={false} />
      ))}

      <Box p={[-0.45, 0.68, 0]} s={[1.2, 0.08, 1.05]} c="#e11d48" r={0.04} />
      <Box p={[-0.45, 0.73, 0]} s={[1.0, 0.02, 0.85]} c="#fef08a" shadow={false} />

      <group position={[-0.85, 0.82, 0]} rotation={[PI / 2, 0, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.15, 0.15, 0.85, 14]} />
          <meshStandardMaterial color="#7c3aed" roughness={0.65} />
        </mesh>
        {[-0.44, 0.44].map(y => (
          <mesh key={y} position={[0, y, 0]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.8} />
          </mesh>
        ))}
      </group>

      <group position={[1.4, 0, 0.2]}>
        <Box p={[0, 0.16, 0]} s={[0.75, 0.32, 0.75]} c="#5c3418" r={0.03} shadow />
        <mesh position={[0, 0.33, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 0.02, 16]} />
          <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
        </mesh>
        <group position={[-0.08, 0.34, -0.05]}>
          <mesh position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.09, 10, 10]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[0.09, 0.16, 0]} rotation={[0, 0, -0.4]}>
            <cylinderGeometry args={[0.02, 0.03, 0.12, 8]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} />
          </mesh>
        </group>
        {[
          [0.12, 0.34, 0.08],
          [0.15, 0.34, -0.1],
        ].map(([cx, cy, cz], i) => (
          <mesh key={i} position={[cx, cy + 0.06, cz]}>
            <cylinderGeometry args={[0.045, 0.03, 0.09, 10]} />
            <meshStandardMaterial color="#c2410c" roughness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// 6. Authentic Flower Petal Rangoli (Pookalam) with Standing Brass Deepam
function RealisticFloralRangoli({ p, r = 1.8, isMain = true }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.012, 0]} rotation={[-PI / 2, 0, 0]}>
        <ringGeometry args={[r * 0.88, r, 36]} />
        <meshBasicMaterial color="#15803d" />
      </mesh>
      <mesh position={[0, 0.015, 0]} rotation={[-PI / 2, 0, 0]}>
        <ringGeometry args={[r * 0.68, r * 0.88, 36]} />
        <meshBasicMaterial color="#f59e0b" />
      </mesh>
      <mesh position={[0, 0.018, 0]} rotation={[-PI / 2, 0, 0]}>
        <ringGeometry args={[r * 0.48, r * 0.68, 36]} />
        <meshBasicMaterial color="#be123c" />
      </mesh>
      <mesh position={[0, 0.021, 0]} rotation={[-PI / 2, 0, 0]}>
        <ringGeometry args={[r * 0.28, r * 0.48, 32]} />
        <meshBasicMaterial color="#eab308" />
      </mesh>
      <mesh position={[0, 0.024, 0]} rotation={[-PI / 2, 0, 0]}>
        <circleGeometry args={[r * 0.28, 24]} />
        <meshBasicMaterial color="#fefce8" />
      </mesh>

      {Array.from({ length: 12 }).map((_, i) => {
        const ang = (i * PI) / 6;
        return (
          <mesh
            key={i}
            position={[Math.cos(ang) * (r * 0.58), 0.026, Math.sin(ang) * (r * 0.58)]}
            rotation={[-PI / 2, 0, 0]}
          >
            <circleGeometry args={[0.08, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        );
      })}

      {isMain && (
        <group position={[0, 0, 0]}>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.22, 0.28, 0.12, 16]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.045, 0.06, 0.95, 12]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.38, 0]}>
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.85} />
          </mesh>
          <mesh position={[0, 0.85, 0]}>
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.85} />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.24, 0.12, 0.08, 16]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
          </mesh>
          {[0, 1, 2, 3, 4].map(w => {
            const wang = w * ((2 * PI) / 5);
            return (
              <group key={w} position={[Math.cos(wang) * 0.2, 1.15, Math.sin(wang) * 0.2]}>
                <mesh>
                  <coneGeometry args={[0.028, 0.09, 6]} />
                  <meshBasicMaterial color="#fef08a" toneMapped={false} />
                </mesh>
              </group>
            );
          })}
          <mesh position={[0, 1.26, 0]}>
            <coneGeometry args={[0.08, 0.22, 8]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.85} roughness={0.25} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// 7. Traditional Brass Water Urli with Floating Petals & Tea Lights
function RealisticBrassUrli({ p }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.65, 0.42, 0.32, 24]} />
        <meshStandardMaterial color="#eab308" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <torusGeometry args={[0.66, 0.04, 10, 24]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.63, 0.63, 0.015, 20]} />
        <meshStandardMaterial color="#0284c7" emissive="#0369a1" emissiveIntensity={0.3} roughness={0.1} />
      </mesh>
      {[
        [0.2, 0.15, '#e11d48'],
        [-0.25, 0.2, '#f59e0b'],
        [0.3, -0.2, '#e11d48'],
        [-0.15, -0.25, '#f59e0b'],
        [0, 0, '#e11d48'],
      ].map(([x, z, c], i) => (
        <mesh key={i} position={[x, 0.33, z]} rotation={[-PI / 2, 0, Math.random() * PI]}>
          <circleGeometry args={[0.07, 8]} />
          <meshBasicMaterial color={c} />
        </mesh>
      ))}
      <group position={[0, 0.33, 0]}>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.03, 10]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
        <mesh position={[0, 0.07, 0]}>
          <coneGeometry args={[0.025, 0.07, 6]} />
          <meshBasicMaterial color="#fef08a" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

// 8. Carved Heritage Sandstone Pillar with Hanging Brass Temple Bell
function CarvedHeritagePillar({ p, h = 3.8, hasBell = false }) {
  return (
    <group position={p}>
      <Box p={[0, 0.22, 0]} s={[1.05, 0.44, 1.05]} c="#967a5c" r={0.04} shadow />
      <Box p={[0, 0.5, 0]} s={[0.85, 0.2, 0.85]} c="#baa080" r={0.03} />
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.34, h - 1.1, 14]} />
        <meshStandardMaterial color="#baa080" roughness={0.75} />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.36, 0.32, 0.14, 14]} />
        <meshStandardMaterial color="#967a5c" />
      </mesh>
      <mesh position={[0, h - 0.9, 0]}>
        <cylinderGeometry args={[0.36, 0.32, 0.14, 14]} />
        <meshStandardMaterial color="#967a5c" />
      </mesh>
      <Box p={[0, h - 0.35, 0]} s={[0.9, 0.3, 0.9]} c="#967a5c" r={0.04} />
      <Box p={[0, h - 0.1, 0]} s={[1.2, 0.2, 1.2]} c="#5c3418" r={0.03} />

      {hasBell && (
        <group position={[0.45, h - 0.35, 0.45]}>
          <mesh position={[0, -0.3, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.6, 6]} />
            <meshStandardMaterial color="#dc2626" />
          </mesh>
          <mesh position={[0, -0.65, 0]}>
            <coneGeometry args={[0.13, 0.22, 12]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.78, 0]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.9} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ============================================================================
// COURTYARD CELL (Main Assembly)
// ============================================================================
export function Courtyard() {
  return (
    <Cell id="courtyard">
      {/* 4 Carved Heritage Stone Pillars at Corners */}
      <CarvedHeritagePillar p={[1.6, 0, 1.6]} hasBell />
      <CarvedHeritagePillar p={[16.4, 0, 1.6]} />
      <CarvedHeritagePillar p={[1.6, 0, 14.4]} />
      <CarvedHeritagePillar p={[16.4, 0, 14.4]} hasBell />

      {/* Centerpiece: Sacred Carved Sandstone Tulsi Vrindavan with Glowing Diyas */}
      <RealisticTulsiVrindavan p={[12.0, 0, 9.6]} />

      {/* Hand-Carved Royal Teakwood Jhula with Animated Sway */}
      <RoyalHeritageJhula p={[4.4, 0, 12.8]} w={2.5} />

      {/* Antique Dark Charcoal Stone Masonry Well (Kuan) */}
      <RealisticKuan p={[15.0, 0, 6.0]} />

      {/* ANIMATED MOVING WATER FOUNTAIN (Replaced old lotus pond) */}
      <RealisticWaterFountain p={[5.8, 0, 4.6]} />

      {/* Woven Sheesham Charpai & Royal Chai Table Nook */}
      <RealisticCharpaiNook p={[14.2, 0, 13.6]} />

      {/* Authentic Fresh Flower Petal Rangoli with Standing Brass Deepam */}
      <RealisticFloralRangoli p={[7.0, 0, 11.4]} r={1.8} isMain />
      <RealisticFloralRangoli p={[14.4, 0, 3.6]} r={1.2} isMain={false} />

      {/* Traditional Brass Water Urli with Floating Petals & Tea Lights */}
      <RealisticBrassUrli p={[9.6, 0, 6.4]} />

      {/* Lush Courtyard Flora */}
      <group position={[1.4, 0, 2.8]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.3, 0.8, 14]} />
          <meshStandardMaterial color="#c2410c" roughness={0.8} />
        </mesh>
        <Plant p={[0, 0.8, 0]} scale={1.4} color="#16a34a" />
      </group>

      <group position={[16.8, 0, 9.6]}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.32, 0.7, 14]} />
          <meshStandardMaterial color="#a85d38" roughness={0.85} />
        </mesh>
        <Tree p={[0, 0.7, 0]} scale={1.05} />
        {[
          [-0.4, 0.02, 0.3],
          [-0.7, 0.02, -0.2],
          [-0.3, 0.02, -0.6],
          [-0.9, 0.02, 0.4],
        ].map(([fx, fy, fz], i) => (
          <mesh key={i} position={[fx, fy, fz]} rotation={[-PI / 2, 0, Math.random() * PI]}>
            <circleGeometry args={[0.065, 5]} />
            <meshBasicMaterial color="#fef9c3" />
          </mesh>
        ))}
      </group>

      <Plant p={[2.4, 0, 7.4]} scale={1.15} color="#22c55e" pot="#b45309" />
      <Plant p={[11.2, 0, 2.6]} scale={1.1} color="#15803d" pot="#c2410c" />
      <Plant p={[8.6, 0, 15.0]} scale={1.05} color="#16a34a" pot="#b45309" />
      <StreetWall color="#7a4e32" cap="#a8714a" />
    </Cell>
  );
}

// ============================================================================
// FRONT YARD: ATTACHED WALL GARAGE, SUPERBIKE, BICYCLES & TOP-MODEL SUPERCAR
// ============================================================================

// 1. Top-Model Ferrari / Lamborghini Hypercar (Click to inspect 3D Cockpit or Drive!)
function TopModelSupercar3D({ p, rot = 0 }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      {/* Showroom turntable with LED lighting ring */}
      <mesh position={[0, 0.06, 0]} receiveShadow><cylinderGeometry args={[3.0, 3.1, 0.12, 40]} /><meshStandardMaterial color="#14141a" roughness={0.4} metalness={0.5} /></mesh>
      <mesh position={[0, 0.126, 0]} rotation={[-PI / 2, 0, 0]}><ringGeometry args={[2.72, 2.82, 56]} /><meshBasicMaterial color="#38bdf8" toneMapped={false} /></mesh>
      <mesh position={[0, 0.126, 0]} rotation={[-PI / 2, 0, 0]}><ringGeometry args={[2.35, 2.4, 56]} /><meshBasicMaterial color="#f43f5e" toneMapped={false} /></mesh>

      <PropDot position={[2.5, 0.7, 2.2]} kind="supercar" />
      <DriveableSupercar initialPos={[0, 0.12, 0]} />
    </group>
  );
}

// 2. Attached Wall Garage Workshop Bay (Mounted directly to the Top-Left Wall)
function AttachedGarageWorkshop({ p }) {
  const openGarage = useOpenProp('garage', 'shared');

  return (
    <group position={p} {...openGarage} style={{ cursor: 'pointer' }}>
      <PropDot position={[0, 2.3, 0]} kind="garage" />

      {/* Wall-Mounted Architectural Cantilever Roof Canopy with LED Downlights */}
      <group position={[0, 3.2, -0.6]}>
        <Box p={[0, 0, 0]} s={[5.8, 0.16, 1.5]} c="#0f172a" metal={0.8} />
        <Box p={[0, 0.12, -0.7]} s={[5.9, 0.1, 0.1]} c="#334155" metal={0.85} />
        {/* Recessed Warm LED Task Spotlights */}
        {[-2.0, -0.7, 0.7, 2.0].map(lx => (
          <group key={lx} position={[lx, -0.09, 0]}>
            <mesh rotation={[-PI / 2, 0, 0]}>
              <circleGeometry args={[0.16, 16]} />
              <meshBasicMaterial color="#fffbeb" toneMapped={false} />
            </mesh>
          </group>
        ))}
        {/* Glowing Backlit Neon Garage Sign */}
        <group position={[0, 0.24, 0.65]}>
          <Box p={[0, 0, 0]} s={[3.2, 0.38, 0.06]} c="#09090b" />
          <Neon p={[0, 0, 0.04]} s={[2.9, 0.22, 0.02]} color="#06b6d4" />
        </group>
      </group>

      {/* Wall Pegboard with Hanging Precision Tools against Top Wall */}
      <group position={[0, 1.9, -1.05]}>
        <Box p={[0, 0, 0]} s={[5.2, 1.5, 0.04]} c="#1e293b" metal={0.6} rough={0.7} />
        {/* Hanging Chrome Wrenches & Ratchets */}
        {[-2.1, -1.8, -1.5, -1.2, -0.9, -0.6, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1].map((wx, i) => (
          <group key={i} position={[wx, 0.18 - (i % 3) * 0.16, 0.03]}>
            <Box p={[0, 0, 0]} s={[0.035, 0.32 + (i % 4) * 0.06, 0.02]} c="#e2e8f0" metal={0.9} />
            <mesh position={[0, 0.18, 0]}>
              <torusGeometry args={[0.032, 0.01, 6, 10]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.9} />
            </mesh>
          </group>
        ))}
        {/* Magnetic Parts Organizers & Small Parts Trays */}
        {[-0.2, 0.2].map(tx => (
          <Box key={tx} p={[tx, 0.35, 0.05]} s={[0.34, 0.22, 0.08]} c="#dc2626" r={0.02} />
        ))}
      </group>

      {/* Dual Snap-on Heavy Duty Red & Black Rolling Tool Cabinets */}
      <group position={[0, 0, -0.45]}>
        {/* Main Butcher-Block Solid Oak Workbench Surface */}
        <Box p={[0, 0.98, 0]} s={[4.8, 0.08, 1.05]} c="#78350f" r={0.02} roughness={0.6} />
        {/* Steel Workbench Frame & Legs */}
        <Box p={[0, 0.92, 0]} s={[4.76, 0.04, 1.02]} c="#0f172a" metal={0.8} />

        {/* Left 5-Drawer Tool Chest Body */}
        <group position={[-1.3, 0.44, 0]}>
          <Box p={[0, 0, 0]} s={[1.8, 0.88, 0.95]} c="#dc2626" r={0.03} metal={0.6} shadow />
          {Array.from({ length: 5 }).map((_, d) => (
            <group key={d} position={[0, -0.32 + d * 0.16, 0.49]}>
              <Box p={[0, 0, 0]} s={[1.65, 0.13, 0.02]} c="#b91c1c" />
              <Box p={[0, 0, 0.015]} s={[1.1, 0.02, 0.015]} c="#f8fafc" metal={0.95} />
            </group>
          ))}
        </group>

        {/* Right 5-Drawer Tool Chest Body */}
        <group position={[1.3, 0.44, 0]}>
          <Box p={[0, 0, 0]} s={[1.8, 0.88, 0.95]} c="#dc2626" r={0.03} metal={0.6} shadow />
          {Array.from({ length: 5 }).map((_, d) => (
            <group key={d} position={[0, -0.32 + d * 0.16, 0.49]}>
              <Box p={[0, 0, 0]} s={[1.65, 0.13, 0.02]} c="#b91c1c" />
              <Box p={[0, 0, 0.015]} s={[1.1, 0.02, 0.015]} c="#f8fafc" metal={0.95} />
            </group>
          ))}
        </group>

        {/* Center Lower Knee-Space with Lower Storage Shelf */}
        <Box p={[0, 0.18, 0]} s={[0.8, 0.04, 0.9]} c="#1e293b" metal={0.8} />
      </group>

      {/* Cast-Iron Heavy Bench Vise on Table Left Corner */}
      <group position={[-2.15, 1.02, -0.2]}>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.09, 0.11, 0.16, 12]} />
          <meshStandardMaterial color="#1e293b" metalness={0.85} />
        </mesh>
        <Box p={[0, 0.18, 0]} s={[0.18, 0.12, 0.26]} c="#334155" metal={0.9} />
        <mesh position={[0, 0.18, 0.13]} rotation={[PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.3, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.95} />
        </mesh>
      </group>

      {/* Synthetic Racing Fluid Jugs & Chemical Bottles on Workbench Right */}
      {[
        [1.6, 1.02, -0.2, '#15803d'],
        [1.85, 1.02, -0.15, '#dc2626'],
        [2.1, 1.02, -0.22, '#0284c7'],
      ].map(([ox, oy, oz, ocol], i) => (
        <group key={i} position={[ox, oy, oz]}>
          <Box p={[0, 0.11, 0]} s={[0.16, 0.22, 0.09]} c={ocol} r={0.02} />
          <mesh position={[0, 0.24, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.04, 8]} />
            <meshStandardMaterial color="#09090b" />
          </mesh>
        </group>
      ))}

      {/* Red Compressed Air Receiver Tank on Left */}
      <group position={[-2.8, 0, -0.3]}>
        <mesh position={[0, 0.65, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.9, 16]} />
          <meshStandardMaterial color="#dc2626" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.15, 0]}>
          <sphereGeometry args={[0.22, 14, 12]} />
          <meshStandardMaterial color="#dc2626" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Yellow Coiled Polyurethane Air Line */}
        <mesh position={[0, 0.55, 0.24]}>
          <torusGeometry args={[0.14, 0.022, 8, 16]} />
          <meshStandardMaterial color="#facc15" roughness={0.6} />
        </mesh>
      </group>

      {/* Stack of Pirelli P-Zero Racing Slicks on Rolling Tire Stand */}
      <group position={[2.9, 0, -0.2]}>
        {[0.16, 0.48, 0.8].map((ty, idx) => (
          <group key={idx} position={[0, ty, 0]}>
            <mesh>
              <cylinderGeometry args={[0.38, 0.38, 0.3, 20]} />
              <meshStandardMaterial color="#09090b" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.155, 0]}>
              <cylinderGeometry args={[0.24, 0.24, 0.02, 14]} />
              <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Low-Profile Hydraulic Floor Jack */}
      <group position={[-0.4, 0, 0.55]} rotation={[0, 0.35, 0]}>
        <Box p={[0, 0.08, 0]} s={[0.85, 0.12, 0.32]} c="#ef4444" metal={0.65} r={0.03} />
        <mesh position={[0.26, 0.15, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.03, 12]} />
          <meshStandardMaterial color="#18181b" />
        </mesh>
        <mesh position={[-0.4, 0.36, 0]} rotation={[0.38, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.75, 6]} />
          <meshStandardMaterial color="#ef4444" metalness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

// 3. Realistic Sports Superbike (Ducati/Ninja Style with Rear Paddock Stand)
function SportsSuperbike({ p, rot = 0 }) {
  const openBike = useOpenProp('garage', 'bike');
  return (
    <group position={p} rotation={[0, rot, 0]} {...openBike}>
      <PropDot position={[0, 1.9, 0]} kind="garage" arg="bike" />
      {/* display plinth with paddock-stand strip */}
      <Box p={[0, 0.06, 0]} s={[1.3, 0.12, 2.9]} c="#17171d" r={0.04} metal={0.4} />
      <Box p={[0, 0.125, 0]} s={[1.1, 0.01, 0.05]} c="#06b6d4" emissive="#06b6d4" ei={1.5} shadow={false} />
      <group position={[0, 0.12, 0]}><Superbike3D color="#d1121f" lightsOn /></group>
      <mesh position={[0, 0.7, 0]} visible={false}><boxGeometry args={[1.0, 1.4, 2.4]} /></mesh>
    </group>
  );
}

// 4. Pro Bicycle Station (Road Racing Carbon Bike & Full-Suspension MTB on Rack)
function ProBicycleStation({ p, rot = 0 }) {
  const openBikeTools = useOpenProp('garage', 'cycle');
  return (
    <group position={p} rotation={[0, rot, 0]} {...openBikeTools}>
      <PropDot position={[0, 1.8, 0]} kind="garage" arg="cycle" />
      {/* anodised parking rack with two bikes on it */}
      <Box p={[0, 0.04, 0]} s={[2.0, 0.08, 1.9]} c="#2b2d36" r={0.03} metal={0.6} />
      {[-0.5, 0.5].map(x => (
        <group key={x} position={[x, 0.08, 0]}>
          <Box p={[0, 0.16, 0.5]} s={[0.05, 0.32, 0.05]} c="#8b93a1" metal={0.9} />
          <Box p={[0, 0.3, 0.5]} s={[0.05, 0.04, 0.2]} c="#8b93a1" metal={0.9} />
        </group>
      ))}
      <group position={[-0.5, 0.08, 0]}><Bicycle3D type="road" color="#1d4ed8" /></group>
      <group position={[0.5, 0.08, 0]}><Bicycle3D type="mtb" color="#16a34a" /></group>
      <mesh position={[0, 0.5, 0]} visible={false}><boxGeometry args={[1.9, 1.2, 1.9]} /></mesh>
    </group>
  );
}

// ============================================================================
// FRONT YARD CELL (Main Assembly)
// ============================================================================
export function FrontYard() {
  return (
    <Cell id="frontyard">
      {/* Crisp Driveway Boundary & Vehicle Staging Lines */}
      {/* Supercar Parking Bay Lines */}
      <Box p={[10.3, 0.02, 8.8]} s={[0.08, 0.01, 10.5]} c="#ffffff" shadow={false} />
      <Box p={[15.7, 0.02, 8.8]} s={[0.08, 0.01, 10.5]} c="#ffffff" shadow={false} />
      {/* Yellow Safety Bay Edge Striping */}
      <Box p={[13.0, 0.02, 13.8]} s={[5.2, 0.01, 0.08]} c="#facc15" shadow={false} />
      {/* Bike Staging Guide Line */}
      <Box p={[6.2, 0.02, 6.8]} s={[0.06, 0.01, 6.0]} c="#e2e8f0" shadow={false} />

      {/* 1. ATTACHED WALL GARAGE WORKSHOP (Attached to Top-Left Wall) */}
      <AttachedGarageWorkshop p={[4.2, 0, 1.8]} />

      {/* 2. PRO BICYCLE STATION (Middle-Left Space: Road Bike & MTB on Rack) */}
      <ProBicycleStation p={[4.2, 0, 6.8]} rot={0.06} />

      {/* 3. SPORTS SUPERBIKE (Middle Yard: Ducati/Ninja Racing Superbike) */}
      <SportsSuperbike p={[8.2, 0, 6.2]} rot={-0.35} />

      {/* 4. TOP-MODEL FERRARI / LAMBORGHINI SUPERCAR (Right Driveway Bay) */}
      <TopModelSupercar3D p={[13.0, 0, 8.6]} rot={0} />

      {/* Modern Architectural Warm LED Wall Sconces for Radiant Illumination */}
      {[2.0, 6.8, 11.5, 16.0].map(wx => (
        <group key={wx} position={[wx, 2.6, 0.2]}>
          <Box p={[0, 0, 0]} s={[0.18, 0.32, 0.06]} c="#1e293b" metal={0.8} />
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[0.14, 0.26, 0.02]} />
            <meshBasicMaterial color="#fffbeb" toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Side Wall Sconces */}
      {[4.0, 10.0].map(wz => (
        <group key={wz} position={[0.2, 2.6, wz]}>
          <Box p={[0, 0, 0]} s={[0.06, 0.32, 0.18]} c="#1e293b" metal={0.8} />
          <mesh position={[0.04, 0, 0]}>
            <boxGeometry args={[0.02, 0.26, 0.14]} />
            <meshBasicMaterial color="#fffbeb" toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Compound Wall with Exit Gate */}
      <Box p={[3.6, 0.9, 15.8]} s={[7.2, 1.8, 0.38]} c="#27272a" r={0.03} />
      <Box p={[14.4, 0.9, 15.8]} s={[7.2, 1.8, 0.38]} c="#27272a" r={0.03} />
      <Box p={[3.6, 1.85, 15.8]} s={[7.4, 0.12, 0.48]} c="#3f3f46" />
      <Box p={[14.4, 1.85, 15.8]} s={[7.4, 0.12, 0.48]} c="#3f3f46" />

      {/* Gate Pillars with Warm Carriage Lanterns */}
      {[7.3, 10.7].map(x => (
        <group key={x}>
          <Box p={[x, 1.4, 15.8]} s={[0.8, 2.8, 0.8]} c="#3f3f46" r={0.05} />
          <Box p={[x, 2.9, 15.8]} s={[1.0, 0.22, 1.0]} c="#27272a" />
          <mesh position={[x, 3.25, 15.8]}>
            <sphereGeometry args={[0.26, 14, 12]} />
            <meshBasicMaterial color={NEON_AMBER} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Black Steel & Industrial Gate Slats */}
      {[7.9, 8.5].map(x => (
        <Box key={x} p={[x - 0.2, 1.0, 15.8]} s={[0.08, 2.0, 0.08]} c="#09090b" metal={0.8} />
      ))}
      {[10.1, 9.5].map(x => (
        <Box key={x} p={[x + 0.2, 1.0, 15.8]} s={[0.08, 2.0, 0.08]} c="#09090b" metal={0.8} />
      ))}

      {/* Welcome Entrance Mat */}
      <Rug p={[9.0, 0, 3.4]} w={3.2} d={1.6} c="#991b1b" c2="#dc2626" />
    </Cell>
  );
}
