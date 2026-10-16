import React, { useRef, useMemo } from 'react';
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
          {/* Base Plinth */}
          <Box p={[x, 0.15, 0]} s={[0.45, 0.3, 1.6]} c="#4a2a12" r={0.04} />
          {/* Slanted Upright Columns */}
          <mesh position={[x, 1.7, 0.52]} rotation={[-0.22, 0, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.09, 3.4, 12]} />
            <meshStandardMaterial color="#5c3418" roughness={0.7} />
          </mesh>
          <mesh position={[x, 1.7, -0.52]} rotation={[0.22, 0, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.09, 3.4, 12]} />
            <meshStandardMaterial color="#5c3418" roughness={0.7} />
          </mesh>
          {/* Brass Collar Rings */}
          <mesh position={[x, 1.4, 0.44]} rotation={[-0.22, 0, 0]}>
            <torusGeometry args={[0.09, 0.02, 8, 16]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[x, 1.4, -0.44]} rotation={[0.22, 0, 0]}>
            <torusGeometry args={[0.09, 0.02, 8, 16]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.25} />
          </mesh>
          {/* Turned Top Finials */}
          <mesh position={[x, 3.5, 0]}>
            <sphereGeometry args={[0.13, 14, 12]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.25} />
          </mesh>
        </group>
      ))}

      {/* Heavy Sculpted Top Crossbeam with Decorative End Brackets */}
      <mesh position={[0, 3.4, 0]} rotation={[0, 0, PI / 2]} castShadow>
        <cylinderGeometry args={[0.095, 0.095, w + 1.1, 14]} />
        <meshStandardMaterial color="#4a2a12" roughness={0.65} />
      </mesh>
      {/* Decorative Brass Elephant/Bird Finials at beam ends */}
      {[-w / 2 - 0.55, w / 2 + 0.55].map(x => (
        <mesh key={x} position={[x, 3.4, 0]}>
          <coneGeometry args={[0.12, 0.24, 10]} />
          <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.25} />
        </mesh>
      ))}

      {/* SWINGING SEAT ASSEMBLY */}
      <group position={[0, 3.3, 0]}>
        <group ref={swingRef}>
          {/* Ornate Brass Chains */}
          {[-w / 2 + 0.15, w / 2 - 0.15].map(x => (
            <group key={x}>
              <mesh position={[x, -1.2, 0]}>
                <cylinderGeometry args={[0.022, 0.022, 2.3, 8]} />
                <meshStandardMaterial color="#eab308" metalness={0.85} roughness={0.25} />
              </mesh>
              {/* Brass Chain Links & Charms */}
              {[-0.4, -0.9, -1.5, -2.0].map(y => (
                <mesh key={y} position={[x, y, 0]}>
                  <torusGeometry args={[0.045, 0.015, 8, 12]} />
                  <meshStandardMaterial color="#fbbf24" metalness={0.85} roughness={0.2} />
                </mesh>
              ))}
            </group>
          ))}

          {/* Carved Teakwood Swing Seat Platform */}
          <group position={[0, -2.35, 0]}>
            {/* Wooden Base Deck */}
            <Box p={[0, 0.06, 0]} s={[w - 0.1, 0.12, 1.05]} c="#5c3418" r={0.04} shadow />
            {/* Carved Backrest with Spindles */}
            <Box p={[0, 0.55, -0.48]} s={[w - 0.1, 0.08, 0.08]} c="#4a2a12" />
            <Box p={[0, 0.88, -0.48]} s={[w - 0.1, 0.1, 0.1]} c="#4a2a12" r={0.02} />
            {/* Backrest Spindles */}
            {Array.from({ length: 9 }).map((_, i) => {
              const sx = -w / 2 + 0.35 + i * ((w - 0.7) / 8);
              return (
                <mesh key={i} position={[sx, 0.72, -0.48]}>
                  <cylinderGeometry args={[0.018, 0.018, 0.28, 8]} />
                  <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.3} />
                </mesh>
              );
            })}
            {/* Curved Armrests */}
            {[-w / 2 + 0.05, w / 2 - 0.05].map(x => (
              <Box key={x} p={[x, 0.35, -0.1]} s={[0.08, 0.45, 0.8]} c="#5c3418" r={0.03} />
            ))}

            {/* Thick Royal Crimson Silk Mattress Cushion */}
            <Box p={[0, 0.18, -0.02]} s={[w - 0.28, 0.14, 0.9]} c="#991b1b" r={0.06} />
            {/* Golden Zari Embroidered Border Strip */}
            <Box p={[0, 0.25, 0.4]} s={[w - 0.32, 0.02, 0.06]} c="#f59e0b" emissive="#f59e0b" shadow={false} />

            {/* Cylindrical Silk Bolster Pillows (Masand) on Sides */}
            {[-w / 2 + 0.32, w / 2 - 0.32].map(x => (
              <group key={x} position={[x, 0.32, 0]} rotation={[PI / 2, 0, 0]}>
                <mesh>
                  <cylinderGeometry args={[0.13, 0.13, 0.65, 14]} />
                  <meshStandardMaterial color="#c2410c" roughness={0.65} />
                </mesh>
                {/* Gold Tassel Ends */}
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
      {/* Tier 1 - Plinth Base */}
      <Box p={[0, 0.16, 0]} s={[1.9, 0.32, 1.9]} c="#d4b490" r={0.04} shadow />
      {/* Tier 2 - Main Carved Shrine Body */}
      <Box p={[0, 0.6, 0]} s={[1.45, 0.6, 1.45]} c="#c49d74" r={0.03} shadow />
      {/* Carved Sanctum Niches on 4 Faces */}
      {[
        [0, 0.6, 0.74, 0],
        [0, 0.6, -0.74, PI],
        [0.74, 0.6, 0, PI / 2],
        [-0.74, 0.6, 0, -PI / 2],
      ].map(([x, y, z, rot], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, rot, 0]}>
          <Box p={[0, 0, 0]} s={[0.32, 0.38, 0.06]} c="#5c3818" shadow={false} />
          {/* Lit Brass Diya Inside Niche */}
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

      {/* Tier 3 - Ornate Lotus Petal Cornice Rim */}
      <Box p={[0, 1.0, 0]} s={[1.65, 0.22, 1.65]} c="#d4b490" r={0.04} />
      {/* Dark Loam Soil Basin */}
      <mesh position={[0, 1.12, 0]}>
        <cylinderGeometry args={[0.68, 0.68, 0.06, 18]} />
        <meshStandardMaterial color="#2d1c10" roughness={0.95} />
      </mesh>

      {/* Lush Holy Basil (Tulsi) Bush with Purple Flowering Spikes (Manjari) */}
      <group position={[0, 1.15, 0]}>
        {/* Woody Trunk */}
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.07, 0.5, 8]} />
          <meshStandardMaterial color="#4a2e16" roughness={0.9} />
        </mesh>
        {/* Branching Leaf Canopies with Green & Purple Undertones */}
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
        {/* Delicate Purple Flower Spikes (Tulsi Manjari) */}
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

      {/* 4 Brass Diyas with Warm Flickering Flame on Brass Thali Plates */}
      {[
        [1.15, 0.35, 1.15],
        [-1.15, 0.35, 1.15],
        [1.15, 0.35, -1.15],
        [-1.15, 0.35, -1.15],
      ].map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          {/* Circular Brass Thali */}
          <mesh position={[0, 0.01, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.02, 14]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
          </mesh>
          {/* Brass Diya Oil Lamp */}
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.08, 0.04, 0.06, 10]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.25} />
          </mesh>
          {/* Glowing Flame */}
          <mesh position={[0, 0.11, 0]}>
            <coneGeometry args={[0.035, 0.1, 8]} />
            <meshBasicMaterial color="#fef08a" toneMapped={false} />
          </mesh>
          {/* Flame Ambient Halo */}
          <mesh position={[0, 0.11, 0]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.3} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Brass Water Vessel (Kamandalu / Lota) on Step */}
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

// 3. Heritage Stone Masonry Well (Kuan) with Timber Pulley & Brass Bucket
function RealisticKuan({ p }) {
  return (
    <group position={p}>
      {/* Stone Masonry Outer Well Cylinder */}
      <mesh position={[0, 0.58, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.2, 1.28, 1.16, 28]} />
        <meshStandardMaterial color="#a68a68" roughness={0.9} />
      </mesh>
      {/* Polished Circular Coping Stone Rim on Top */}
      <mesh position={[0, 1.18, 0]}>
        <cylinderGeometry args={[1.34, 1.34, 0.16, 28]} />
        <meshStandardMaterial color="#c2a47e" roughness={0.7} />
      </mesh>

      {/* Inner Deep Reflective Water Surface with Ripple Rings */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[1.05, 1.05, 0.02, 24]} />
        <meshStandardMaterial
          color="#0284c7"
          emissive="#0369a1"
          emissiveIntensity={0.45}
          roughness={0.15}
          metalness={0.2}
        />
      </mesh>
      {/* Subtle concentric ripple discs */}
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
            <meshStandardMaterial color="#4a2e16" roughness={0.8} />
          </mesh>
          {/* Iron Support Brackets */}
          <Box p={[x, 1.2, 0]} s={[0.2, 0.1, 0.2]} c="#1f2937" metal={0.8} />
        </group>
      ))}
      {/* Timber Ridge Beam Overhead */}
      <mesh position={[0, 2.65, 0]} rotation={[0, 0, PI / 2]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 2.2, 10]} />
        <meshStandardMaterial color="#4a2e16" roughness={0.8} />
      </mesh>

      {/* Cast Iron Pulley Wheel */}
      <group position={[0, 2.45, 0]}>
        <mesh rotation={[0, 0, PI / 2]}>
          <cylinderGeometry args={[0.18, 0.18, 0.05, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.3} />
        </mesh>
        {/* Coiled Natural Jute Rope */}
        <mesh position={[0, -0.4, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.9, 8]} />
          <meshStandardMaterial color="#d97706" roughness={0.9} />
        </mesh>
      </group>

      {/* Suspended Hammered Brass / Copper Water Bucket (Balti) */}
      <group position={[0, 1.65, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.18, 0.14, 0.32, 14]} />
          <meshStandardMaterial color="#d97706" metalness={0.7} roughness={0.35} />
        </mesh>
        {/* Arched Metal Handle */}
        <mesh position={[0, 0.18, 0]}>
          <torusGeometry args={[0.14, 0.014, 8, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </mesh>
      </group>

      {/* Traditional Hammered Brass Water Pot (Ghada) Resting on Coping Ledge */}
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

// 4. Carved Stone Lotus Fountain Pond / Urli with Blooming Lotus & Ripple Spout
function RealisticLotusUrli({ p, r = 2.1 }) {
  const openFlowers = useOpenProp('garden', 'flowers');

  // Realistic lily pad configurations
  const pads = [
    [0.7, 0.4, 0.45, 0.4],
    [-0.8, 0.3, 0.42, 1.2],
    [0.1, -0.85, 0.44, 2.3],
    [-0.55, -0.55, 0.38, 3.1],
    [0.95, -0.35, 0.36, 4.2],
    [-1.0, 0.85, 0.4, 0.9],
  ];

  // Blooming sacred lotuses
  const lotuses = [
    [0.65, 0.45, '#ff80bf', '#fff0f6'],
    [-0.75, 0.35, '#ffffff', '#fed7aa'],
    [0.15, -0.8, '#ff66aa', '#fff0f6'],
  ];

  return (
    <group position={p} {...openFlowers}>
      <PropDot position={[0, 1.5, 0]} kind="garden" arg="flowers" />

      {/* Tiered Hand-Carved Sandstone Basin */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r + 0.16, 0.4, 32]} />
        <meshStandardMaterial color="#baa080" roughness={0.8} />
      </mesh>
      {/* Molded Decorative Rim */}
      <mesh position={[0, 0.4, 0]}>
        <torusGeometry args={[r + 0.05, 0.08, 12, 32]} />
        <meshStandardMaterial color="#cca885" roughness={0.7} />
      </mesh>

      {/* Glistening Crystal Turquoise Water Disc */}
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[r - 0.12, r - 0.12, 0.03, 32]} />
        <meshStandardMaterial
          color="#0284c7"
          emissive="#0369a1"
          emissiveIntensity={0.5}
          roughness={0.15}
          metalness={0.25}
        />
      </mesh>

      {/* Central Carved Stone Water Spout Bubbler */}
      <mesh position={[0, 0.44, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.16, 16]} />
        <meshStandardMaterial color="#cca885" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.54, 0]}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <meshStandardMaterial color="#38bdf8" roughness={0.2} />
      </mesh>
      {/* Concentric Water Ripple Discs */}
      {[0.5, 0.95, 1.4].map((rad, i) => (
        <mesh key={i} position={[0, 0.39, 0]} rotation={[-PI / 2, 0, 0]}>
          <ringGeometry args={[rad - 0.03, rad, 28]} />
          <meshBasicMaterial color="#7dd3fc" transparent opacity={0.4 - i * 0.1} />
        </mesh>
      ))}

      {/* Realistic Lotus Lily Pads with Notch Cuts */}
      {pads.map(([x, z, size, rot], i) => (
        <mesh key={i} position={[x * (r / 2), 0.41, z * (r / 2)]} rotation={[0, rot, 0]}>
          <cylinderGeometry args={[size, size, 0.015, 18, 1, false, 0.35, 5.7]} />
          <meshStandardMaterial color="#16a34a" roughness={0.65} />
        </mesh>
      ))}

      {/* Blooming Sacred Pink & White Lotus Flowers */}
      {lotuses.map(([x, z, petColor, coreColor], i) => (
        <group key={i} position={[x * (r / 2), 0.43, z * (r / 2)]}>
          {/* Multi-layered sculpted petals */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map(k => {
            const angle = k * (PI / 4);
            return (
              <mesh
                key={k}
                position={[Math.cos(angle) * 0.1, 0.08, Math.sin(angle) * 0.1]}
                rotation={[Math.sin(angle) * 0.45, 0, -Math.cos(angle) * 0.45]}
              >
                <coneGeometry args={[0.07, 0.28, 6]} />
                <meshStandardMaterial color={petColor} roughness={0.5} />
              </mesh>
            );
          })}
          {/* Inner Golden Core */}
          <mesh position={[0, 0.14, 0]}>
            <sphereGeometry args={[0.065, 8, 8]} />
            <meshStandardMaterial color="#eab308" emissive="#ca8a04" emissiveIntensity={0.3} />
          </mesh>
        </group>
      ))}

      {/* Floating Marigold and Rose Petals Scattered on Water */}
      {[
        [0.4, -0.3, '#f59e0b'],
        [-0.3, 0.6, '#ef4444'],
        [0.8, 0.1, '#f59e0b'],
        [-0.6, -0.4, '#e11d48'],
        [0.2, 0.8, '#f59e0b'],
      ].map(([px, pz, col], i) => (
        <mesh key={i} position={[px, 0.41, pz]} rotation={[-PI / 2, 0, Math.random() * PI]}>
          <circleGeometry args={[0.045, 6]} />
          <meshBasicMaterial color={col} />
        </mesh>
      ))}
    </group>
  );
}

