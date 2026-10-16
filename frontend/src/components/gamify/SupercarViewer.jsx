import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import {
  X, Gauge, Play, RotateCcw, Volume2, VolumeX, Eye, Sparkles,
  Zap, Disc, Key, Shield, ArrowRight, Check, Compass, Sliders
} from 'lucide-react';

const PI = Math.PI;

// Synthesize authentic V10/V12 supercar engine audio via Web Audio API
class EngineSoundEngine {
  constructor() {
    this.ctx = null;
    this.osc1 = null;
    this.osc2 = null;
    this.noiseNode = null;
    this.gainNode = null;
    this.filterNode = null;
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

  start() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.isPlaying) return;

    // Dual oscillators for deep exhaust rumble + mechanical valve harmonic
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc1.frequency.setValueAtTime(45, this.ctx.currentTime); // base idle rumble

    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = 'triangle';
    this.osc2.frequency.setValueAtTime(90, this.ctx.currentTime);

    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(260, this.ctx.currentTime);

    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(0.08, this.ctx.currentTime);

    this.osc1.connect(this.filterNode);
    this.osc2.connect(this.filterNode);
    this.filterNode.connect(this.gainNode);
    this.gainNode.connect(this.ctx.destination);

    this.osc1.start();
    this.osc2.start();
    this.isPlaying = true;
  }

  setRpm(rpm) {
    if (!this.isPlaying || !this.ctx) return;
    const norm = Math.min(1, Math.max(0, (rpm - 800) / 8500));
    const now = this.ctx.currentTime;
    // Map RPM to audio frequencies
    const targetFreq1 = 45 + norm * 260;
    const targetFreq2 = 90 + norm * 520;
    const filterFreq = 260 + norm * 1800;
    const targetGain = 0.08 + norm * 0.16;

    this.osc1.frequency.setTargetAtTime(targetFreq1, now, 0.05);
    this.osc2.frequency.setTargetAtTime(targetFreq2, now, 0.05);
    this.filterNode.frequency.setTargetAtTime(filterFreq, now, 0.05);
    this.gainNode.gain.setTargetAtTime(targetGain, now, 0.05);
  }

  stop() {
    if (!this.isPlaying) return;
    try {
      this.osc1?.stop();
      this.osc2?.stop();
      this.osc1?.disconnect();
      this.osc2?.disconnect();
    } catch {}
    this.isPlaying = false;
  }
}

const engineAudio = new EngineSoundEngine();

// ============================================================================
// 3D COCKPIT & EXTERIOR SHOWROOM MESHES
// ============================================================================

