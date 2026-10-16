import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import {
  X, Gauge, Play, RotateCcw, Volume2, VolumeX, Eye, Sparkles,
  Zap, Disc, Key, Shield, ArrowRight, Check, Compass, Sliders,
  Radio, Activity, ChevronRight
} from 'lucide-react';

const PI = Math.PI;

// ============================================================================
// AUTHENTIC V8/V12 SUPERCAR AUDIO SYNTHESIZER (Web Audio API)
// ============================================================================

class SupercarSoundEngine {
  constructor() {
    this.ctx = null;
    this.oscLow = null;
    this.oscMid = null;
    this.oscHigh = null;
    this.gainNode = null;
    this.filterNode = null;
    this.distortionNode = null;
    this.isPlaying = false;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
    } catch (e) {
      console.warn('AudioContext not supported', e);
    }
  }

  start(driveMode = 'SPORT') {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.isPlaying) return;

    const t = this.ctx.currentTime;

    // Sub-bass rumble (V8 cylinder pulses)
    this.oscLow = this.ctx.createOscillator();
    this.oscLow.type = 'sawtooth';
    this.oscLow.frequency.setValueAtTime(42, t);

    // Mid exhaust tone
    this.oscMid = this.ctx.createOscillator();
    this.oscMid.type = 'triangle';
    this.oscMid.frequency.setValueAtTime(84, t);

    // High twin-turbo whine
    this.oscHigh = this.ctx.createOscillator();
    this.oscHigh.type = 'sine';
    this.oscHigh.frequency.setValueAtTime(168, t);

    // Lowpass filter for exhaust resonance
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(driveMode === 'CORSA' ? 440 : 340, t);
    this.filterNode.Q.setValueAtTime(3.2, t);

    // Master gain
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(0.08, t);

    this.oscLow.connect(this.filterNode);
    this.oscMid.connect(this.filterNode);
    this.oscHigh.connect(this.filterNode);
    this.filterNode.connect(this.gainNode);
    this.gainNode.connect(this.ctx.destination);

    this.oscLow.start();
    this.oscMid.start();
    this.oscHigh.start();
    this.isPlaying = true;
  }

  setRpm(rpm, driveMode = 'SPORT') {
    if (!this.isPlaying || !this.ctx) return;
    const norm = Math.min(1, Math.max(0, (rpm - 800) / 8200));
    const now = this.ctx.currentTime;

    const baseFreq = driveMode === 'CORSA' ? 46 : 40;
    const targetLow = baseFreq + norm * 260;
    const targetMid = baseFreq * 2 + norm * 520;
    const targetHigh = baseFreq * 4 + norm * 1100;
    const filterFreq = 340 + norm * 2600 + (driveMode === 'CORSA' ? 300 : 0);
    const targetGain = 0.08 + norm * 0.22;

    this.oscLow.frequency.setTargetAtTime(targetLow, now, 0.03);
    this.oscMid.frequency.setTargetAtTime(targetMid, now, 0.03);
    this.oscHigh.frequency.setTargetAtTime(targetHigh, now, 0.03);
    this.filterNode.frequency.setTargetAtTime(filterFreq, now, 0.03);
    this.gainNode.gain.setTargetAtTime(targetGain, now, 0.03);
  }

  stop() {
    if (!this.isPlaying) return;
    try {
      this.oscLow?.stop();
      this.oscMid?.stop();
      this.oscHigh?.stop();
      this.oscLow?.disconnect();
      this.oscMid?.disconnect();
      this.oscHigh?.disconnect();
    } catch {}
    this.isPlaying = false;
  }
}

const supercarAudio = new SupercarSoundEngine();

// ============================================================================
// ULTRA-HIGH-END 3D SUPERCAR COCKPIT & SHOWROOM MODEL
// ============================================================================