// 5. Handcrafted Sheesham Charpai (Khatia) & Royal Chai Nook
function RealisticCharpaiNook({ p, rot = 0 }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      {/* Turned Wooden Legs with Brass Ferrules */}
      {[[-1.15, -0.65], [1.15, -0.65], [-1.15, 0.65], [1.15, 0.65]].map(([x, z], i) => (
        <group key={i}>
          <mesh position={[x, 0.3, z]} castShadow>
            <cylinderGeometry args={[0.075, 0.06, 0.6, 12]} />
            <meshStandardMaterial color="#5c3418" roughness={0.7} />
          </mesh>
          {/* Brass Cap */}
          <mesh position={[x, 0.04, z]}>
            <cylinderGeometry args={[0.065, 0.065, 0.08, 12]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* Solid Timber Side Rails */}
      <Box p={[0, 0.58, -0.65]} s={[2.45, 0.12, 0.12]} c="#5c3418" r={0.02} />
      <Box p={[0, 0.58, 0.65]} s={[2.45, 0.12, 0.12]} c="#5c3418" r={0.02} />
      <Box p={[-1.15, 0.58, 0]} s={[0.12, 0.12, 1.4]} c="#5c3418" r={0.02} />
      <Box p={[1.15, 0.58, 0]} s={[0.12, 0.12, 1.4]} c="#5c3418" r={0.02} />

      {/* Handwoven Chevron Cotton Webbing (Khatia Weave) */}
      {Array.from({ length: 10 }).map((_, i) => (
        <Box
          key={i}
          p={[-0.95 + i * 0.21, 0.61, 0]}
          s={[0.14, 0.03, 1.2]}
          c={i % 2 === 0 ? '#f8fafc' : '#1e3a8a'}
          shadow={false}
        />
      ))}
      {/* Longitudinal Tension Ropes (Adwain) */}
      {[-0.4, 0, 0.4].map((z, i) => (
        <Box key={i} p={[0, 0.63, z]} s={[2.2, 0.02, 0.08]} c="#d97706" shadow={false} />
      ))}

      {/* Folded Block-Print Cotton Quilt (Dhurrie) */}
      <Box p={[-0.45, 0.68, 0]} s={[1.2, 0.08, 1.05]} c="#e11d48" r={0.04} />
      <Box p={[-0.45, 0.73, 0]} s={[1.0, 0.02, 0.85]} c="#fef08a" shadow={false} />

      {/* Royal Cylindrical Bolster Pillow (Masand) */}
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

      {/* Heritage Chai Table (Carved Bajot Chowki) Beside Charpai */}
      <group position={[1.4, 0, 0.2]}>
        {/* Carved Wooden Bajot Stool */}
        <Box p={[0, 0.16, 0]} s={[0.75, 0.32, 0.75]} c="#5c3418" r={0.03} shadow />
        {/* Brass Tray */}
        <mesh position={[0, 0.33, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 0.02, 16]} />
          <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Antique Brass Chai Kettle */}
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
        {/* Two Terracotta Kulhad Tea Cups */}
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
      {/* Outer Fresh Green Mango Leaf Circle */}
      <mesh position={[0, 0.012, 0]} rotation={[-PI / 2, 0, 0]}>
        <ringGeometry args={[r * 0.88, r, 36]} />
        <meshBasicMaterial color="#15803d" />
      </mesh>
      {/* Fresh Marigold Orange Petal Ring */}
      <mesh position={[0, 0.015, 0]} rotation={[-PI / 2, 0, 0]}>
        <ringGeometry args={[r * 0.68, r * 0.88, 36]} />
        <meshBasicMaterial color="#f59e0b" />
      </mesh>
      {/* Velvety Crimson Rose Petal Ring */}
      <mesh position={[0, 0.018, 0]} rotation={[-PI / 2, 0, 0]}>
        <ringGeometry args={[r * 0.48, r * 0.68, 36]} />
        <meshBasicMaterial color="#be123c" />
      </mesh>
      {/* Golden Yellow Marigold Petal Ring */}
      <mesh position={[0, 0.021, 0]} rotation={[-PI / 2, 0, 0]}>
        <ringGeometry args={[r * 0.28, r * 0.48, 32]} />
        <meshBasicMaterial color="#eab308" />
      </mesh>
      {/* Fragrant White Jasmine Center Disc */}
      <mesh position={[0, 0.024, 0]} rotation={[-PI / 2, 0, 0]}>
        <circleGeometry args={[r * 0.28, 24]} />
        <meshBasicMaterial color="#fefce8" />
      </mesh>

      {/* Decorative Radial Flower Buds around perimeter */}
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

      {/* Towering South Indian Brass Standing Lamp (Kuthu Vilakku) in Center */}
      {isMain && (
        <group position={[0, 0, 0]}>
          {/* Stepped Circular Base */}
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.22, 0.28, 0.12, 16]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
          </mesh>
          {/* Fluted Brass Column with Bulbs */}
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
          {/* 5-Wick Oil Reservoir Bowl */}
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.24, 0.12, 0.08, 16]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
          </mesh>
          {/* 5 Glowing Oil Wicks */}
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
          {/* Ornate Brass Peacock Finial (Annapakshi) */}
          <mesh position={[0, 1.26, 0]}>
            <coneGeometry args={[0.08, 0.22, 8]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.85} roughness={0.25} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// 7. Traditional Brass Water Urli with Floating Rose Petals & Tea Lights
function RealisticBrassUrli({ p }) {
  return (
    <group position={p}>
      {/* Hand-hammered Brass Bowl */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.65, 0.42, 0.32, 24]} />
        <meshStandardMaterial color="#eab308" metalness={0.85} roughness={0.25} />
      </mesh>
      {/* Flared Rim */}
      <mesh position={[0, 0.34, 0]}>
        <torusGeometry args={[0.66, 0.04, 10, 24]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Clear Water Disc */}
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.63, 0.63, 0.015, 20]} />
        <meshStandardMaterial color="#0284c7" emissive="#0369a1" emissiveIntensity={0.3} roughness={0.1} />
      </mesh>
      {/* Floating Fresh Rose & Marigold Petals */}
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
      {/* Floating Glowing Tea Light Candle in center */}
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
      {/* Stepped Carved Plinth Base */}
      <Box p={[0, 0.22, 0]} s={[1.05, 0.44, 1.05]} c="#967a5c" r={0.04} shadow />
      <Box p={[0, 0.5, 0]} s={[0.85, 0.2, 0.85]} c="#baa080" r={0.03} />

      {/* Fluted Octagonal-to-Round Stone Column Shaft */}
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.34, h - 1.1, 14]} />
        <meshStandardMaterial color="#baa080" roughness={0.75} />
      </mesh>
      {/* Decorative Carved Collars */}
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.36, 0.32, 0.14, 14]} />
        <meshStandardMaterial color="#967a5c" />
      </mesh>
      <mesh position={[0, h - 0.9, 0]}>
        <cylinderGeometry args={[0.36, 0.32, 0.14, 14]} />
        <meshStandardMaterial color="#967a5c" />
      </mesh>

      {/* Carved Stone Capital with 4-Way Timber Bracket Beam Supports */}
      <Box p={[0, h - 0.35, 0]} s={[0.9, 0.3, 0.9]} c="#967a5c" r={0.04} />
      <Box p={[0, h - 0.1, 0]} s={[1.2, 0.2, 1.2]} c="#5c3418" r={0.03} />

      {/* Hanging Brass Temple Bell (Ghanti) with Sacred Red Cord */}
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
// COURTYARD CELL (Main Realistic Assembly)
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

      {/* Heritage Stone Masonry Well (Kuan) */}
      <RealisticKuan p={[15.0, 0, 6.0]} />

      {/* Carved Stone Lotus Pond Basin (Clickable Flower Explorer) */}
      <RealisticLotusUrli p={[5.8, 0, 4.6]} r={2.1} />

      {/* Woven Sheesham Charpai & Royal Chai Table Nook */}
      <RealisticCharpaiNook p={[14.2, 0, 13.6]} />

      {/* Authentic Fresh Flower Petal Rangoli with Standing Brass Deepam */}
      <RealisticFloralRangoli p={[7.0, 0, 11.4]} r={1.8} isMain />
      <RealisticFloralRangoli p={[14.4, 0, 3.6]} r={1.2} isMain={false} />

      {/* Traditional Brass Water Urli with Floating Petals & Tea Lights */}
      <RealisticBrassUrli p={[9.6, 0, 6.4]} />

      {/* Lush Courtyard Flora */}
      {/* Magnificent Potted Areca Palm in Corner */}
      <group position={[1.4, 0, 2.8]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.3, 0.8, 14]} />
          <meshStandardMaterial color="#c2410c" roughness={0.8} />
        </mesh>
        <Plant p={[0, 0.8, 0]} scale={1.4} color="#16a34a" />
      </group>

      {/* Flowering Frangipani / Champa Tree with Fallen Blossoms */}
      <group position={[16.8, 0, 9.6]}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.32, 0.7, 14]} />
          <meshStandardMaterial color="#a85d38" roughness={0.85} />
        </mesh>
        <Tree p={[0, 0.7, 0]} scale={1.05} />
        {/* Fallen white/yellow blossoms on the stone floor */}
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

      {/* Fragrant Jasmine (Mogra) Planter */}
      <Plant p={[2.4, 0, 7.4]} scale={1.15} color="#22c55e" pot="#b45309" />
      {/* Potted Flowering Hibiscus near Well */}
      <Plant p={[11.2, 0, 2.6]} scale={1.1} color="#15803d" pot="#c2410c" />
      <Plant p={[8.6, 0, 15.0]} scale={1.05} color="#16a34a" pot="#b45309" />
    </Cell>
  );
}