function CockpitDashboard3D({ rpm, speed, isStarted, lightsOn, doorsOpen, exteriorColor }) {
  const steeringRef = useRef();
  const wheelLightsRef = useRef();

  useFrame((state) => {
    // Subtle idle engine vibration when started
    if (steeringRef.current && isStarted) {
      steeringRef.current.position.y = 0.72 + Math.sin(state.clock.elapsedTime * 45) * 0.0012;
    }
  });

  const rpmRatio = Math.min(1, Math.max(0, (rpm - 800) / 8500));

  return (
    <group position={[0, 0, 0]}>
      {/* ── COCKPIT INTERIOR ── */}

      {/* Main Alcantara Dash Body */}
      <mesh position={[0, 0.7, -0.6]} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.38, 0.85]} />
        <meshStandardMaterial color="#18181b" roughness={0.9} />
      </mesh>
      {/* Carbon Fiber Instrument Cowl */}
      <mesh position={[-0.38, 0.88, -0.45]}>
        <boxGeometry args={[0.55, 0.16, 0.35]} />
        <meshStandardMaterial color="#27272a" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Center Console Tunnel (running between seats) */}
      <mesh position={[0, 0.35, -0.1]} castShadow>
        <boxGeometry args={[0.34, 0.45, 1.2]} />
        <meshStandardMaterial color="#18181b" roughness={0.8} metalness={0.2} />
      </mesh>
      {/* Carbon Fiber Inlay Strip on Center Tunnel */}
      <mesh position={[0, 0.58, -0.1]}>
        <boxGeometry args={[0.22, 0.02, 1.1]} />
        <meshStandardMaterial color="#27272a" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Center Touchscreen Telemetry Console */}
      <group position={[0, 0.72, -0.35]} rotation={[-0.35, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.32, 0.22, 0.02]} />
          <meshStandardMaterial color="#09090b" />
        </mesh>
        <mesh position={[0, 0, 0.015]}>
          <planeGeometry args={[0.29, 0.19]} />
          <meshBasicMaterial color={isStarted ? '#0284c7' : '#1e293b'} />
        </mesh>
      </group>

      {/* Flip-up Red Missile-style Engine Start/Stop Button */}
      <group position={[0, 0.6, -0.05]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.05, 0.02, 16]} />
          <meshStandardMaterial color="#3f3f46" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.015, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.02, 16]} />
          <meshStandardMaterial
            color="#ef4444"
            emissive={isStarted ? '#ef4444' : '#7f1d1d'}
            emissiveIntensity={isStarted ? 0.9 : 0.2}
          />
        </mesh>
      </group>

      {/* Flat-Bottom Racing Steering Wheel with Carbon Trim */}
      <group ref={steeringRef} position={[-0.38, 0.72, -0.25]} rotation={[-0.35, 0, 0]}>
        {/* Steering Column */}
        <mesh position={[0, 0, -0.15]}>
          <cylinderGeometry args={[0.05, 0.05, 0.3, 12]} />
          <meshStandardMaterial color="#27272a" metalness={0.6} />
        </mesh>
        {/* Outer Wheel Rim */}
        <mesh rotation={[PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.024, 12, 32]} />
          <meshStandardMaterial color="#18181b" roughness={0.7} />
        </mesh>
        {/* Top 12 o'clock Racing Stripe in Red */}
        <mesh position={[0, 0.2, 0]} rotation={[PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.025, 12, 8, 0.25]} />
          <meshStandardMaterial color="#ef4444" roughness={0.4} />
        </mesh>
        {/* Center Horn Boss & Ferrari/Lambo Badge */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.065, 0.065, 0.025, 16]} />
          <meshStandardMaterial color="#09090b" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.015]}>
          <sphereGeometry args={[0.025, 12, 10]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Left & Right Aluminum Paddle Shifters */}
        {[-0.22, 0.22].map((x, i) => (
          <mesh key={i} position={[x, 0.08, -0.04]} rotation={[0, 0, i === 0 ? 0.15 : -0.15]}>
            <boxGeometry args={[0.025, 0.16, 0.008]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.15} />
          </mesh>
        ))}

        {/* LED Shift Indicator Lights on Top of Steering Wheel Rim */}
        <group ref={wheelLightsRef} position={[0, 0.165, 0.01]}>
          {[-0.08, -0.04, 0, 0.04, 0.08].map((lx, idx) => {
            const lit = isStarted && rpmRatio > (idx + 1) * 0.18;
            const col = idx < 2 ? '#22c55e' : idx < 4 ? '#eab308' : '#ef4444';
            return (
              <mesh key={idx} position={[lx, 0, 0]}>
                <sphereGeometry args={[0.01, 8, 8]} />
                <meshBasicMaterial color={lit ? col : '#3f3f46'} toneMapped={false} />
              </mesh>
            );
          })}
        </group>
      </group>

      {/* Driver Racing Bucket Seat (Left) */}
      <group position={[-0.38, 0.35, 0.3]}>
        <mesh castShadow>
          <boxGeometry args={[0.48, 0.22, 0.55]} />
          <meshStandardMaterial color="#18181b" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.45, -0.22]} rotation={[0.2, 0, 0]} castShadow>
          <boxGeometry args={[0.48, 0.8, 0.14]} />
          <meshStandardMaterial color="#18181b" roughness={0.8} />
        </mesh>
        {/* Red Contrast Bolster Accents */}
        <mesh position={[-0.22, 0.45, -0.18]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.05, 0.75, 0.18]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
        <mesh position={[0.22, 0.45, -0.18]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.05, 0.75, 0.18]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
      </group>

      {/* Passenger Racing Bucket Seat (Right) */}
      <group position={[0.38, 0.35, 0.3]}>
        <mesh castShadow>
          <boxGeometry args={[0.48, 0.22, 0.55]} />
          <meshStandardMaterial color="#18181b" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.45, -0.22]} rotation={[0.2, 0, 0]} castShadow>
          <boxGeometry args={[0.48, 0.8, 0.14]} />
          <meshStandardMaterial color="#18181b" roughness={0.8} />
        </mesh>
        <mesh position={[-0.22, 0.45, -0.18]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.05, 0.75, 0.18]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
        <mesh position={[0.22, 0.45, -0.18]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.05, 0.75, 0.18]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
      </group>

      {/* ── EXTERIOR SHELL & SCISSOR DOORS ── */}
      {/* Front Hood with Aerodynamic Vent Ducts */}
      <mesh position={[0, 0.65, -1.55]} rotation={[0.18, 0, 0]} castShadow>
        <boxGeometry args={[1.72, 0.15, 1.3]} />
        <meshStandardMaterial color={exteriorColor} metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Front Nose Splitter */}
      <mesh position={[0, 0.28, -2.25]}>
        <boxGeometry args={[1.76, 0.08, 0.45]} />
        <meshStandardMaterial color="#09090b" roughness={0.4} />
      </mesh>

      {/* Scissor Doors (Left & Right) with Open Animation */}
      <group
        position={[-0.88, 0.75, -0.3]}
        rotation={[doorsOpen ? -0.85 : 0, 0, doorsOpen ? 0.3 : 0]}
      >
        <mesh position={[0, 0, 0.4]}>
          <boxGeometry args={[0.08, 0.7, 1.1]} />
          <meshStandardMaterial color={exteriorColor} metalness={0.7} roughness={0.2} />
        </mesh>
      </group>

      <group
        position={[0.88, 0.75, -0.3]}
        rotation={[doorsOpen ? -0.85 : 0, 0, doorsOpen ? -0.3 : 0]}
      >
        <mesh position={[0, 0, 0.4]}>
          <boxGeometry args={[0.08, 0.7, 1.1]} />
          <meshStandardMaterial color={exteriorColor} metalness={0.7} roughness={0.2} />
        </mesh>
      </group>

      {/* Headlights */}
      <mesh position={[-0.65, 0.58, -2.15]}>
        <boxGeometry args={[0.3, 0.08, 0.12]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={lightsOn ? '#ffffff' : '#334155'}
          emissiveIntensity={lightsOn ? 1.4 : 0.1}
        />
      </mesh>
      <mesh position={[0.65, 0.58, -2.15]}>
        <boxGeometry args={[0.3, 0.08, 0.12]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={lightsOn ? '#ffffff' : '#334155'}
          emissiveIntensity={lightsOn ? 1.4 : 0.1}
        />
      </mesh>
    </group>
  );
}

