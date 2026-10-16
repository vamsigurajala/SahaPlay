import React, { useRef, useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useOpenProp } from './parts';
import { dogState } from './dogState';

// A cute, low-poly animated 3D dog that trots happily around the pond on the lawn.
// Tracks cleanliness and accumulates mud patches over time until bathed and dried.
export default function DogPet3D({ pathCenter = [10.5, 0, 8.2], rx = 3.6, rz = 2.6, speed = 0.35 }) {
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

  // Progress angle along the elliptical patrol path around the pond
  const progressRef = useRef(0);
  const pauseTimerRef = useRef(0);

  useFrame((_, delta) => {
    if (!rootRef.current) return;
    const dt = Math.min(delta, 0.1);

    // Natural pauses: every full lap, dog pauses briefly to sniff and wag tail
    if (pauseTimerRef.current > 0) {
      pauseTimerRef.current -= dt;
      // Idle tail wag while sniffing
      if (tailRef.current) tailRef.current.rotation.y = Math.sin(Date.now() * 0.01) * 0.6;
      if (headRef.current) headRef.current.rotation.x = Math.sin(Date.now() * 0.003) * 0.15;
      return;
    }

    progressRef.current += dt * speed;
    if (progressRef.current >= Math.PI * 2) {
      progressRef.current -= Math.PI * 2;
      pauseTimerRef.current = 1.8; // pause for 1.8 seconds
    }

    const angle = progressRef.current;
    // Calculate position along elliptical path
    const px = pathCenter[0] + Math.cos(angle) * rx;
    const pz = pathCenter[2] + Math.sin(angle) * rz;

    // Heading direction
    const nextAngle = angle + 0.05;
    const nx = pathCenter[0] + Math.cos(nextAngle) * rx;
    const nz = pathCenter[2] + Math.sin(nextAngle) * rz;
    const heading = Math.atan2(nx - px, nz - pz);

    rootRef.current.position.set(px, pathCenter[1], pz);
    rootRef.current.rotation.y = heading;

    // Trot walk cycle
    const walkClock = Date.now() * 0.007;
    const trot = Math.sin(walkClock * 6);

    // Legs swinging
    if (legFLRef.current) legFLRef.current.rotation.x = trot * 0.5;
    if (legFRRef.current) legFRRef.current.rotation.x = -trot * 0.5;
    if (legBLRef.current) legBLRef.current.rotation.x = -trot * 0.5;
    if (legBRRef.current) legBRRef.current.rotation.x = trot * 0.5;

    // Tail wagging happily
    if (tailRef.current) {
      tailRef.current.rotation.y = Math.sin(walkClock * 14) * (pet.isDirty ? 0.35 : 0.65);
      tailRef.current.rotation.z = Math.cos(walkClock * 14) * 0.12;
    }

    // Gentle head & body bob
    if (headRef.current) {
      headRef.current.rotation.x = Math.abs(trot) * 0.08 - 0.05;
    }
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.34 + Math.abs(trot) * 0.03;
    }
  });

  const isDirty = pet.cleanliness < 60;
  const coatColor = isDirty ? '#c88540' : '#e59a4c';
  const bellyColor = isDirty ? '#dfcaa8' : '#fff4e3';

  return (
    <group ref={rootRef} {...openProp}>
      {/* Clickable bounding trigger */}
      <mesh position={[0, 0.45, 0]} visible={false}>
        <boxGeometry args={[0.9, 0.9, 1.4]} />
      </mesh>

      {/* Main Dog Body Group */}
      <group ref={bodyRef} position={[0, 0.34, 0]}>
        {/* Torso */}
        <mesh castShadow position={[0, 0, 0]}>
          <boxGeometry args={[0.38, 0.34, 0.68]} />
          <meshStandardMaterial color={coatColor} roughness={0.7} />
        </mesh>

        {/* Fluffy Chest / Bib */}
        <mesh position={[0, -0.02, 0.18]}>
          <boxGeometry args={[0.32, 0.28, 0.34]} />
          <meshStandardMaterial color={bellyColor} roughness={0.8} />
        </mesh>

        {/* Mud spots on body when dirty */}
        {isDirty && (
          <group>
            <mesh position={[0.195, 0.04, 0.08]}>
              <sphereGeometry args={[0.07, 8, 8]} />
              <meshStandardMaterial color="#4a2a12" roughness={0.9} />
            </mesh>
            <mesh position={[-0.195, -0.02, -0.12]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshStandardMaterial color="#543015" roughness={0.9} />
            </mesh>
            <mesh position={[0.12, 0.17, -0.1]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color="#4a2a12" roughness={0.9} />
            </mesh>
          </group>
        )}

        {/* Collar with gold medallion */}
        <mesh position={[0, 0.13, 0.29]}>
          <boxGeometry args={[0.4, 0.06, 0.1]} />
          <meshStandardMaterial color="#e63946" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.06, 0.34]}>
          <cylinderGeometry args={[0.04, 0.04, 0.02, 12]} />
          <meshStandardMaterial color="#ffd700" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Cute Dog Head */}
        <group ref={headRef} position={[0, 0.24, 0.36]}>
          <mesh castShadow position={[0, 0, 0]}>
            <boxGeometry args={[0.36, 0.32, 0.36]} />
            <meshStandardMaterial color={coatColor} roughness={0.7} />
          </mesh>

          {/* Cute Muzzle / Snout */}
          <mesh position={[0, -0.06, 0.21]}>
            <boxGeometry args={[0.22, 0.16, 0.16]} />
            <meshStandardMaterial color={bellyColor} roughness={0.75} />
          </mesh>

          {/* Black Button Nose */}
          <mesh position={[0, -0.01, 0.29]}>
            <boxGeometry args={[0.08, 0.06, 0.04]} />
            <meshStandardMaterial color="#111111" roughness={0.3} />
          </mesh>

          {/* Puppy Eyes */}
          {[-0.1, 0.1].map((x, i) => (
            <group key={i} position={[x, 0.06, 0.18]}>
              <mesh>
                <sphereGeometry args={[0.04, 10, 10]} />
                <meshStandardMaterial color="#1a1412" roughness={0.1} />
              </mesh>
              {/* Eye sparkle highlight */}
              <mesh position={[0.015, 0.015, 0.035]}>
                <sphereGeometry args={[0.012, 6, 6]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}

          {/* Floppy Puppy Ears */}
          <group ref={earLRef} position={[-0.19, 0.1, -0.02]} rotation={[0.2, 0, 0.4]}>
            <mesh position={[0, -0.12, 0]}>
              <boxGeometry args={[0.08, 0.26, 0.16]} />
              <meshStandardMaterial color="#b36c28" roughness={0.8} />
            </mesh>
          </group>
          <group ref={earRRef} position={[0.19, 0.1, -0.02]} rotation={[0.2, 0, -0.4]}>
            <mesh position={[0, -0.12, 0]}>
              <boxGeometry args={[0.08, 0.26, 0.16]} />
              <meshStandardMaterial color="#b36c28" roughness={0.8} />
            </mesh>
          </group>

          {/* Little pink tongue panting when happy */}
          {!isDirty && (
            <mesh position={[0, -0.14, 0.26]} rotation={[0.4, 0, 0]}>
              <boxGeometry args={[0.07, 0.02, 0.1]} />
              <meshStandardMaterial color="#ff758f" roughness={0.5} />
            </mesh>
          )}

          {/* Mud splat on cheek if dirty */}
          {isDirty && (
            <mesh position={[0.16, -0.04, 0.14]}>
              <sphereGeometry args={[0.04, 6, 6]} />
              <meshStandardMaterial color="#4a2a12" roughness={0.9} />
            </mesh>
          )}
        </group>

        {/* Tail (wagging) */}
        <group ref={tailRef} position={[0, 0.12, -0.34]} rotation={[0.6, 0, 0]}>
          <mesh position={[0, 0.14, 0]}>
            <boxGeometry args={[0.08, 0.28, 0.08]} />
            <meshStandardMaterial color={coatColor} roughness={0.7} />
          </mesh>
          {/* White tail tip */}
          <mesh position={[0, 0.28, 0]}>
            <boxGeometry args={[0.08, 0.08, 0.08]} />
            <meshStandardMaterial color="#ffffff" roughness={0.8} />
          </mesh>
        </group>
      </group>

      {/* 4 Paws / Legs */}
      {/* Front Left */}
      <group ref={legFLRef} position={[-0.14, 0.18, 0.22]}>
        <mesh position={[0, -0.09, 0]} castShadow>
          <boxGeometry args={[0.09, 0.18, 0.09]} />
          <meshStandardMaterial color={isDirty ? '#a8652b' : bellyColor} roughness={0.8} />
        </mesh>
      </group>
      {/* Front Right */}
      <group ref={legFRRef} position={[0.14, 0.18, 0.22]}>
        <mesh position={[0, -0.09, 0]} castShadow>
          <boxGeometry args={[0.09, 0.18, 0.09]} />
          <meshStandardMaterial color={isDirty ? '#a8652b' : bellyColor} roughness={0.8} />
        </mesh>
      </group>
      {/* Back Left */}
      <group ref={legBLRef} position={[-0.14, 0.18, -0.22]}>
        <mesh position={[0, -0.09, 0]} castShadow>
          <boxGeometry args={[0.09, 0.18, 0.09]} />
          <meshStandardMaterial color={isDirty ? '#a8652b' : coatColor} roughness={0.8} />
        </mesh>
      </group>
      {/* Back Right */}
      <group ref={legBRRef} position={[0.14, 0.18, -0.22]}>
        <mesh position={[0, -0.09, 0]} castShadow>
          <boxGeometry args={[0.09, 0.18, 0.09]} />
          <meshStandardMaterial color={isDirty ? '#a8652b' : coatColor} roughness={0.8} />
        </mesh>
      </group>

      {/* Cute Interactive Name & Status Pill above Dog */}
      <Html position={[0, 0.95, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 9px',
            borderRadius: 99,
            background: isDirty ? 'rgba(74, 42, 18, 0.88)' : 'rgba(18, 14, 34, 0.85)',
            border: isDirty ? '1px solid rgba(255, 170, 80, 0.6)' : '1px solid rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(6px)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.02em',
            boxShadow: isDirty ? '0 4px 12px rgba(120, 60, 20, 0.5)' : '0 4px 12px rgba(0,0,0,0.4)',
            whiteSpace: 'nowrap',
            transform: 'scale(1)',
            transition: 'all 0.3s ease',
          }}
        >
          <span style={{ fontSize: 12 }}>{isDirty ? '🐾' : '🐶'}</span>
          <span>{pet.name}</span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: 6,
              background: isDirty ? '#f97316' : '#10b981',
              color: '#fff',
              marginLeft: 2,
            }}
          >
            {isDirty ? 'Bath Me' : 'Clean'}
          </span>
        </div>
      </Html>
    </group>
  );
}
