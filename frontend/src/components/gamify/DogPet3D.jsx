import React, { useRef, useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useOpenProp } from './parts';
import { dogState } from './dogState';

// Multi-phase adventure waypoints: pond loop -> agility bridge (elevated y) -> toys -> inside doghouse (top right) -> exit
const ADVENTURE_PATH = [
  // 1-4: Pond perimeter
  { x: 10.5, y: 0, z: 10.6, pause: 0 },
  { x: 12.8, y: 0, z: 8.4, pause: 0 },
  { x: 11.2, y: 0, z: 6.2, pause: 0.8 }, // brief pause to watch fish
  { x: 8.2, y: 0, z: 7.2, pause: 0 },
  // 5-8: Agility Play Bridge (ramps up to y = 0.44, trots across, ramps down)
  { x: 5.2, y: 0, z: 4.8, pause: 0 }, // base of left ramp
  { x: 6.0, y: 0.44, z: 4.8, pause: 0 }, // top of bridge
  { x: 6.8, y: 0.44, z: 4.8, pause: 0.4 }, // proud pause on bridge deck
  { x: 7.6, y: 0, z: 4.8, pause: 0 }, // exit ramp back to grass
  // 9-10: Playing with ball on lawn
  { x: 8.6, y: 0, z: 4.0, pause: 0.6 }, // nudge tennis ball
  { x: 11.4, y: 0, z: 3.6, pause: 0 }, // trotting to doghouse
  // 11-13: Entering Doghouse in top-right corner
  { x: 13.4, y: 0, z: 3.4, pause: 0 }, // outside doorway
  { x: 14.3, y: 0.06, z: 3.2, pause: 2.2, inside: true }, // cozy inside doghouse on soft bed!
  { x: 13.4, y: 0, z: 3.4, pause: 0 }, // exiting doorway
  { x: 11.6, y: 0, z: 6.6, pause: 0 }, // looping back to pond
];