// ============================================================================
// FRONT YARD REALISTIC 3D COMPONENTS (Driveway, Car, Scooter, Entrance Gate)
// ============================================================================

// Realistic Sleek Modern Crossover / Car
function RealisticModernCar({ p, rot = 0, color = '#1d4ed8' }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      {/* Main Lower Chassis & Body */}
      <Box p={[0, 0.58, 0]} s={[4.3, 0.75, 1.9]} c={color} r={0.24} metal={0.65} rough={0.25} shadow />
      {/* Cabin Roof / Greenhouse */}
      <Box p={[-0.25, 1.28, 0]} s={[2.5, 0.72, 1.68]} c={color} r={0.22} metal={0.65} rough={0.25} shadow />
      {/* Panoramic Tinted Glass Windshield & Windows */}
      <Box p={[-0.25, 1.3, 0]} s={[2.52, 0.52, 1.7]} c="#0f172a" r={0.18} rough={0.1} metal={0.8} shadow={false} />
      {/* Front Hood Scoop */}
      <Box p={[1.2, 0.95, 0]} s={[1.2, 0.08, 1.4]} c={color} r={0.1} metal={0.65} />

      {/* 4 Realistic Wheels with Rubber Tires & Alloy Multi-Spoke Rims */}
      {[
        [-1.35, -0.98],
        [1.35, -0.98],
        [-1.35, 0.98],
        [1.35, 0.98],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.38, z]}>
          {/* Black Rubber Tire */}
          <mesh rotation={[PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.38, 0.38, 0.26, 18]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} />
          </mesh>
          {/* Silver Chrome Multi-Spoke Alloy Rim */}
          <mesh rotation={[PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.26, 0.26, 0.27, 14]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Center Hub */}
          <mesh rotation={[PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.28, 8]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        </group>
      ))}

      {/* Modern Projector LED Headlights */}
      <Box p={[2.14, 0.7, 0.58]} s={[0.08, 0.16, 0.42]} c="#f8fafc" emissive="#ffffff" emissiveIntensity={0.8} shadow={false} />
      <Box p={[2.14, 0.7, -0.58]} s={[0.08, 0.16, 0.42]} c="#f8fafc" emissive="#ffffff" emissiveIntensity={0.8} shadow={false} />
      {/* Front Radiator Grille */}
      <Box p={[2.15, 0.52, 0]} s={[0.06, 0.22, 0.75]} c="#0f172a" metal={0.8} />

      {/* Sleek LED Taillight Strip */}
      <Box p={[-2.14, 0.72, 0]} s={[0.08, 0.12, 1.55]} c="#ef4444" emissive="#dc2626" emissiveIntensity={0.9} shadow={false} />
    </group>
  );
}