function HighEndSupercar3D({
  rpm,
  speed,
  isStarted,
  lightsOn,
  doorsOpen,
  exteriorColor,
  cameraView,
  driveMode,
  gear
}) {
  const steeringRef = useRef();
  const needleRef = useRef();
  const rpmRatio = Math.min(1, Math.max(0, (rpm - 800) / 8200));

  useFrame((state) => {
    // Engine idle rumble vibration on steering wheel
    if (steeringRef.current && isStarted) {
      const vibIntensity = driveMode === 'CORSA' ? 0.0018 : 0.0009;
      steeringRef.current.position.y = 0.76 + Math.sin(state.clock.elapsedTime * 48) * vibIntensity;
      steeringRef.current.position.x = -0.38 + Math.cos(state.clock.elapsedTime * 42) * (vibIntensity * 0.5);
    }
    // Tachometer needle sweep animation
    if (needleRef.current) {
      const targetAngle = -1.25 + rpmRatio * 2.5;
      needleRef.current.rotation.z = targetAngle;
    }
  });

  const clusterAccentColor = driveMode === 'CORSA' ? '#ef4444' : driveMode === 'SPORT' ? '#f59e0b' : '#38bdf8';

  return (
    <group position={[0, 0, 0]}>
      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 1. SCULPTED BI-LEVEL ALCANTARA DASHBOARD & AIR CONDITIONING TURBINES */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <group position={[0, 0.74, -0.62]}>
        {/* Main Upper Dashboard Arch (Curved Alcantara) */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.82, 0.38, 0.94]} />
          <meshStandardMaterial color="#18181b" roughness={0.88} />
        </mesh>
        {/* Lower Dash Fascia (Matte Carbon Fiber) */}
        <mesh position={[0, -0.16, 0.22]}>
          <boxGeometry args={[1.78, 0.16, 0.52]} />
          <meshStandardMaterial color="#27272a" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Contrast Rosso Corsa Twin Stitching Line */}
        <mesh position={[0, 0.192, 0.14]}>
          <boxGeometry args={[1.74, 0.006, 0.02]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        {/* Defrost Vent Grille along Windshield Base */}
        <mesh position={[0, 0.19, -0.38]}>
          <boxGeometry args={[1.62, 0.01, 0.08]} />
          <meshStandardMaterial color="#09090b" roughness={0.9} />
        </mesh>

        {/* Passenger Dash Side: Polished Silver "SF90 STRADALE" Metal Badge */}
        <group position={[0.45, 0.05, 0.46]}>
          <mesh>
            <boxGeometry args={[0.34, 0.035, 0.015]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.15} />
          </mesh>
          <mesh position={[0, 0, 0.009]}>
            <boxGeometry args={[0.3, 0.018, 0.002]} />
            <meshBasicMaterial color="#09090b" />
          </mesh>
        </group>

        {/* 4 Circular Turbine Air Conditioning Vents with Chrome Bezels */}
        {[-0.78, -0.16, 0.16, 0.78].map((vx, i) => (
          <group key={i} position={[vx, 0.06, 0.47]}>
            {/* Outer Polished Chrome Ring */}
            <mesh rotation={[PI / 2, 0, 0]}>
              <torusGeometry args={[0.048, 0.009, 10, 24]} />
              <meshStandardMaterial color="#f8fafc" metalness={0.95} roughness={0.15} />
            </mesh>
            {/* Inner Black Housing */}
            <mesh>
              <cylinderGeometry args={[0.042, 0.042, 0.03, 16]} />
              <meshStandardMaterial color="#09090b" />
            </mesh>
            {/* Directional Cross-Vane Louvers */}
            <mesh rotation={[0, 0, 0.4]}>
              <boxGeometry args={[0.076, 0.008, 0.02]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.8} />
            </mesh>
            <mesh rotation={[0, 0, -0.4]}>
              <boxGeometry args={[0.008, 0.076, 0.02]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.8} />
            </mesh>
          </group>
        ))}

        {/* Climate Control Digital Display & Hazard Flasher Switch */}
        <group position={[0, -0.06, 0.47]}>
          <mesh>
            <boxGeometry args={[0.22, 0.06, 0.02]} />
            <meshStandardMaterial color="#09090b" />
          </mesh>
          <mesh position={[0, 0, 0.012]}>
            <planeGeometry args={[0.18, 0.045]} />
            <meshBasicMaterial color={isStarted ? '#38bdf8' : '#1e293b'} />
          </mesh>
          {/* Red Hazard Triangle Button */}
          <mesh position={[0, 0.045, 0.01]}>
            <cylinderGeometry args={[0.018, 0.018, 0.012, 12]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.6} />
          </mesh>
        </group>
      </group>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 2. CURVED DIGITAL INSTRUMENT BINNACLE & DYNAMIC TACHOMETER */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <group position={[-0.38, 0.82, -0.44]} rotation={[-0.32, 0, 0]}>
        {/* Hooded Cowl in Carbon Fiber & Leather */}
        <mesh position={[0, 0.14, -0.06]} castShadow>
          <boxGeometry args={[0.62, 0.12, 0.28]} />
          <meshStandardMaterial color="#27272a" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Curved Primary LCD Cluster Panel */}
        <mesh>
          <planeGeometry args={[0.56, 0.24]} />
          <meshBasicMaterial color={isStarted ? '#09090b' : '#18181b'} />
        </mesh>

        {/* Glowing Central Tachometer Dial Ring */}
        <mesh position={[0, 0, 0.006]}>
          <ringGeometry args={[0.078, 0.092, 36, 1, 0.4, 4.4]} />
          <meshBasicMaterial
            color={isStarted ? (rpm > 7800 ? '#ef4444' : clusterAccentColor) : '#334155'}
            toneMapped={false}
          />
        </mesh>
        {/* Redline Gauge Arc (8,000 to 8,500 RPM) */}
        <mesh position={[0, 0, 0.007]}>
          <ringGeometry args={[0.078, 0.094, 16, 1, 3.8, 1.0]} />
          <meshBasicMaterial color={isStarted ? '#ef4444' : '#450a0a'} toneMapped={false} />
        </mesh>

        {/* Live Sweeping Tachometer Needle */}
        <group ref={needleRef} position={[0, 0, 0.012]}>
          <mesh position={[0, 0.042, 0]}>
            <boxGeometry args={[0.006, 0.084, 0.002]} />
            <meshBasicMaterial color="#ef4444" toneMapped={false} />
          </mesh>
          <mesh>
            <circleGeometry args={[0.014, 16]} />
            <meshStandardMaterial color="#f8fafc" metalness={0.9} />
          </mesh>
        </group>

        {/* Left Sub-Screen: G-Force Telemetry & Hybrid Battery Level */}
        <group position={[-0.2, 0, 0.005]}>
          <mesh>
            <planeGeometry args={[0.12, 0.18]} />
            <meshBasicMaterial color={isStarted ? '#0f172a' : '#09090b'} />
          </mesh>
          <mesh position={[0, -0.04, 0.002]}>
            <boxGeometry args={[0.08, 0.018, 0.002]} />
            <meshBasicMaterial color={isStarted ? '#22c55e' : '#334155'} />
          </mesh>
        </group>

        {/* Right Sub-Screen: Digital Speed & Turbo Boost PSI */}
        <group position={[0.2, 0, 0.005]}>
          <mesh>
            <planeGeometry args={[0.12, 0.18]} />
            <meshBasicMaterial color={isStarted ? '#0f172a' : '#09090b'} />
          </mesh>
          <mesh position={[0, -0.04, 0.002]}>
            <boxGeometry args={[0.08, 0.018, 0.002]} />
            <meshBasicMaterial color={isStarted ? clusterAccentColor : '#334155'} />
          </mesh>
        </group>
      </group>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 3. F1 CARBON FIBER STEERING WHEEL WITH SHIFT LIGHTS & MANETTINO */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <group ref={steeringRef} position={[-0.38, 0.76, -0.21]} rotation={[-0.34, 0, 0]}>
        {/* Flat-Bottom & Flat-Top Racing Steering Rim */}
        <mesh rotation={[PI / 2, 0, 0]}>
          <torusGeometry args={[0.21, 0.026, 16, 40]} />
          <meshStandardMaterial color="#18181b" roughness={0.7} />
        </mesh>
        {/* 12 o'clock Italian Red Center Alignment Stripe */}
        <mesh position={[0, 0.21, 0]} rotation={[PI / 2, 0, 0]}>
          <torusGeometry args={[0.21, 0.028, 12, 8, 0.28]} />
          <meshStandardMaterial color="#ef4444" roughness={0.2} />
        </mesh>

        {/* Carbon Fiber 3-Spoke Center Hub Boss */}
        <mesh position={[0, 0, -0.01]}>
          <cylinderGeometry args={[0.075, 0.075, 0.03, 20]} />
          <meshStandardMaterial color="#09090b" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Raised Prancing Shield Logo in Gold / Enamel */}
        <mesh position={[0, 0, 0.016]}>
          <sphereGeometry args={[0.028, 14, 12]} />
          <meshStandardMaterial color="#eab308" metalness={0.95} roughness={0.15} />
        </mesh>

        {/* 5-LED Sequential Shift Light Bar on Top Steering Rim */}
        <group position={[0, 0.176, 0.012]}>
          {[-0.08, -0.04, 0, 0.04, 0.08].map((lx, idx) => {
            const lit = isStarted && rpmRatio > (idx + 1) * 0.18;
            const col = idx < 2 ? '#22c55e' : idx < 4 ? '#eab308' : '#ef4444';
            return (
              <mesh key={idx} position={[lx, 0, 0]}>
                <sphereGeometry args={[0.013, 10, 10]} />
                <meshBasicMaterial color={lit ? col : '#27272a'} toneMapped={false} />
              </mesh>
            );
          })}
        </group>

        {/* Red Anodized 'Manettino' Rotary Drive Mode Switch (Lower Right) */}
        <group position={[0.065, -0.065, 0.015]} rotation={[0, 0, driveMode === 'CORSA' ? 0.8 : driveMode === 'SPORT' ? 0 : -0.8]}>
          <mesh>
            <cylinderGeometry args={[0.022, 0.022, 0.018, 12]} />
            <meshStandardMaterial color="#dc2626" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.016, 0]}>
            <boxGeometry args={[0.006, 0.014, 0.02]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>

        {/* Engine START / STOP Push Button (Lower Left Spoke) */}
        <group position={[-0.065, -0.065, 0.015]}>
          <mesh>
            <cylinderGeometry args={[0.022, 0.022, 0.016, 16]} />
            <meshStandardMaterial color="#09090b" metalness={0.8} />
          </mesh>
          <mesh position={[0, 0, 0.008]}>
            <circleGeometry args={[0.016, 16]} />
            <meshStandardMaterial
              color="#ef4444"
              emissive={isStarted ? '#ef4444' : '#7f1d1d'}
              emissiveIntensity={isStarted ? 1.4 : 0.3}
            />
          </mesh>
        </group>

        {/* Extended Milled Aluminum Paddle Shifters behind Wheel (+ and -) */}
        {[-0.24, 0.24].map((px, i) => (
          <group key={i} position={[px, 0.08, -0.045]} rotation={[0, 0, i === 0 ? 0.16 : -0.16]}>
            <mesh>
              <boxGeometry args={[0.026, 0.19, 0.008]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.15} />
            </mesh>
            <mesh position={[0, 0.07, 0.005]}>
              <boxGeometry args={[0.012, 0.012, 0.002]} />
              <meshBasicMaterial color="#ef4444" />
            </mesh>
          </group>
        ))}

        {/* Steering Column with Indicator Stalks */}
        <mesh position={[0, 0, -0.12]} rotation={[PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.055, 0.22, 16]} />
          <meshStandardMaterial color="#18181b" roughness={0.8} />
        </mesh>
      </group>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 4. SCULPTED FLOATING CARBON CENTER CONSOLE BRIDGE */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <group position={[0, 0.38, 0.08]}>
        {/* Main Floating Bridge Structure */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.38, 0.5, 1.45]} />
          <meshStandardMaterial color="#18181b" roughness={0.7} metalness={0.4} />
        </mesh>
        {/* Open Pass-Through Storage Cavity Underneath */}
        <mesh position={[0, -0.18, 0.1]}>
          <boxGeometry args={[0.39, 0.18, 0.7]} />
          <meshStandardMaterial color="#09090b" />
        </mesh>

        {/* Slanted Secondary Vertical Infotainment Touchscreen */}
        <group position={[0, 0.38, -0.42]} rotation={[-0.45, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.32, 0.28, 0.02]} />
            <meshStandardMaterial color="#09090b" metalness={0.8} />
          </mesh>
          {/* Live Navigation & Vehicle Telemetry Graphic */}
          <mesh position={[0, 0, 0.013]}>
            <planeGeometry args={[0.29, 0.25]} />
            <meshBasicMaterial color={isStarted ? '#0369a1' : '#0f172a'} />
          </mesh>
        </group>

        {/* Classic Gated Metal Transmission Toggles: [ R ] [ AUTO ] [ LC ] */}
        <group position={[0, 0.27, -0.12]}>
          <Box p={[0, 0, 0]} s={[0.24, 0.02, 0.28]} c="#334155" metal={0.9} rough={0.2} />
          {[-0.07, 0, 0.07].map((bx, i) => (
            <mesh key={i} position={[bx, 0.02, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.025, 12]} />
              <meshStandardMaterial color="#f8fafc" metalness={0.95} roughness={0.1} />
            </mesh>
          ))}
        </group>

        {/* Red Missile-Style Flip Ignition Switch Cover */}
        <group position={[0, 0.27, 0.1]}>
          <mesh position={[0, 0.015, -0.02]} rotation={[0.4, 0, 0]}>
            <boxGeometry args={[0.06, 0.04, 0.05]} />
            <meshStandardMaterial color="#dc2626" metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.01, 0.01]}>
            <cylinderGeometry args={[0.02, 0.02, 0.015, 14]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={isStarted ? 1.0 : 0.2} />
          </mesh>
        </group>

        {/* Dual Cupholders with Ambient Glow Ring */}
        <group position={[0, 0.26, 0.32]}>
          {[-0.06, 0.06].map(cz => (
            <group key={cz} position={[0, 0, cz]}>
              <mesh rotation={[PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 0.02, 14]} />
                <meshStandardMaterial color="#09090b" />
              </mesh>
              <mesh position={[0, 0.01, 0]}>
                <ringGeometry args={[0.038, 0.042, 16]} />
                <meshBasicMaterial color="#38bdf8" />
              </mesh>
            </group>
          ))}
        </group>

        {/* Padded Leather Center Armrest with Red Stitching */}
        <group position={[0, 0.3, 0.6]}>
          <Box p={[0, 0, 0]} s={[0.34, 0.1, 0.32]} c="#18181b" r={0.03} roughness={0.8} />
          <mesh position={[0, 0.052, 0]}>
            <boxGeometry args={[0.3, 0.005, 0.28]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
        </group>
      </group>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 5. DAYTONA CARBON RACING BUCKET SEATS & 4-POINT HARNESS BELTS */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {[-0.38, 0.38].map((sx, i) => (
        <group key={i} position={[sx, 0.34, 0.36]}>
          {/* Carbon Fiber Shell Backrest Exterior */}
          <mesh position={[0, 0.52, -0.28]} rotation={[0.22, 0, 0]}>
            <boxGeometry args={[0.54, 0.92, 0.08]} />
            <meshStandardMaterial color="#09090b" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Contoured Alcantara Cushion Base */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.52, 0.22, 0.62]} />
            <meshStandardMaterial color="#18181b" roughness={0.85} />
          </mesh>
          {/* Contoured Backrest Cushion */}
          <mesh position={[0, 0.5, -0.22]} rotation={[0.22, 0, 0]} castShadow>
            <boxGeometry args={[0.48, 0.88, 0.12]} />
            <meshStandardMaterial color="#18181b" roughness={0.85} />
          </mesh>
          {/* High Rosso Corsa Lateral Bolsters (Rib & Thigh Support) */}
          <mesh position={[-0.24, 0.5, -0.18]} rotation={[0.22, 0, 0]}>
            <boxGeometry args={[0.07, 0.84, 0.22]} />
            <meshStandardMaterial color="#dc2626" metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0.24, 0.5, -0.18]} rotation={[0.22, 0, 0]}>
            <boxGeometry args={[0.07, 0.84, 0.22]} />
            <meshStandardMaterial color="#dc2626" metalness={0.5} roughness={0.3} />
          </mesh>
          {/* Carbon Harness Pass-Through Cutouts on Headrest */}
          <mesh position={[0, 0.82, -0.14]}>
            <boxGeometry args={[0.2, 0.07, 0.18]} />
            <meshStandardMaterial color="#475569" metalness={0.85} />
          </mesh>
          {/* 4-Point Red Sabelt Racing Harness Straps */}
          {[-0.07, 0.07].map(hx => (
            <mesh key={hx} position={[hx, 0.58, -0.12]} rotation={[0.22, 0, 0]}>
              <boxGeometry args={[0.045, 0.48, 0.015]} />
              <meshBasicMaterial color="#dc2626" />
            </mesh>
          ))}
          {/* Central Camlock Circular Quick-Release Buckle */}
          <mesh position={[0, 0.22, 0.05]} rotation={[0.3, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.02, 14]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.95} />
          </mesh>
        </group>
      ))}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 6. INNER CARBON DOOR CARDS & DOOR SILL KICK PLATES */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* Left Driver Door Panel */}
      <group position={[-0.92, 0.72, 0.2]}>
        <Box p={[0, 0, 0]} s={[0.08, 0.74, 1.25]} c="#18181b" roughness={0.8} />
        {/* Sculpted Armrest */}
        <Box p={[0.04, -0.06, 0.05]} s={[0.06, 0.1, 0.55]} c="#27272a" r={0.02} />
        {/* Red Nylon Door Pull Loop ("RS Style") */}
        <mesh position={[0.06, 0.04, -0.08]} rotation={[0, 0, 0.2]}>
          <boxGeometry args={[0.015, 0.12, 0.03]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        {/* Speaker Grille with Perforated Texture */}
        <mesh position={[0.045, -0.22, -0.32]}>
          <circleGeometry args={[0.09, 18]} />
          <meshStandardMaterial color="#334155" metalness={0.8} />
        </mesh>
      </group>

      {/* Right Passenger Door Panel */}
      <group position={[0.92, 0.72, 0.2]}>
        <Box p={[0, 0, 0]} s={[0.08, 0.74, 1.25]} c="#18181b" roughness={0.8} />
        <Box p={[-0.04, -0.06, 0.05]} s={[0.06, 0.1, 0.55]} c="#27272a" r={0.02} />
        <mesh position={[-0.06, 0.04, -0.08]} rotation={[0, 0, -0.2]}>
          <boxGeometry args={[0.015, 0.12, 0.03]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        <mesh position={[-0.045, -0.22, -0.32]}>
          <circleGeometry args={[0.09, 18]} />
          <meshStandardMaterial color="#334155" metalness={0.8} />
        </mesh>
      </group>

      {/* Carbon Fiber Door Sills with Illuminated "STRADALE" Kick Plates */}
      {[-0.88, 0.88].map(kx => (
        <group key={kx} position={[kx, 0.24, 0.1]}>
          <Box p={[0, 0, 0]} s={[0.16, 0.06, 1.1]} c="#09090b" metal={0.85} />
          <mesh position={[0, 0.032, 0]}>
            <planeGeometry args={[0.1, 0.45]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        </group>
      ))}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 7. DRILLED ALUMINUM RACING FOOT PEDALS */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <group position={[-0.38, 0.16, -0.88]} rotation={[0.42, 0, 0]}>
        {/* Footrest Dead Pedal */}
        <Box p={[-0.14, 0, 0]} s={[0.06, 0.19, 0.012]} c="#94a3b8" metal={0.95} />
        {/* Wide Stainless Brake Pedal */}
        <Box p={[-0.03, 0, 0]} s={[0.08, 0.16, 0.012]} c="#cbd5e1" metal={0.95} />
        {/* Milled Aluminum Accelerator Pedal */}
        <Box p={[0.08, -0.02, 0]} s={[0.05, 0.18, 0.012]} c="#cbd5e1" metal={0.95} />
      </group>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 8. UPPER COCKPIT: REARVIEW MIRROR, SUN VISORS & AMBIENT STRIP */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* Frameless Interior Rearview Mirror */}
      <group position={[0, 1.08, -0.24]}>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.08, 6]} />
          <meshStandardMaterial color="#09090b" />
        </mesh>
        <Box p={[0, 0, 0]} s={[0.22, 0.065, 0.02]} c="#09090b" r={0.01} metal={0.8} />
        <mesh position={[0, 0, 0.012]}>
          <planeGeometry args={[0.2, 0.05]} />
          <meshPhysicalMaterial color="#64748b" metalness={0.95} roughness={0.1} />
        </mesh>
      </group>

      {/* Twin Sun Visors Tucked against Headliner */}
      {[-0.38, 0.38].map(vx => (
        <Box key={vx} p={[vx, 1.15, -0.28]} s={[0.38, 0.018, 0.16]} c="#18181b" roughness={0.85} />
      ))}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 9. EXTERIOR SHOWROOM CHASSIS, SCISSOR DOORS & ACTIVE AERO */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* Front Nose & Hood with Aerodynamic Air Extraction Ducts */}
      <mesh position={[0, 0.62, -1.68]} rotation={[0.2, 0, 0]} castShadow>
        <boxGeometry args={[1.78, 0.15, 1.38]} />
        <meshStandardMaterial color={exteriorColor} metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Low-Slung Carbon-Fiber Front Splitter */}
      <mesh position={[0, 0.24, -2.38]}>
        <boxGeometry args={[1.84, 0.06, 0.52]} />
        <meshStandardMaterial color="#09090b" roughness={0.3} metalness={0.85} />
      </mesh>

      {/* Tinted Panoramic Curved Windshield */}
      <mesh position={[0, 0.98, -0.32]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[1.68, 0.03, 1.12]} />
        <meshPhysicalMaterial
          color="#0f172a"
          transparent
          opacity={0.35}
          roughness={0.04}
          metalness={0.9}
        />
      </mesh>
      {/* Carbon Roof Canopy */}
      <mesh position={[0, 1.2, 0.35]}>
        <boxGeometry args={[1.6, 0.05, 1.28]} />
        <meshStandardMaterial color="#09090b" roughness={0.3} metalness={0.85} />
      </mesh>

      {/* Scissor Doors (Left & Right - Open Upwards) */}
      <group
        position={[-0.94, 0.7, -0.25]}
        rotation={[doorsOpen ? -0.95 : 0, 0, doorsOpen ? 0.38 : 0]}
      >
        <mesh position={[0, 0, 0.46]}>
          <boxGeometry args={[0.08, 0.74, 1.22]} />
          <meshStandardMaterial color={exteriorColor} metalness={0.7} roughness={0.2} />
        </mesh>
      </group>

      <group
        position={[0.94, 0.7, -0.25]}
        rotation={[doorsOpen ? -0.95 : 0, 0, doorsOpen ? -0.38 : 0]}
      >
        <mesh position={[0, 0, 0.46]}>
          <boxGeometry args={[0.08, 0.74, 1.22]} />
          <meshStandardMaterial color={exteriorColor} metalness={0.7} roughness={0.2} />
        </mesh>
      </group>

      {/* Rear Engine Decklid & Flared Quarters */}
      <mesh position={[0, 0.86, 1.48]} rotation={[-0.15, 0, 0]} castShadow>
        <boxGeometry args={[1.88, 0.16, 1.42]} />
        <meshStandardMaterial color={exteriorColor} metalness={0.7} roughness={0.2} />
      </mesh>

      {/* Active Carbon Rear Aerodynamic Wing with Stanchions */}
      <group position={[0, 1.18, 2.18]}>
        <mesh castShadow>
          <boxGeometry args={[1.96, 0.06, 0.38]} />
          <meshStandardMaterial color="#09090b" roughness={0.25} metalness={0.85} />
        </mesh>
        {[-0.68, 0.68].map(wx => (
          <mesh key={wx} position={[wx, -0.16, 0]}>
            <boxGeometry args={[0.04, 0.32, 0.16]} />
            <meshStandardMaterial color="#09090b" metalness={0.8} />
          </mesh>
        ))}
      </group>

      {/* High-Mounted Dual Titanium Exhaust Tailpipes */}
      {[-0.24, 0.24].map(ex => (
        <mesh key={ex} position={[ex, 0.66, 2.4]} rotation={[PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.085, 0.085, 0.16, 16]} />
          <meshStandardMaterial
            color="#475569"
            metalness={0.95}
            emissive={isStarted ? (driveMode === 'CORSA' ? '#0284c7' : '#38bdf8') : '#000000'}
            emissiveIntensity={isStarted ? (rpm > 6000 ? 1.4 : 0.6) : 0}
          />
        </mesh>
      ))}

      {/* Matrix LED Projector Headlights */}
      {[-0.7, 0.7].map(hx => (
        <mesh key={hx} position={[hx, 0.58, -2.28]}>
          <boxGeometry args={[0.36, 0.08, 0.15]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive={lightsOn ? '#ffffff' : '#334155'}
            emissiveIntensity={lightsOn ? 1.9 : 0.1}
          />
        </mesh>
      ))}

      {/* 4 Staggered Alloy Wheels with Red Brembo Brake Calipers */}
      {[
        [-1.04, -1.28],
        [1.04, -1.28],
        [-1.06, 1.48],
        [1.06, 1.48],
      ].map(([wx, wz], i) => (
        <group key={i} position={[wx, 0.38, wz]}>
          <mesh rotation={[0, 0, PI / 2]} castShadow>
            <cylinderGeometry args={[0.38, 0.38, 0.28, 24]} />
            <meshStandardMaterial color="#09090b" roughness={0.9} />
          </mesh>
          <mesh rotation={[0, 0, PI / 2]}>
            <cylinderGeometry args={[0.26, 0.26, 0.29, 16]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.15} />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <boxGeometry args={[0.26, 0.12, 0.1]} />
            <meshStandardMaterial color="#ef4444" metalness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ============================================================================
// MAIN SUPERCAR VIEWER EXPORT
// ============================================================================

export default function SupercarViewer({ onClose }) {
  // Camera view presets: 'cockpit' (driver's seat) | 'cabin' (wide cabin) | 'gauges' (close-up) | 'showroom' (360 exterior)
  const [cameraView, setCameraView] = useState('cockpit');
  const [isStarted, setIsStarted] = useState(false);
  const [rpm, setRpm] = useState(800);
  const [speed, setSpeed] = useState(0);
  const [gear, setGear] = useState('P');
  const [driveMode, setDriveMode] = useState('SPORT'); // 'STRADA' | 'SPORT' | 'CORSA'
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [lightsOn, setLightsOn] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [exteriorColor, setExteriorColor] = useState('#dc2626');

  const colors = [
    { name: 'Rosso Corsa', hex: '#dc2626' },
    { name: 'Giallo Modena', hex: '#eab308' },
    { name: 'Verde Mantis', hex: '#22c55e' },
    { name: 'Blu Corsa', hex: '#0284c7' },
    { name: 'Nero Daytona', hex: '#18181b' },
    { name: 'Bianco Avus', hex: '#f8fafc' },
  ];

  const revIntervalRef = useRef(null);
  const isRevvingRef = useRef(false);

  // Engine Start / Stop
  const toggleStart = () => {
    if (!isStarted) {
      setIsStarted(true);
      setGear('N');
      setRpm(1200);
      if (soundEnabled) {
        supercarAudio.start(driveMode);
        supercarAudio.setRpm(1200, driveMode);
      }
    } else {
      setIsStarted(false);
      setGear('P');
      setRpm(0);
      setSpeed(0);
      supercarAudio.stop();
    }
  };

  // Accelerator Rev Action (Press & Hold)
  const startRevving = () => {
    if (!isStarted) return;
    isRevvingRef.current = true;
    setGear('1');
    if (revIntervalRef.current) clearInterval(revIntervalRef.current);

    revIntervalRef.current = setInterval(() => {
      setRpm(prev => {
        const next = Math.min(8500, prev + 260);
        if (soundEnabled) supercarAudio.setRpm(next, driveMode);
        return next;
      });
      setSpeed(prev => Math.min(340, prev + 9));
    }, 40);
  };

  const stopRevving = () => {
    isRevvingRef.current = false;
    if (revIntervalRef.current) clearInterval(revIntervalRef.current);

    revIntervalRef.current = setInterval(() => {
      setRpm(prev => {
        if (prev <= 1200) {
          clearInterval(revIntervalRef.current);
          if (soundEnabled) supercarAudio.setRpm(1200, driveMode);
          return 1200;
        }
        const next = prev - 340;
        if (soundEnabled) supercarAudio.setRpm(next, driveMode);
        return next;
      });
      setSpeed(prev => {
        if (prev <= 0) return 0;
        return prev - 14;
      });
    }, 40);
  };

  // Drive Mode Toggle (STRADA -> SPORT -> CORSA)
  const cycleDriveMode = () => {
    const modes = ['STRADA', 'SPORT', 'CORSA'];
    const nextIdx = (modes.indexOf(driveMode) + 1) % modes.length;
    const nextMode = modes[nextIdx];
    setDriveMode(nextMode);
    if (isStarted && soundEnabled) {
      supercarAudio.setRpm(rpm, nextMode);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        startRevving();
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        stopRevving();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (revIntervalRef.current) clearInterval(revIntervalRef.current);
      supercarAudio.stop();
    };
  }, [isStarted, driveMode, rpm, soundEnabled]);

  // Compute camera positions for each preset view
  const cameraConfig = useMemo(() => {
    switch (cameraView) {
      case 'cockpit':
        return { pos: [-0.38, 0.94, 0.16], target: [-0.38, 0.78, -0.65], fov: 62 };
      case 'cabin':
        return { pos: [0, 1.05, 0.52], target: [0, 0.68, -0.5], fov: 66 };
      case 'gauges':
        return { pos: [-0.38, 0.88, -0.12], target: [-0.38, 0.81, -0.46], fov: 46 };
      case 'showroom':
      default:
        return { pos: [3.8, 2.2, 4.4], target: [0, 0.6, 0], fov: 50 };
    }
  }, [cameraView]);

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: 1040,
        height: '90vh',
        maxHeight: 820,
        borderRadius: 24,
        background: 'linear-gradient(165deg, rgba(20,16,32,0.98), rgba(9,7,16,0.99))',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: '0 28px 70px rgba(0,0,0,0.8), 0 0 60px rgba(220,38,38,0.25)',
        backdropFilter: 'blur(20px)',
        overflow: 'hidden',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        animation: 'gp-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* ── TOP HEADER BAR ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(0,0,0,0.45)',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #ef4444, #991b1b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(239,68,68,0.5)',
            }}
          >
            <Gauge size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Ferrari SF90 Stradale &bull; 3D Cockpit Experience
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
              4.0L Twin-Turbo Hybrid V8 &bull; 1,000 PS &bull; Top Speed: 340 km/h
            </div>
          </div>
        </div>

        {/* Camera Preset View Switcher Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', padding: 4, borderRadius: 16 }}>
          {[
            { id: 'cockpit', label: "Driver's Seat" },
            { id: 'cabin', label: 'Wide Cabin' },
            { id: 'gauges', label: 'Steering & Gauges' },
            { id: 'showroom', label: 'Exterior 360°' },
          ].map(view => (
            <button
              key={view.id}
              onClick={() => setCameraView(view.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 12,
                border: 'none',
                background: cameraView === view.id ? '#ef4444' : 'transparent',
                color: cameraView === view.id ? '#ffffff' : '#94a3b8',
                fontSize: 11.5,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {view.label}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          title="Close"
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.06)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* ── 3D VIEWPORT WITH DYNAMIC LIGHTING ── */}
      <div style={{ flex: 1, position: 'relative', background: '#09090b' }}>
        <Canvas shadows>
          <PerspectiveCamera
            key={cameraView}
            makeDefault
            position={cameraConfig.pos}
            fov={cameraConfig.fov}
          />

          <OrbitControls
            enablePan={false}
            target={cameraConfig.target}
            minDistance={cameraView === 'showroom' ? 2.6 : 0.25}
            maxDistance={cameraView === 'showroom' ? 8.0 : 1.6}
          />

          {/* BRIGHT STUDIO & COCKPIT LIGHTING */}
          <ambientLight intensity={1.15} />
          <directionalLight position={[6, 9, 6]} intensity={1.9} castShadow />
          <directionalLight position={[-6, 5, -5]} intensity={1.0} color="#38bdf8" />
          <pointLight position={[0, 1.8, 0]} intensity={1.3} color="#ffffff" />
          {/* Driver Cockpit Accent Light */}
          <pointLight
            position={[-0.38, 0.82, -0.38]}
            intensity={isStarted ? (driveMode === 'CORSA' ? 1.6 : 1.2) : 0.4}
            color={clusterAccentColor}
          />

          {/* Showroom Polished Floor Disc */}
          {cameraView === 'showroom' && (
            <mesh position={[0, 0, 0]} rotation={[-PI / 2, 0, 0]} receiveShadow>
              <circleGeometry args={[6.0, 36]} />
              <meshStandardMaterial color="#1e1e24" roughness={0.3} metalness={0.7} />
            </mesh>
          )}

          <HighEndSupercar3D
            rpm={rpm}
            speed={speed}
            isStarted={isStarted}
            lightsOn={lightsOn}
            doorsOpen={doorsOpen}
            exteriorColor={exteriorColor}
            cameraView={cameraView}
            driveMode={driveMode}
            gear={gear}
          />
        </Canvas>

        {/* ── HUD DASHBOARD TELEMETRY READOUT ── */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            background: 'rgba(9,9,11,0.85)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 18,
            padding: '12px 18px',
            backdropFilter: 'blur(12px)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
              {isStarted ? Math.round(speed) : 0}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#94a3b8' }}>KM/H</span>
            <span style={{ marginLeft: 12, fontSize: 18, fontWeight: 900, color: '#ef4444' }}>
              GEAR {isStarted ? gear : 'P'}
            </span>
          </div>

          <div style={{ width: 190 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 800, color: '#94a3b8', marginBottom: 4 }}>
              <span>RPM TACHOMETER</span>
              <span style={{ color: rpm > 7500 ? '#ef4444' : '#fff' }}>{isStarted ? Math.round(rpm) : 0}</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, ((rpm - 800) / 8200) * 100)}%`,
                  background: rpm > 7800 ? '#ef4444' : rpm > 5500 ? '#eab308' : '#38bdf8',
                  transition: 'width 0.05s linear',
                }}
              />
            </div>
          </div>
        </div>

        {/* ── EXTERIOR PAINT SWATCHES ── */}
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(9,9,11,0.85)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 20,
            padding: '6px 14px',
            backdropFilter: 'blur(10px)',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8' }}>PAINT:</span>
          {colors.map(c => (
            <button
              key={c.name}
              onClick={() => setExteriorColor(c.hex)}
              title={c.name}
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: c.hex,
                border: exteriorColor === c.hex ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.3)',
                cursor: 'pointer',
                transform: exteriorColor === c.hex ? 'scale(1.25)' : 'scale(1)',
                transition: 'all 0.15s',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── BOTTOM INTERACTIVE CONTROLS ── */}
      <div
        style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(12,10,20,0.94)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Engine Start / Stop Button */}
          <button
            onClick={toggleStart}
            style={{
              padding: '12px 20px',
              borderRadius: 14,
              border: isStarted ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.2)',
              background: isStarted ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'rgba(255,255,255,0.08)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: isStarted ? '0 0 20px rgba(239,68,68,0.5)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <Key size={16} />
            <span>{isStarted ? 'STOP ENGINE' : 'START ENGINE'}</span>
          </button>

          {/* Drive Mode Selector Pill */}
          <button
            onClick={cycleDriveMode}
            disabled={!isStarted}
            style={{
              padding: '12px 18px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.08)',
              color: !isStarted ? '#64748b' : driveMode === 'CORSA' ? '#ef4444' : driveMode === 'SPORT' ? '#f59e0b' : '#38bdf8',
              fontSize: 12.5,
              fontWeight: 800,
              cursor: isStarted ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <Sliders size={15} />
            <span>MODE: {driveMode}</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              padding: '12px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.18)',
              background: soundEnabled ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
              color: soundEnabled ? '#38bdf8' : '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={soundEnabled ? 'Engine Sound Muted' : 'Engine Sound Active'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>

        {/* Dynamic Throttle Revving Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onMouseDown={startRevving}
            onMouseUp={stopRevving}
            onTouchStart={startRevving}
            onTouchEnd={stopRevving}
            disabled={!isStarted}
            style={{
              padding: '12px 28px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.25)',
              background: isStarted ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'rgba(255,255,255,0.05)',
              color: isStarted ? '#fff' : '#64748b',
              fontSize: 13,
              fontWeight: 900,
              cursor: isStarted ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: isStarted ? '0 4px 18px rgba(2,132,199,0.45)' : 'none',
              userSelect: 'none',
              transition: 'all 0.15s',
            }}
          >
            <Play size={16} />
            <span>HOLD TO REV THROTTLE</span>
          </button>

          {/* Doors & Headlights Toggle */}
          <button
            onClick={() => setDoorsOpen(!doorsOpen)}
            style={{
              padding: '12px 16px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.18)',
              background: doorsOpen ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {doorsOpen ? 'CLOSE DOORS' : 'OPEN SCISSOR DOORS'}
          </button>

          <button
            onClick={() => setLightsOn(!lightsOn)}
            style={{
              padding: '12px 16px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.18)',
              background: lightsOn ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
              color: lightsOn ? '#fef08a' : '#94a3b8',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {lightsOn ? 'LIGHTS ON' : 'LIGHTS OFF'}
          </button>
        </div>
      </div>
    </div>
  );
}
