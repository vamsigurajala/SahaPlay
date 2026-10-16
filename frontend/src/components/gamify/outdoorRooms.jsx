import React, { useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Box, Neon, Plant, Tree, BeanBag, Rug, Table, Stool, FloorLamp, useOpenProp, PropDot } from './parts';
import { Cell } from './cell';
import { NEON_PINK, NEON_VIOLET, NEON_AMBER } from './constants';

const PI = Math.PI;

// ============================================================================
// TERRACE (Upstairs Open Roof Lounge)
// ============================================================================
export function Terrace() {
  return (
    <Cell id="terrace">
      <Box p={[9, 0.4, 15.85]} s={[18, 0.8, 0.3]} c="#a8896a" r={0.03} />
      <Rug p={[4.2, 0, 6.4]} w={6.2} d={7.6} c="#d0592a" c2="#e8844a" />
      <group position={[4.2, 0, 4.2]}>
        <Box p={[0, 0.3, 0]} s={[2.2, 0.6, 1.2]} c="#8a5a34" r={0.04} />
        <Box p={[-0.8, 0.7, 0]} s={[0.5, 0.2, 0.7]} c="#ff6fb5" r={0.08} />
      </group>
      <group position={[4.2, 0, 8.6]}>
        <Box p={[0, 0.3, 0]} s={[2.2, 0.6, 1.2]} c="#8a5a34" r={0.04} />
        <Box p={[-0.8, 0.7, 0]} s={[0.5, 0.2, 0.7]} c="#3ee8ff" r={0.08} />
      </group>
      <Table p={[8.0, 0, 6.4]} w={1.4} d={1.4} h={0.7} c="#8a5a34" leg="#4a2f1a" />
      <mesh position={[8.0, 0.95, 6.4]}>
        <cylinderGeometry args={[0.16, 0.2, 0.32, 12]} />
        <meshStandardMaterial color="#c8ccd6" metalness={0.85} roughness={0.3} />
      </mesh>
      {[-0.3, 0.3].map(dx => (
        <mesh key={dx} position={[8.0 + dx, 0.82, 6.9]}>
          <cylinderGeometry args={[0.09, 0.07, 0.12, 10]} />
          <meshStandardMaterial color="#f4f1e8" />
        </mesh>
      ))}
      <Stool p={[8.0, 0, 5.2]} c="#d0592a" />
      <Stool p={[8.0, 0, 7.6]} c="#2f8f9d" />
      <group position={[13.4, 0, 12.4]}>
        <Box p={[0, 0.9, 0]} s={[2.2, 0.14, 0.9]} c="#b0773f" r={0.04} />
        <Box p={[0, 1.4, -0.4]} s={[2.2, 0.8, 0.1]} c="#b0773f" r={0.04} />
      </group>
      <group position={[16.4, 0, 1.8]}>
        {[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([x, z], i) => (
          <Box key={i} p={[x, 0.5, z]} s={[0.12, 1.0, 0.12]} c="#6f6a86" />
        ))}
        <Box p={[0, 1.05, 0]} s={[1.4, 0.1, 1.4]} c="#6f6a86" />
        <mesh position={[0, 1.95, 0]} castShadow>
          <cylinderGeometry args={[0.7, 0.7, 1.6, 20]} />
          <meshStandardMaterial color="#22212c" roughness={0.6} />
        </mesh>
      </group>
      <BeanBag p={[14.6, 0, 7.4]} color="#d0592a" glow={NEON_AMBER} />
      <FloorLamp p={[1.2, 0, 1.6]} />
    </Cell>
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
    </Cell>
  );
}

// ============================================================================
// FRONT YARD SUPERCAR GARAGE & PIT WORKSHOP
// ============================================================================