// Classic Retro Turquoise Scooter
function RealisticRetroScooter({ p, rot = 0, color = '#06b6d4' }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      {/* Rounded Vintage Body Chassis */}
      <Box p={[0, 0.52, 0]} s={[1.6, 0.44, 0.54]} c={color} r={0.16} metal={0.4} rough={0.35} shadow />
      {/* Front Steering Column */}
      <mesh position={[0.58, 0.95, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.75, 8]} />
        <meshStandardMaterial color="#334155" metalness={0.7} />
      </mesh>
      {/* Chrome Handlebar */}
      <Box p={[0.58, 1.32, 0]} s={[0.08, 0.08, 0.85]} c="#e2e8f0" metal={0.9} rough={0.2} />
      {/* Round Chrome Headlight */}
      <mesh position={[0.66, 1.32, 0]} rotation={[0, 0, -PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.08, 14]} />
        <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={0.8} />
      </mesh>
      {/* Tan Leather Dual Saddle Seat */}
      <Box p={[-0.18, 0.82, 0]} s={[0.85, 0.14, 0.46]} c="#92400e" r={0.07} />
      {/* Front Chrome Round Mirrors */}
      {[-0.38, 0.38].map(z => (
        <group key={z} position={[0.55, 1.5, z]}>
          <mesh rotation={[0, 0, PI / 2]}>
            <cylinderGeometry args={[0.065, 0.065, 0.02, 10]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
          </mesh>
        </group>
      ))}
      {/* Two Wheels */}
      {[-0.65, 0.65].map(x => (
        <mesh key={x} position={[x, 0.28, 0]} rotation={[PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.14, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================================
// FRONT YARD CELL
// ============================================================================
export function FrontYard() {
  return (
    <Cell id="frontyard">
      {/* Granite Paver Driveway Strip */}
      <Box p={[9, 0.02, 9]} s={[5.8, 0.04, 14.5]} c="#332f3d" shadow={false} rough={0.9} />
      {/* Driveway Guide Lines */}
      <Box p={[9, 0.045, 9]} s={[0.12, 0.02, 12]} c="#f4e6a8" shadow={false} />

      {/* Sleek Modern Luxury Car in Driveway */}
      <RealisticModernCar p={[13.6, 0, 11.4]} rot={-PI / 2 + 0.15} color="#1d4ed8" />

      {/* Classic Retro Scooter */}
      <RealisticRetroScooter p={[3.4, 0, 12.0]} rot={0.4} color="#06b6d4" />

      {/* Compound Wall with Sandstone Pillars & Wood Slats */}
      <Box p={[3.6, 0.9, 15.8]} s={[7.2, 1.8, 0.38]} c="#d9c9a8" r={0.03} />
      <Box p={[14.4, 0.9, 15.8]} s={[7.2, 1.8, 0.38]} c="#d9c9a8" r={0.03} />
      <Box p={[3.6, 1.85, 15.8]} s={[7.4, 0.12, 0.48]} c="#a8896a" />
      <Box p={[14.4, 1.85, 15.8]} s={[7.4, 0.12, 0.48]} c="#a8896a" />

      {/* Main Entrance Gate Pillars with Warm Carriage Lanterns */}
      {[7.3, 10.7].map(x => (
        <group key={x}>
          <Box p={[x, 1.4, 15.8]} s={[0.8, 2.8, 0.8]} c="#c9a77a" r={0.05} />
          <Box p={[x, 2.9, 15.8]} s={[1.0, 0.22, 1.0]} c="#a8896a" />
          {/* Warm Glass Carriage Lantern */}
          <mesh position={[x, 3.25, 15.8]}>
            <sphereGeometry args={[0.26, 14, 12]} />
            <meshBasicMaterial color={NEON_AMBER} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Modern Black Iron & Teak Slatted Gate */}
      {[7.9, 8.5].map(x => (
        <Box key={x} p={[x - 0.2, 1.0, 15.8]} s={[0.08, 2.0, 0.08]} c="#1e293b" metal={0.8} />
      ))}
      {[10.1, 9.5].map(x => (
        <Box key={x} p={[x + 0.2, 1.0, 15.8]} s={[0.08, 2.0, 0.08]} c="#1e293b" metal={0.8} />
      ))}
      <Neon p={[9.0, 3.5, 15.8]} s={[3.4, 0.12, 0.12]} color={NEON_PINK} />

      {/* Brass Address Plaque & Modern Mailbox */}
      <Box p={[6.2, 0.65, 13.4]} s={[0.48, 0.72, 0.38]} c="#991b1b" r={0.05} />
      <Box p={[6.2, 0.25, 13.4]} s={[0.1, 0.5, 0.1]} c="#1e293b" />

      {/* Entrance Welcome Mat */}
      <Rug p={[9.0, 0, 3.4]} w={3.2} d={1.6} c="#1e3a8a" c2="#3b82f6" />

      {/* Manicured Landscaping & Solar Pathway Lights */}
      <Tree p={[1.8, 0, 3.0]} scale={1.05} />
      <Tree p={[11.4, 0, 2.2]} scale={0.9} />
      {[3.0, 15.0].map(x => (
        <Plant key={x} p={[x, 0, 11.0]} scale={1.2} pot="#c2410c" color="#16a34a" />
      ))}
      <Plant p={[1.0, 0, 15.0]} scale={1.25} color="#15803d" />
      <Plant p={[17.0, 0, 15.0]} scale={1.25} color="#15803d" />
    </Cell>
  );
}