// ============================================================================
// MAIN COMPONENT EXPORT
// ============================================================================

export default function SupercarViewer({ onClose }) {
  const [viewMode, setViewMode] = useState('cockpit'); // 'cockpit' | 'showroom'
  const [isStarted, setIsStarted] = useState(false);
  const [rpm, setRpm] = useState(800);
  const [speed, setSpeed] = useState(0);
  const [gear, setGear] = useState('P');
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [lightsOn, setLightsOn] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [exteriorColor, setExteriorColor] = useState('#dc2626'); // Rosso Corsa

  const colors = [
    { name: 'Rosso Corsa', hex: '#dc2626' },
    { name: 'Giallo Modena', hex: '#eab308' },
    { name: 'Verde Mantis', hex: '#22c55e' },
    { name: 'Nero Daytona', hex: '#18181b' },
    { name: 'Grigio Silverstone', hex: '#64748b' },
  ];

  const revIntervalRef = useRef(null);
  const isRevvingRef = useRef(false);

  // Engine start toggle
  const toggleStart = () => {
    if (!isStarted) {
      setIsStarted(true);
      setGear('N');
      setRpm(1200);
      if (soundEnabled) {
        engineAudio.start();
        engineAudio.setRpm(1200);
      }
    } else {
      setIsStarted(false);
      setGear('P');
      setRpm(0);
      setSpeed(0);
      engineAudio.stop();
    }
  };

  // Gas pedal press & hold
  const startRevving = () => {
    if (!isStarted) return;
    isRevvingRef.current = true;
    setGear('1');
    if (revIntervalRef.current) clearInterval(revIntervalRef.current);

    revIntervalRef.current = setInterval(() => {
      setRpm(prev => {
        const next = Math.min(8800, prev + 240);
        if (soundEnabled) engineAudio.setRpm(next);
        return next;
      });
      setSpeed(prev => Math.min(335, prev + 8));
    }, 45);
  };

  const stopRevving = () => {
    isRevvingRef.current = false;
    if (revIntervalRef.current) clearInterval(revIntervalRef.current);

    revIntervalRef.current = setInterval(() => {
      setRpm(prev => {
        if (prev <= 1200) {
          clearInterval(revIntervalRef.current);
          if (soundEnabled) engineAudio.setRpm(1200);
          return 1200;
        }
        const next = prev - 320;
        if (soundEnabled) engineAudio.setRpm(next);
        return next;
      });
      setSpeed(prev => {
        if (prev <= 0) return 0;
        return prev - 12;
      });
    }, 45);
  };

  useEffect(() => {
    return () => {
      if (revIntervalRef.current) clearInterval(revIntervalRef.current);
      engineAudio.stop();
    };
  }, []);

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: 960,
        height: '88vh',
        maxHeight: 780,
        borderRadius: 24,
        background: 'linear-gradient(165deg, rgba(20,16,32,0.98), rgba(9,7,16,0.99))',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.7), 0 0 50px rgba(220,38,38,0.2)',
        backdropFilter: 'blur(16px)',
        overflow: 'hidden',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        animation: 'gp-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* ── Top Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 22px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(0,0,0,0.3)',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #ef4444, #991b1b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(239,68,68,0.4)',
            }}
          >
            <Gauge size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Ferrari SF90 Stradale &bull; Cockpit 3D
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
              4.0L Twin-Turbo V8 Hybrid &bull; 1,000 PS &bull; 0-100 km/h: 2.5s
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setViewMode(viewMode === 'cockpit' ? 'showroom' : 'cockpit')}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <Eye size={15} color="#38bdf8" />
            <span>{viewMode === 'cockpit' ? 'Switch to Showroom' : 'Switch to Cockpit'}</span>
          </button>

          <button
            onClick={onClose}
            title="Close"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
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
      </div>

      {/* ── 3D Viewport ── */}
      <div style={{ flex: 1, position: 'relative', background: '#09090b' }}>
        <Canvas shadows>
          {viewMode === 'cockpit' ? (
            <PerspectiveCamera makeDefault position={[-0.38, 0.95, 0.25]} fov={62} />
          ) : (
            <PerspectiveCamera makeDefault position={[3.2, 2.2, 4.5]} fov={50} />
          )}

          <OrbitControls
            enablePan={false}
            maxDistance={viewMode === 'cockpit' ? 1.5 : 8}
            minDistance={viewMode === 'cockpit' ? 0.3 : 2.5}
            target={viewMode === 'cockpit' ? [-0.38, 0.72, -0.6] : [0, 0.6, 0]}
          />

          <ambientLight intensity={0.65} />
          <directionalLight position={[4, 6, 4]} intensity={1.4} castShadow />
          <pointLight position={[0, 1.2, 0]} intensity={0.8} color="#e0f2fe" />
          <pointLight position={[-0.38, 0.8, -0.4]} intensity={isStarted ? 0.9 : 0.2} color="#38bdf8" />

          <CockpitDashboard3D
            rpm={rpm}
            speed={speed}
            isStarted={isStarted}
            lightsOn={lightsOn}
            doorsOpen={doorsOpen}
            exteriorColor={exteriorColor}
          />
        </Canvas>

        {/* ── Heads-Up Telemetry Display (HUD) ── */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            background: 'rgba(9,9,11,0.75)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16,
            padding: '12px 16px',
            backdropFilter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
              {isStarted ? Math.round(speed) : 0}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#94a3b8' }}>KM/H</span>
            <span style={{ marginLeft: 10, fontSize: 18, fontWeight: 900, color: '#ef4444' }}>
              GEAR {isStarted ? gear : 'P'}
            </span>
          </div>

          {/* RPM Bar */}
          <div style={{ width: 180 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 800, color: '#94a3b8', marginBottom: 3 }}>
              <span>RPM</span>
              <span style={{ color: rpm > 7500 ? '#ef4444' : '#fff' }}>{isStarted ? Math.round(rpm) : 0}</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, ((rpm - 800) / 8500) * 100)}%`,
                  background: rpm > 7500 ? '#ef4444' : rpm > 5000 ? '#eab308' : '#38bdf8',
                  transition: 'width 0.05s linear',
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Exterior Color Selector Floating Pills ── */}
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            left: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(9,9,11,0.75)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20,
            padding: '6px 12px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8' }}>COLOR:</span>
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
                transform: exteriorColor === c.hex ? 'scale(1.2)' : 'scale(1)',
                transition: 'all 0.15s',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Bottom Interactive Control Deck ── */}
      <div
        style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(12,10,20,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          zIndex: 20,
        }}
      >
        {/* Left Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Engine Start/Stop Switch */}
          <button
            onClick={toggleStart}
            style={{
              padding: '10px 18px',
              borderRadius: 14,
              border: isStarted ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.2)',
              background: isStarted ? 'linear-gradient(135deg, #ef4444, #991b1b)' : 'rgba(255,255,255,0.08)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
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

          {/* Scissor Doors Toggle */}
          <button
            onClick={() => setDoorsOpen(!doorsOpen)}
            style={{
              padding: '10px 14px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.15)',
              background: doorsOpen ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.06)',
              color: doorsOpen ? '#38bdf8' : '#fff',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Sliders size={15} />
            <span>{doorsOpen ? 'Close Doors' : 'Open Scissor Doors'}</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (soundEnabled) engineAudio.stop();
              else if (isStarted) {
                engineAudio.start();
                engineAudio.setRpm(rpm);
              }
            }}
            title={soundEnabled ? 'Mute Audio' : 'Enable Audio'}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.15)',
              background: soundEnabled ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
              color: soundEnabled ? '#22c55e' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>

        {/* Right Action: Gas Pedal Press & Hold */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onMouseDown={startRevving}
            onMouseUp={stopRevving}
            onMouseLeave={stopRevving}
            onTouchStart={startRevving}
            onTouchEnd={stopRevving}
            disabled={!isStarted}
            style={{
              padding: '12px 28px',
              borderRadius: 16,
              border: 'none',
              background: isStarted
                ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                : 'rgba(255,255,255,0.1)',
              color: isStarted ? '#fff' : '#64748b',
              fontSize: 14,
              fontWeight: 900,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: isStarted ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: isStarted && rpm > 5000 ? '0 0 25px rgba(245,158,11,0.6)' : 'none',
              transform: isRevvingRef.current ? 'scale(0.96)' : 'scale(1)',
              transition: 'all 0.1s',
              userSelect: 'none',
            }}
          >
            <Zap size={18} />
            <span>PRESS &amp; HOLD GAS (REV ENGINE)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