export default function DogPet3D() {
  const [pet, setPet] = useState(() => dogState.get());
  const openProp = useOpenProp('dog');

  useEffect(() => {
    return dogState.subscribe(setPet);
  }, []);

  const rootRef = useRef();
  const bodyRef = useRef();
  const headRef = useRef();
  const tailRef = useRef();
  const earLRef = useRef();
  const earRRef = useRef();
  const legFLRef = useRef();
  const legFRRef = useRef();
  const legBLRef = useRef();
  const legBRRef = useRef();

  const currentSegmentRef = useRef(0);
  const segmentProgressRef = useRef(0);
  const pauseTimerRef = useRef(0);

  useFrame((_, delta) => {
    if (!rootRef.current) return;
    const dt = Math.min(delta, 0.1);

    // Pause handling (e.g. inside doghouse, sniffing fish, or proud on bridge)
    if (pauseTimerRef.current > 0) {
      pauseTimerRef.current -= dt;
      // Idle tail wag & happy head pant while resting
      if (tailRef.current) tailRef.current.rotation.y = Math.sin(Date.now() * 0.008) * 0.55;
      if (headRef.current) headRef.current.rotation.x = Math.sin(Date.now() * 0.004) * 0.08 - 0.02;
      return;
    }

    const speed = 0.75; // units per second
    const segIdx = currentSegmentRef.current;
    const nextIdx = (segIdx + 1) % ADVENTURE_PATH.length;

    const p0 = ADVENTURE_PATH[segIdx];
    const p1 = ADVENTURE_PATH[nextIdx];

    const dist = Math.hypot(p1.x - p0.x, p1.z - p0.z, p1.y - p0.y) || 1;
    const step = (dt * speed) / dist;

    segmentProgressRef.current += step;

    if (segmentProgressRef.current >= 1) {
      segmentProgressRef.current = 0;
      currentSegmentRef.current = nextIdx;
      if (p1.pause > 0) {
        pauseTimerRef.current = p1.pause;
      }
    }

    const t = Math.min(1, Math.max(0, segmentProgressRef.current));
    // Smooth cosine interpolation between waypoints
    const smoothT = 0.5 - 0.5 * Math.cos(t * Math.PI);

    const curX = p0.x + (p1.x - p0.x) * smoothT;
    const curY = p0.y + (p1.y - p0.y) * smoothT;
    const curZ = p0.z + (p1.z - p0.z) * smoothT;

    rootRef.current.position.set(curX, curY, curZ);

    // Compute heading direction
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    if (Math.hypot(dx, dz) > 0.01) {
      const targetHeading = Math.atan2(dx, dz);
      // Smooth rotation toward target heading
      let diff = targetHeading - rootRef.current.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      rootRef.current.rotation.y += diff * Math.min(1, dt * 8);
    }

    // Dynamic trot walk cycle
    const walkClock = Date.now() * 0.009;
    const trot = Math.sin(walkClock * 7);

    // 4 paws rhythmic swinging
    if (legFLRef.current) legFLRef.current.rotation.x = trot * 0.55;
    if (legFRRef.current) legFRRef.current.rotation.x = -trot * 0.55;
    if (legBLRef.current) legBLRef.current.rotation.x = -trot * 0.55;
    if (legBRRef.current) legBRRef.current.rotation.x = trot * 0.55;

    // Tail wagging happily
    if (tailRef.current) {
      tailRef.current.rotation.y = Math.sin(walkClock * 16) * (pet.isDirty ? 0.45 : 0.75);
      tailRef.current.rotation.z = Math.cos(walkClock * 16) * 0.15;
    }

    // Floppy ears bouncing with momentum
    if (earLRef.current) earLRef.current.rotation.z = 0.4 + Math.sin(walkClock * 7) * 0.12;
    if (earRRef.current) earRRef.current.rotation.z = -0.4 - Math.sin(walkClock * 7) * 0.12;

    // Head and body bounce
    if (headRef.current) headRef.current.rotation.x = Math.abs(trot) * 0.08 - 0.04;
    if (bodyRef.current) bodyRef.current.position.y = 0.28 + Math.abs(trot) * 0.035;
  });

  const isDirty = pet.cleanliness < 60;
  const furMain = isDirty ? '#c6843e' : '#f5a65b';
  const furBib = isDirty ? '#dfcaa8' : '#fff7ed';
  const earColor = isDirty ? '#9e5a1b' : '#c96f24';

  return (
    <group ref={rootRef} {...openProp}>
      {/* Invisible larger click hit target */}
      <mesh position={[0, 0.4, 0]} visible={false}>
        <sphereGeometry args={[0.7, 8, 8]} />
      </mesh>

      {/* Main Dog Body Group with organic rounded proportions */}
      <group ref={bodyRef} position={[0, 0.28, 0]}>
        {/* Plump, rounded torso (capsule shape) */}
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.24, 0.56, 18]} />
          <meshStandardMaterial color={furMain} roughness={0.65} />
        </mesh>
        <mesh position={[0, 0, 0.28]} castShadow>
          <sphereGeometry args={[0.22, 16, 14]} />
          <meshStandardMaterial color={furMain} roughness={0.65} />
        </mesh>
        <mesh position={[0, 0, -0.28]} castShadow>
          <sphereGeometry args={[0.22, 16, 14]} />
          <meshStandardMaterial color={furMain} roughness={0.65} />
        </mesh>

        {/* Fluffy Cream Chest Bib */}
        <mesh position={[0, -0.04, 0.18]}>
          <sphereGeometry args={[0.18, 14, 12]} />
          <meshStandardMaterial color={furBib} roughness={0.75} />
        </mesh>

        {/* Mud splatters on coat when dirty */}
        {isDirty && (
          <group>
            <mesh position={[0.18, 0.06, 0.06]}>
              <sphereGeometry args={[0.065, 8, 8]} />
              <meshStandardMaterial color="#4a2a12" roughness={0.9} />
            </mesh>
            <mesh position={[-0.18, -0.02, -0.1]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshStandardMaterial color="#543015" roughness={0.9} />
            </mesh>
            <mesh position={[0.08, 0.18, -0.08]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color="#4a2a12" roughness={0.9} />
            </mesh>
          </group>
        )}

        {/* Glossy Red Collar with Shiny Gold Medallion */}
        <mesh position={[0, 0.12, 0.26]} rotation={[0.2, 0, 0]}>
          <torusGeometry args={[0.22, 0.035, 10, 24]} />
          <meshStandardMaterial color="#ef4444" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.04, 0.32]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.85} roughness={0.2} />
        </mesh>

        {/* Adorable Rounded Puppy Head */}
        <group ref={headRef} position={[0, 0.26, 0.36]}>
          {/* Main Skull Sphere */}
          <mesh castShadow position={[0, 0, 0]}>
            <sphereGeometry args={[0.26, 20, 18]} />
            <meshStandardMaterial color={furMain} roughness={0.65} />
          </mesh>

          {/* Chubby Cute Puppy Cheeks */}
          <mesh position={[-0.14, -0.06, 0.08]}>
            <sphereGeometry args={[0.12, 14, 12]} />
            <meshStandardMaterial color={furBib} roughness={0.7} />
          </mesh>
          <mesh position={[0.14, -0.06, 0.08]}>
            <sphereGeometry args={[0.12, 14, 12]} />
            <meshStandardMaterial color={furBib} roughness={0.7} />
          </mesh>

          {/* Rosy Cheeks Blush */}
          <mesh position={[-0.16, -0.05, 0.14]}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial color="#ff758f" roughness={0.6} />
          </mesh>
          <mesh position={[0.16, -0.05, 0.14]}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial color="#ff758f" roughness={0.6} />
          </mesh>

          {/* Cute Soft Rounded Muzzle / Snout */}
          <mesh position={[0, -0.07, 0.2]}>
            <sphereGeometry args={[0.13, 16, 14]} />
            <meshStandardMaterial color={furBib} roughness={0.75} />
          </mesh>

          {/* Glossy Black Button Nose */}
          <mesh position={[0, -0.02, 0.3]}>
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshStandardMaterial color="#111111" roughness={0.2} />
          </mesh>
          {/* Nose shine reflection catchlight */}
          <mesh position={[0.012, 0.005, 0.335]}>
            <sphereGeometry args={[0.012, 6, 6]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>

          {/* Big Glossy Puppy Eyes with Dual Catchlights */}
          {[-0.11, 0.11].map((x, i) => (
            <group key={i} position={[x, 0.05, 0.2]}>
              <mesh>
                <sphereGeometry args={[0.046, 14, 14]} />
                <meshStandardMaterial color="#18181b" roughness={0.1} />
              </mesh>
              {/* Primary large catchlight */}
              <mesh position={[0.014, 0.016, 0.04]}>
                <sphereGeometry args={[0.016, 8, 8]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              {/* Secondary soft twinkle catchlight */}
              <mesh position={[-0.012, -0.012, 0.04]}>
                <sphereGeometry args={[0.008, 6, 6]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}

          {/* Soft Floppy Puppy Ears with Spring Bounce */}
          <group ref={earLRef} position={[-0.2, 0.1, -0.02]} rotation={[0.25, 0, 0.4]}>
            <mesh position={[0, -0.14, 0]}>
              <cylinderGeometry args={[0.06, 0.1, 0.28, 12]} />
              <meshStandardMaterial color={earColor} roughness={0.75} />
            </mesh>
          </group>
          <group ref={earRRef} position={[0.2, 0.1, -0.02]} rotation={[0.25, 0, -0.4]}>
            <mesh position={[0, -0.14, 0]}>
              <cylinderGeometry args={[0.06, 0.1, 0.28, 12]} />
              <meshStandardMaterial color={earColor} roughness={0.75} />
            </mesh>
          </group>

          {/* Little Pink Puppy Tongue (panting happily when clean) */}
          {!isDirty && (
            <mesh position={[0, -0.15, 0.25]} rotation={[0.45, 0, 0]}>
              <boxGeometry args={[0.075, 0.02, 0.1]} />
              <meshStandardMaterial color="#f43f5e" roughness={0.5} />
            </mesh>
          )}

          {/* Cheek mud blob if dirty */}
          {isDirty && (
            <mesh position={[0.16, -0.05, 0.16]}>
              <sphereGeometry args={[0.04, 6, 6]} />
              <meshStandardMaterial color="#4a2a12" roughness={0.9} />
            </mesh>
          )}
        </group>

        {/* Fluffy Curly Wagging Tail with White Tip */}
        <group ref={tailRef} position={[0, 0.14, -0.32]} rotation={[0.65, 0, 0]}>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 0.24, 10]} />
            <meshStandardMaterial color={furMain} roughness={0.65} />
          </mesh>
          <mesh position={[0, 0.26, 0]}>
            <sphereGeometry args={[0.075, 10, 10]} />
            <meshStandardMaterial color="#ffffff" roughness={0.75} />
          </mesh>
        </group>
      </group>

      {/* 4 Chubby Puppy Paws with White Socks */}
      {/* Front Left */}
      <group ref={legFLRef} position={[-0.14, 0.14, 0.2]}>
        <mesh position={[0, -0.07, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.075, 0.16, 12]} />
          <meshStandardMaterial color={isDirty ? '#a86524' : furBib} roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.14, 0.02]}>
          <sphereGeometry args={[0.065, 10, 10]} />
          <meshStandardMaterial color={isDirty ? '#8f4f16' : '#ffffff'} roughness={0.8} />
        </mesh>
      </group>

      {/* Front Right */}
      <group ref={legFRRef} position={[0.14, 0.14, 0.2]}>
        <mesh position={[0, -0.07, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.075, 0.16, 12]} />
          <meshStandardMaterial color={isDirty ? '#a86524' : furBib} roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.14, 0.02]}>
          <sphereGeometry args={[0.065, 10, 10]} />
          <meshStandardMaterial color={isDirty ? '#8f4f16' : '#ffffff'} roughness={0.8} />
        </mesh>
      </group>

      {/* Back Left */}
      <group ref={legBLRef} position={[-0.14, 0.14, -0.2]}>
        <mesh position={[0, -0.07, 0]} castShadow>
          <cylinderGeometry args={[0.065, 0.075, 0.16, 12]} />
          <meshStandardMaterial color={isDirty ? '#a86524' : furMain} roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.14, 0.02]}>
          <sphereGeometry args={[0.065, 10, 10]} />
          <meshStandardMaterial color={isDirty ? '#8f4f16' : furMain} roughness={0.8} />
        </mesh>
      </group>

      {/* Back Right */}
      <group ref={legBRRef} position={[0.14, 0.14, -0.2]}>
        <mesh position={[0, -0.07, 0]} castShadow>
          <cylinderGeometry args={[0.065, 0.075, 0.16, 12]} />
          <meshStandardMaterial color={isDirty ? '#a86524' : furMain} roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.14, 0.02]}>
          <sphereGeometry args={[0.065, 10, 10]} />
          <meshStandardMaterial color={isDirty ? '#8f4f16' : furMain} roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}