// 1. Top-Model Ferrari / Lamborghini Supercar in 3D (Clickable for 3D Cockpit)
function TopModelSupercar3D({ p, rot = 0 }) {
  const openCar = useOpenProp('supercar');

  return (
    <group position={p} rotation={[0, rot, 0]} {...openCar}>
      <PropDot position={[0, 1.8, 0]} kind="supercar" />

      {/* Aerodynamic Low-Slung Wedge Body (Ferrari Rosso Corsa) */}
      <Box p={[0, 0.42, 0]} s={[4.6, 0.65, 2.05]} c="#dc2626" r={0.24} metal={0.7} rough={0.2} shadow />
      {/* Cockpit Canopy & Black Carbon Roof */}
      <Box p={[-0.2, 0.95, 0]} s={[2.4, 0.6, 1.62]} c="#18181b" r={0.22} metal={0.8} rough={0.2} shadow />
      {/* Tinted Windshield & Side Windows */}
      <Box p={[-0.2, 0.96, 0]} s={[2.42, 0.48, 1.64]} c="#09090b" r={0.18} rough={0.1} metal={0.85} shadow={false} />

      {/* Front Hood with Sculpted Aerodynamic Vent Ducts */}
      <Box p={[1.25, 0.68, 0]} s={[1.4, 0.12, 1.45]} c="#dc2626" r={0.1} metal={0.7} />
      {/* Front Carbon-Fiber Splitter */}
      <Box p={[2.3, 0.22, 0]} s={[0.3, 0.06, 1.95]} c="#09090b" roughness={0.3} />

      {/* Aggressive LED Daytime Running Light Blades */}
      <Box p={[2.18, 0.52, 0.65]} s={[0.14, 0.08, 0.38]} c="#ffffff" emissive="#ffffff" emissiveIntensity={1.4} shadow={false} />
      <Box p={[2.18, 0.52, -0.65]} s={[0.14, 0.08, 0.38]} c="#ffffff" emissive="#ffffff" emissiveIntensity={1.4} shadow={false} />

      {/* Side Air Scoop Intakes */}
      <Box p={[-0.8, 0.54, 1.05]} s={[0.8, 0.34, 0.12]} c="#09090b" />
      <Box p={[-0.8, 0.54, -1.05]} s={[0.8, 0.34, 0.12]} c="#09090b" />

      {/* Active Aero Rear Wing Spoiler */}
      <group position={[-2.15, 0.88, 0]}>
        <Box p={[0, 0, 0]} s={[0.38, 0.06, 1.9]} c="#18181b" metal={0.8} r={0.03} />
        {[-0.6, 0.6].map(x => (
          <Box key={x} p={[0, -0.2, x]} s={[0.15, 0.35, 0.04]} c="#09090b" />
        ))}
      </group>

      {/* High-Mounted Dual Exhaust Pipes with Heat Glow */}
      {[-0.2, 0.2].map(z => (
        <mesh key={z} position={[-2.32, 0.58, z]} rotation={[0, 0, PI / 2]}>
          <cylinderGeometry args={[0.075, 0.075, 0.12, 14]} />
          <meshStandardMaterial color="#475569" metalness={0.9} emissive="#0284c7" emissiveIntensity={0.4} />
        </mesh>
      ))}

      {/* Rear LED Taillight Lightbar */}
      <Box p={[-2.3, 0.68, 0]} s={[0.06, 0.08, 1.7]} c="#ef4444" emissive="#ef4444" emissiveIntensity={1.2} shadow={false} />

      {/* 4 Staggered Racing Wheels with Red Brembo Brake Calipers */}
      {[
        [-1.45, -1.05],
        [1.45, -1.05],
        [-1.45, 1.05],
        [1.45, 1.05],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.36, z]}>
          {/* Pirelli P-Zero Wide Rubber Tire */}
          <mesh rotation={[PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.38, 0.38, 0.28, 20]} />
            <meshStandardMaterial color="#09090b" roughness={0.9} />
          </mesh>
          {/* Matte Black & Bronze Multi-Spoke Alloy Rim */}
          <mesh rotation={[PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.27, 0.27, 0.29, 14]} />
            <meshStandardMaterial color="#27272a" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Red Brembo Brake Caliper */}
          <Box p={[0.08, 0.15, 0]} s={[0.12, 0.15, 0.26]} c="#ef4444" metal={0.6} />
        </group>
      ))}
    </group>
  );
}

