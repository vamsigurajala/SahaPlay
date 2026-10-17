import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Supercar3D } from './vehicles';
import {
  X, Gauge, Play, RotateCcw, Volume2, VolumeX, Eye, Sparkles,
  Zap, Disc, Key, Shield, ArrowRight, Check, Compass, Sliders,
  Radio, Activity, ChevronRight, Car
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
    this.muted = false;
    this.level = 0.08;
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
    const targetGain = (0.08 + norm * 0.22) * (this.muted ? 0 : 1);
    this.level = targetGain;

    this.oscLow.frequency.setTargetAtTime(targetLow, now, 0.03);
    this.oscMid.frequency.setTargetAtTime(targetMid, now, 0.03);
    this.oscHigh.frequency.setTargetAtTime(targetHigh, now, 0.03);
    this.filterNode.frequency.setTargetAtTime(filterFreq, now, 0.03);
    this.gainNode.gain.setTargetAtTime(targetGain, now, 0.03);
  }

  setMuted(m) {
    this.muted = m;
    if (this.gainNode && this.ctx) this.gainNode.gain.setTargetAtTime(m ? 0 : Math.max(0.08, this.level || 0.08), this.ctx.currentTime, 0.04);
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

// Camera presets. The in-car views orbit a point 10 cm ahead of the camera, which
// turns the orbit controls into a look-around from the driver's seat.
function cameraFor(view) {
  let c;
  switch (view) {
    case 'cockpit':
      c = { pos: [-0.38, 1.1, -0.4], target: [-0.38, 0.88, 2.4], fov: 70 };
      break;
    case 'cabin':
      c = { pos: [0.0, 1.12, -0.62], target: [0.0, 0.66, 1.2], fov: 82 };
      break;
    case 'gauges':
      c = { pos: [-0.38, 1.0, -0.05], target: [-0.38, 0.86, 0.7], fov: 52 };
      break;
    default:
      return { pos: [5.4, 2.3, 6.0], target: [0, 0.5, 0], fov: 42, look: [0, 0.5, 0] };
  }
  const d = new THREE.Vector3(...c.target).sub(new THREE.Vector3(...c.pos)).normalize().multiplyScalar(0.1);
  return { ...c, look: [c.pos[0] + d.x, c.pos[1] + d.y, c.pos[2] + d.z] };
}

export default function SupercarViewer({ onClose }) {
  // Camera view presets: 'cockpit' (driver's seat) | 'cabin' (wide cabin) | 'gauges' (close-up) | 'showroom' (360 exterior)
  const [cameraView, setCameraView] = useState('cabin');
  const [isStarted, setIsStarted] = useState(false);
  const [rpm, setRpm] = useState(800);
  const [speed, setSpeed] = useState(0);
  const [gear, setGear] = useState('P');
  const [driveMode, setDriveMode] = useState('SPORT'); // 'STRADA' | 'SPORT' | 'CORSA'
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [lightsOn, setLightsOn] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [exteriorColor, setExteriorColor] = useState('#dc2626');
  const [isLight, setIsLight] = useState(() => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light');
  useEffect(() => {
    const obs = new MutationObserver(() => setIsLight(document.documentElement.getAttribute('data-theme') === 'light'));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const colors = [
    { name: 'Rosso Corsa', hex: '#dc2626' },
    { name: 'Giallo Modena', hex: '#eab308' },
    { name: 'Verde Mantis', hex: '#22c55e' },
    { name: 'Blu Corsa', hex: '#0284c7' },
    { name: 'Nero Daytona', hex: '#18181b' },
    { name: 'Bianco Avus', hex: '#f8fafc' },
  ];

  // Engine state lives in a ref and a single animation loop advances it, so the
  // sound, the gauges and the tyre smoke all follow the same throttle (no stale
  // closures, and it behaves the same with a mouse, a finger or the space bar).
  const eng = useRef({ started: false, gas: false, rpm: 0, speed: 0, mode: 'SPORT', sound: true });
  eng.current.mode = driveMode;
  eng.current.sound = soundEnabled;

  const startEngine = () => {
    const e = eng.current;
    if (e.started) return;
    e.started = true;
    e.rpm = 1200;
    setIsStarted(true);
    setGear('N');
    setRpm(1200);
    supercarAudio.start(e.mode);
    supercarAudio.setMuted(!e.sound);
    supercarAudio.setRpm(1200, e.mode);
  };
  const stopEngine = () => {
    const e = eng.current;
    e.started = false;
    e.gas = false;
    e.rpm = 0;
    e.speed = 0;
    setIsStarted(false);
    setGear('P');
    setRpm(0);
    setSpeed(0);
    supercarAudio.stop();
  };
  const toggleStart = () => (eng.current.started ? stopEngine() : startEngine());
  // Pressing the pedal starts the engine first if it is still off.
  const pressGas = () => {
    if (!eng.current.started) startEngine();
    eng.current.gas = true;
  };
  const releaseGas = () => { eng.current.gas = false; };

  const cycleDriveMode = () => {
    const modes = ['STRADA', 'SPORT', 'CORSA'];
    setDriveMode(modes[(modes.indexOf(driveMode) + 1) % modes.length]);
  };

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let hud = 0;
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const e = eng.current;
      if (e.started) {
        const target = e.gas ? 8500 : 1200;
        const rate = e.gas ? 5200 : 3800; // rpm per second
        e.rpm += Math.sign(target - e.rpm) * Math.min(Math.abs(target - e.rpm), rate * dt);
        e.speed = Math.max(0, Math.min(340, e.speed + (e.gas ? 190 : -260) * dt));
        supercarAudio.setRpm(e.rpm, e.mode);
      }
      hud += dt;
      if (hud > 0.05) { // about 20 React updates a second keeps phones smooth
        hud = 0;
        setRpm(Math.round(e.rpm));
        setSpeed(Math.round(e.speed));
        setGear(!e.started ? 'P' : e.speed < 2 ? (e.gas ? '1' : 'N') : String(Math.min(6, 1 + Math.floor(e.speed / 55))));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => { supercarAudio.setMuted(!soundEnabled); }, [soundEnabled]);

  useEffect(() => {
    const down = (e) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); pressGas(); } };
    const up = (e) => { if (e.code === 'Space') { e.preventDefault(); releaseGas(); } };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Silence the engine only when the viewer closes.
  useEffect(() => () => { eng.current.started = false; supercarAudio.stop(); }, []);

  // Camera for the chosen view (the in-car views look around from the seat)
  const inside = cameraView !== 'showroom';
  const cameraConfig = useMemo(() => cameraFor(cameraView), [cameraView]);

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
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '12px 16px',
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
            <div style={{ fontSize: 'clamp(13px, 3.6vw, 18px)', fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Ferrari SF90 Stradale &bull; 3D Cockpit Experience
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
              4.0L Twin-Turbo Hybrid V8 &bull; 1,000 PS &bull; Top Speed: 340 km/h
            </div>
          </div>
        </div>

        {/* Camera Preset View Switcher Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', padding: 4, borderRadius: 16, order: 3, flex: '1 1 100%', justifyContent: 'center' }}>
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
          onClick={() => {
            onClose();
            if (window.__startSupercarDrive) {
              window.__startSupercarDrive();
            }
          }}
          title="Drive this supercar outside in the Frontyard and Street"
          style={{
            padding: '7px 16px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            cursor: 'pointer',
            fontSize: 12.5,
            fontWeight: 800,
            boxShadow: '0 4px 14px rgba(239,68,68,0.45)',
            transition: 'all 0.15s ease',
          }}
        >
          <Car size={16} /> Drive Supercar
        </button>

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
        <Canvas shadows dpr={[1, 1.75]}>
          <color attach="background" args={[inside ? (isLight ? '#b9d4f0' : '#7aa6d6') : (isLight ? '#dfe6f0' : '#0b0b12')]} />
          <PerspectiveCamera key={cameraView} makeDefault position={cameraConfig.pos} fov={cameraConfig.fov} near={0.05} />
          <OrbitControls
            enablePan={false}
            enableZoom={inside ? false : true}
            target={cameraConfig.look}
            minDistance={inside ? 0.1 : 3.2}
            maxDistance={inside ? 0.1 : 10}
            maxPolarAngle={inside ? PI : PI / 2 - 0.04}
          />

          {/* studio lighting: soft sky fill, a key light and a cool rim */}
          <hemisphereLight args={['#dbeafe', '#3a3a44', isLight ? 1.0 : 0.75]} />
          <ambientLight intensity={isLight ? 0.55 : 0.4} />
          <directionalLight position={[6, 9, 5]} intensity={2.1} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-6, 4, -5]} intensity={0.9} color="#7dd3fc" />

          {/* showroom floor: a polished disc with an accent ring */}
          <mesh rotation={[-PI / 2, 0, 0]} receiveShadow position={[0, -0.001, 0]}>
            <circleGeometry args={[9, 48]} />
            <meshStandardMaterial color={isLight ? '#c9d1dc' : '#1b1b23'} roughness={0.7} metalness={0.15} />
          </mesh>
          <mesh rotation={[-PI / 2, 0, 0]} position={[0, 0.002, 0]}>
            <ringGeometry args={[3.2, 3.26, 64]} />
            <meshBasicMaterial color={driveMode === 'CORSA' ? '#ef4444' : driveMode === 'SPORT' ? '#f59e0b' : '#38bdf8'} toneMapped={false} />
          </mesh>

          <Supercar3D smoke={isStarted && rpm > 7400} cutaway={inside} color={exteriorColor} lightsOn={lightsOn} doorsOpen={doorsOpen} started={isStarted} spin={isStarted ? speed / 14 : 0} wingUp={isStarted && speed > 60} />
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
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(12,10,20,0.94)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          overflowY: 'auto',
          maxHeight: '42%',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
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
            title={soundEnabled ? 'Mute engine sound' : 'Turn engine sound on'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>

        {/* Dynamic Throttle Revving Button */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, flex: '1 1 320px' }}>
          <button
            onPointerDown={(e) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ } pressGas(); }}
            onPointerUp={releaseGas}
            onPointerCancel={releaseGas}
            onLostPointerCapture={releaseGas}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              flex: '1 1 230px',
              minHeight: 52,
              padding: '12px 28px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 18px rgba(2,132,199,0.45)',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
              touchAction: 'none',
              transition: 'all 0.15s',
            }}
          >
            <Play size={16} />
            <span>{isStarted ? 'HOLD TO ACCELERATE' : 'HOLD TO START & ACCELERATE'}</span>
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