// 2. Professional Garage Mechanic Workbench & Tool Chest (Clickable for Workshop)
function GarageWorkshopBay({ p }) {
  const openGarage = useOpenProp('garage');

  return (
    <group position={p} {...openGarage}>
      <PropDot position={[0, 2.2, 0]} kind="garage" />

      {/* Heavy-Duty Snap-on Red & Black Multi-Drawer Rolling Tool Chest */}
      <group position={[0, 0, 0]}>
        {/* Main Chest Cabinet Body */}
        <Box p={[0, 0.65, 0]} s={[2.2, 1.3, 0.85]} c="#dc2626" r={0.04} metal={0.5} rough={0.3} shadow />
        {/* Top Heavy-Duty Rubber Work Mat */}
        <Box p={[0, 1.32, 0]} s={[2.24, 0.04, 0.88]} c="#18181b" roughness={0.9} />
        {/* Drawer Faces with Polished Chrome Handles */}
        {[-0.6, 0.6].map(x => (
          <group key={x}>
            {Array.from({ length: 5 }).map((_, d) => (
              <group key={d} position={[x, 0.3 + d * 0.22, 0.44]}>
                <Box p={[0, 0, 0]} s={[0.95, 0.18, 0.03]} c="#b91c1c" />
                <Box p={[0, 0, 0.02]} s={[0.65, 0.025, 0.02]} c="#f8fafc" metal={0.9} />
              </group>
            ))}
          </group>
        ))}
      </group>

      {/* Wall-Mounted Perforated Tool Pegboard */}
      <group position={[0, 2.2, -0.42]}>
        <Box p={[0, 0, 0]} s={[2.6, 1.4, 0.04]} c="#334155" metal={0.5} rough={0.6} />
        {/* Hanging Wrenches & Ratchets */}
        {[-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9].map((wx, i) => (
          <group key={i} position={[wx, 0.15 - (i % 3) * 0.18, 0.03]}>
            <Box p={[0, 0, 0]} s={[0.04, 0.35 + (i % 3) * 0.08, 0.02]} c="#e2e8f0" metal={0.9} />
            <mesh position={[0, 0.2, 0]}>
              <torusGeometry args={[0.04, 0.012, 6, 10]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.9} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Cast-Iron Bench Vise on Table Corner */}
      <group position={[0.9, 1.42, 0.25]}>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.1, 0.12, 0.16, 10]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        <Box p={[0, 0.18, 0]} s={[0.18, 0.1, 0.28]} c="#334155" metal={0.85} />
        <mesh position={[0, 0.18, 0.14]} rotation={[PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.32, 6]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
        </mesh>
      </group>

      {/* Racing Synthetic Oil Jugs (Motul 300V / Castrol) */}
      {[
        [-0.8, 1.42, 0.1, '#15803d'],
        [-0.55, 1.42, 0.15, '#e11d48'],
        [-0.3, 1.42, 0.08, '#15803d'],
      ].map(([ox, oy, oz, ocol], i) => (
        <group key={i} position={[ox, oy, oz]}>
          <Box p={[0, 0.12, 0]} s={[0.18, 0.24, 0.1]} c={ocol} r={0.02} />
          <mesh position={[0, 0.26, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.04, 8]} />
            <meshStandardMaterial color="#09090b" />
          </mesh>
        </group>
      ))}

      {/* Stack of Pirelli P-Zero Racing Slick Tires */}
      <group position={[-1.7, 0, 0.1]}>
        {[0.18, 0.54, 0.9].map((ty, idx) => (
          <group key={idx} position={[0, ty, 0]}>
            <mesh rotation={[0, 0, 0]}>
              <cylinderGeometry args={[0.42, 0.42, 0.34, 18]} />
              <meshStandardMaterial color="#09090b" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.17, 0]}>
              <cylinderGeometry args={[0.26, 0.26, 0.02, 14]} />
              <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Low-Profile Hydraulic Racing Floor Jack */}
      <group position={[0.2, 0, 1.2]} rotation={[0, 0.4, 0]}>
        <Box p={[0, 0.1, 0]} s={[0.9, 0.14, 0.35]} c="#ef4444" metal={0.6} r={0.03} />
        <mesh position={[0.28, 0.18, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.04, 12]} />
          <meshStandardMaterial color="#18181b" />
        </mesh>
        <mesh position={[-0.45, 0.4, 0]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.8, 6]} />
          <meshStandardMaterial color="#ef4444" metalness={0.7} />
        </mesh>
      </group>

      {/* Red Compressed Air Tank with Coiled Yellow Hose */}
      <group position={[1.8, 0, -0.1]}>
        <mesh position={[0, 0.65, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.24, 0.9, 14]} />
          <meshStandardMaterial color="#dc2626" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.15, 0]}>
          <sphereGeometry args={[0.24, 12, 10]} />
          <meshStandardMaterial color="#dc2626" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Yellow Hose Coils */}
        <mesh position={[0, 0.5, 0.26]}>
          <torusGeometry args={[0.15, 0.025, 8, 16]} />
          <meshStandardMaterial color="#facc15" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

// 3. Modern Supercar Garage Carport Canopy with Hexagonal LED Ceiling Lights
function GaragePergolaCanopy() {
  return (
    <group position={[9, 0, 8]}>
      {/* 4 Heavy Industrial Matte Black Steel Columns */}
      {[[-7.2, -6.8], [7.2, -6.8], [-7.2, 6.8], [7.2, 6.8]].map(([x, z], i) => (
        <group key={i} position={[x, 2.4, z]}>
          <Box p={[0, 0, 0]} s={[0.28, 4.8, 0.28]} c="#0f172a" metal={0.8} />
          {/* Base Anchor Plate */}
          <Box p={[0, -2.3, 0]} s={[0.5, 0.2, 0.5]} c="#1e293b" metal={0.8} />
        </group>
      ))}

      {/* Steel Roof Perimeter Girder Frame */}
      <Box p={[0, 4.75, -6.8]} s={[14.8, 0.25, 0.25]} c="#0f172a" metal={0.85} />
      <Box p={[0, 4.75, 6.8]} s={[14.8, 0.25, 0.25]} c="#0f172a" metal={0.85} />
      <Box p={[-7.2, 4.75, 0]} s={[0.25, 0.25, 13.8]} c="#0f172a" metal={0.85} />
      <Box p={[7.2, 4.75, 0]} s={[0.25, 0.25, 13.8]} c="#0f172a" metal={0.85} />

      {/* Hexagonal Modern Honeycomb LED Light Array on Ceiling */}
      {[-3.6, 0, 3.6].map(hx => (
        <group key={hx} position={[hx, 4.65, 0]}>
          {[-3.2, 0, 3.2].map(hz => (
            <mesh key={hz} position={[0, 0, hz]} rotation={[-PI / 2, 0, 0]}>
              <ringGeometry args={[1.2, 1.28, 6]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Neon Supercar Garage Sign */}
      <group position={[0, 4.4, -6.65]}>
        <Box p={[0, 0, 0]} s={[4.5, 0.6, 0.1]} c="#09090b" />
        <Neon p={[0, 0, 0.06]} s={[4.2, 0.35, 0.05]} color="#ef4444" />
      </group>
    </group>
  );
}

// ============================================================================
// FRONT YARD CELL (Full Supercar Garage Assembly)
// ============================================================================
export function FrontYard() {
  return (
    <Cell id="frontyard">
      {/* Modern Granite Garage Pit Floor Strip with Racing Staging Grid Lines */}
      <Box p={[9, 0.02, 8.5]} s={[15.5, 0.04, 14.2]} c="#18181b" shadow={false} rough={0.9} />
      {/* Racing Yellow Staging Lines */}
      <Box p={[11.5, 0.045, 9]} s={[0.12, 0.02, 11]} c="#facc15" shadow={false} />
      <Box p={[6.5, 0.045, 9]} s={[0.12, 0.02, 11]} c="#facc15" shadow={false} />

      {/* Modern Supercar Garage Carport Canopy with Hexagonal LED Ceiling Lights */}
      <GaragePergolaCanopy />

      {/* TOP MODEL FERRARI / LAMBORGHINI SUPERCAR in Center-Right (Click to view 3D Cockpit!) */}
      <TopModelSupercar3D p={[11.2, 0, 9.2]} rot={-PI / 2 + 0.12} />

      {/* PROFESSIONAL MECHANIC WORKSHOP BAY & ROLLING TOOL CHEST on Left (Click to inspect tools!) */}
      <GarageWorkshopBay p={[4.2, 0, 8.5]} />

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
