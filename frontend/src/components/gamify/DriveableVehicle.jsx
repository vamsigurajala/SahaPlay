import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Supercar3D, Superbike3D } from './vehicles';
import { ViewContext, ScaledHtml } from './parts';
import { useIsLight } from './useIsLight';

const PI = Math.PI;

/**
 * Procedural Engine Sound for In-World Driving
 */
class DrivingAudio {
  constructor() {
    this.ctx = null;
    this.osc = null;
    this.gain = null;
    this.filter = null;
    this.active = false;
  }
  start() {
    if (this.active) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      this.osc = this.ctx.createOscillator();
      this.osc.type = 'sawtooth';
      this.osc.frequency.setValueAtTime(45, t);

      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.setValueAtTime(320, t);

      this.gain = this.ctx.createGain();
      this.gain.gain.setValueAtTime(0.04, t);

      this.osc.connect(this.filter);
      this.filter.connect(this.gain);
      this.gain.connect(this.ctx.destination);
      this.osc.start();
      this.active = true;
    } catch {}
  }
  setSpeed(speedRatio) {
    if (!this.active || !this.ctx) return;
    const now = this.ctx.currentTime;
    const targetFreq = 45 + speedRatio * 160;
    const targetFilter = 320 + speedRatio * 850;
    const targetGain = 0.04 + speedRatio * 0.08;
    this.osc.frequency.setTargetAtTime(targetFreq, now, 0.08);
    this.filter.frequency.setTargetAtTime(targetFilter, now, 0.08);
    this.gain.gain.setTargetAtTime(targetGain, now, 0.08);
  }
  stop() {
    if (!this.active) return;
    try {
      if (this.osc) { this.osc.stop(); this.osc.disconnect(); }
      if (this.ctx) { this.ctx.close(); }
    } catch {}
    this.active = false;
  }
}

/**
 * Driveable Supercar in the Frontyard and Street
 */
export function DriveableSupercar({ initialPos = [13.0, 0, 8.6], onDriveChange }) {
  const view = React.useContext(ViewContext);
  const isLight = useIsLight();

  const [isDriving, setIsDriving] = useState(false);
  const [speedKmh, setSpeedKmh] = useState(0);

  const carRef = useRef();
  const stateRef = useRef({
    x: initialPos[0],
    z: initialPos[2],
    rot: 0,
    speed: 0,
    wheelSpin: 0,
    targetRot: 0,
  });

  const keysRef = useRef({ w: false, s: false, a: false, d: false });
  const audioRef = useRef(null);

  // Expose global drive starter so prop modals or UI buttons can trigger driving immediately
  useEffect(() => {
    window.__startSupercarDrive = startDrive;
    return () => {
      delete window.__startSupercarDrive;
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    if (!isDriving) return;

    const onDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') keysRef.current.w = true;
      if (k === 's' || e.key === 'ArrowDown') keysRef.current.s = true;
      if (k === 'a' || e.key === 'ArrowLeft') keysRef.current.a = true;
      if (k === 'd' || e.key === 'ArrowRight') keysRef.current.d = true;
    };

    const onUp = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') keysRef.current.w = false;
      if (k === 's' || e.key === 'ArrowDown') keysRef.current.s = false;
      if (k === 'a' || e.key === 'ArrowLeft') keysRef.current.a = false;
      if (k === 'd' || e.key === 'ArrowRight') keysRef.current.d = false;
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [isDriving]);

  // Start / stop driving
  const startDrive = () => {
    setIsDriving(true);
    if (!audioRef.current) audioRef.current = new DrivingAudio();
    audioRef.current.start();
    if (view?.current) {
      view.current.driving = true;
    }
    onDriveChange && onDriveChange(true);
  };

  const exitDrive = () => {
    setIsDriving(false);
    keysRef.current = { w: false, s: false, a: false, d: false };
    if (audioRef.current) {
      audioRef.current.stop();
      audioRef.current = null;
    }
    if (view?.current) {
      view.current.driving = false;
      // Drop avatar right beside the driver's side of the car
      const st = stateRef.current;
      view.current.walk = {
        x: Math.max(-26, Math.min(26, st.x - 2.2)),
        z: Math.max(6, Math.min(36, st.z)),
        floor: 0,
      };
    }
    onDriveChange && onDriveChange(false);
  };

  useFrame((_, dt) => {
    const car = carRef.current;
    if (!car) return;
    const st = stateRef.current;

    if (isDriving) {
      const maxSpeed = 16.0; // ~58 km/h in scaled units
      const accel = 18.0;
      const decel = 12.0;
      const turnSpeed = 2.4;

      // Handle forward/reverse
      let throttle = 0;
      if (keysRef.current.w) throttle += 1;
      if (keysRef.current.s) throttle -= 0.6;

      // Handle joystick input if present
      if (view?.current?.joystick) {
        const jy = view.current.joystick.y;
        if (jy < -0.1) throttle = Math.max(throttle, -jy);
        else if (jy > 0.1) throttle = Math.min(throttle, -jy * 0.6);
      }

      if (throttle > 0) {
        st.speed = Math.min(maxSpeed, st.speed + accel * dt);
      } else if (throttle < 0) {
        st.speed = Math.max(-maxSpeed * 0.4, st.speed - accel * dt);
      } else {
        // Friction coast down
        if (st.speed > 0) st.speed = Math.max(0, st.speed - decel * dt);
        else if (st.speed < 0) st.speed = Math.min(0, st.speed + decel * dt);
      }

      // Steering (turns faster when in motion)
      let steer = 0;
      if (keysRef.current.a) steer += 1;
      if (keysRef.current.d) steer -= 1;
      if (view?.current?.joystick) {
        steer -= view.current.joystick.x || 0;
      }

      if (Math.abs(st.speed) > 0.1) {
        const dir = st.speed >= 0 ? 1 : -1;
        st.rot += steer * turnSpeed * dt * dir * (0.4 + Math.abs(st.speed) / maxSpeed * 0.6);
      }

      // Move car along forward vector
      const forwardX = Math.sin(st.rot);
      const forwardZ = Math.cos(st.rot);

      st.x += forwardX * st.speed * dt;
      st.z += forwardZ * st.speed * dt;

      // Road, frontyard, and street boundary clamping
      st.x = Math.max(-25.5, Math.min(25.5, st.x));
      st.z = Math.max(7.2, Math.min(36.0, st.z));

      // Update sound
      if (audioRef.current) {
        audioRef.current.setSpeed(Math.abs(st.speed) / maxSpeed);
      }

      setSpeedKmh(Math.round(Math.abs(st.speed) * 3.6 * 2.5));

      // Camera dynamically tracks the supercar in world space
      if (view?.current && !view.current.dragging) {
        view.current.glide = false;
        view.current.tx = st.x;
        view.current.tz = st.z;
      }

      // Sync avatar spot with car position
      if (view?.current?.spots) {
        const mySpot = Object.values(view.current.spots).find(s => s.floor === 0);
        if (mySpot) {
          mySpot.x = st.x;
          mySpot.z = st.z;
        }
      }
    }

    car.position.x = st.x;
    car.position.z = st.z;
    car.rotation.y = st.rot;
  });

  return (
    <>
      <group
        ref={carRef}
        position={initialPos}
        onClick={(e) => {
          if (!isDriving) {
            e.stopPropagation();
            startDrive();
          }
        }}
        style={{ cursor: isDriving ? 'default' : 'pointer' }}
      >
        <Supercar3D
          color="#c8102e"
          lightsOn={true}
          interior={true}
          spin={isDriving ? stateRef.current.speed * 2.4 : 0}
        />

        {/* 3D Prominent Floating Action Pill directly above the Supercar */}
        {!isDriving && (
          <ScaledHtml position={[0, 2.6, 0]} zIndexRange={[50, 0]}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'auto' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startDrive();
                }}
                title="Hop in and drive across the frontyard and street"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  borderRadius: 22,
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: '#ffffff',
                  border: '1.5px solid rgba(255,255,255,0.45)',
                  fontSize: 12.5,
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(239,68,68,0.55)',
                  whiteSpace: 'nowrap',
                  backdropFilter: 'blur(8px)',
                  letterSpacing: '0.02em',
                  transform: 'scale(1)',
                  transition: 'transform 0.15s ease',
                }}
              >
                🏎️ Drive Supercar
              </button>
            </div>
          </ScaledHtml>
        )}
      </group>

      {/* In-Game Drive Mode HUD Overlay */}
      {isDriving && (
        <>
          <div
            className="stay-white"
            style={{
              position: 'absolute',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 80,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '8px 18px',
              borderRadius: 99,
              background: isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(15, 12, 28, 0.92)',
              border: '2px solid #ef4444',
              boxShadow: '0 12px 32px rgba(239, 68, 68, 0.35)',
              backdropFilter: 'blur(12px)',
              color: isLight ? '#0f172a' : '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 900, fontSize: 14 }}>
              <span style={{ color: '#ef4444' }}>●</span>
              <span>SUPERCAR: {speedKmh} KM/H</span>
            </div>

            <div style={{ fontSize: 11.5, opacity: 0.75, fontWeight: 700 }}>
              WASD / Touch Buttons
            </div>

            <button
              onClick={exitDrive}
              style={{
                padding: '6px 14px',
                borderRadius: 99,
                border: 'none',
                background: '#ef4444',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.5)',
                transition: 'transform 0.15s ease',
              }}
            >
              Exit Vehicle
            </button>
          </div>

          {/* Mobile Touch Controls for Steering & Throttle */}
          <div
            style={{
              position: 'fixed',
              bottom: 24,
              left: 20,
              display: 'flex',
              gap: 12,
              pointerEvents: 'auto',
              zIndex: 9999,
            }}
          >
            <button
              onPointerDown={(e) => { e.preventDefault(); keysRef.current.a = true; }}
              onPointerUp={(e) => { e.preventDefault(); keysRef.current.a = false; }}
              onPointerLeave={() => { keysRef.current.a = false; }}
              aria-label="Steer Left"
              style={{
                width: 54,
                height: 54,
                borderRadius: 16,
                background: 'rgba(15,10,25,0.85)',
                border: '1.5px solid rgba(255,255,255,0.3)',
                color: '#fff',
                fontSize: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                touchAction: 'none',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
              }}
            >
              ◀
            </button>
            <button
              onPointerDown={(e) => { e.preventDefault(); keysRef.current.d = true; }}
              onPointerUp={(e) => { e.preventDefault(); keysRef.current.d = false; }}
              onPointerLeave={() => { keysRef.current.d = false; }}
              aria-label="Steer Right"
              style={{
                width: 54,
                height: 54,
                borderRadius: 16,
                background: 'rgba(15,10,25,0.85)',
                border: '1.5px solid rgba(255,255,255,0.3)',
                color: '#fff',
                fontSize: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                touchAction: 'none',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
              }}
            >
              ▶
            </button>
          </div>

          <div
            style={{
              position: 'fixed',
              bottom: 24,
              right: 20,
              display: 'flex',
              gap: 12,
              pointerEvents: 'auto',
              zIndex: 9999,
            }}
          >
            <button
              onPointerDown={(e) => { e.preventDefault(); keysRef.current.s = true; }}
              onPointerUp={(e) => { e.preventDefault(); keysRef.current.s = false; }}
              onPointerLeave={() => { keysRef.current.s = false; }}
              aria-label="Brake or Reverse"
              style={{
                width: 56,
                height: 54,
                borderRadius: 16,
                background: 'rgba(239,68,68,0.4)',
                border: '1.5px solid rgba(239,68,68,0.7)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                touchAction: 'none',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 6px 18px rgba(239,68,68,0.35)',
              }}
            >
              BRAKE
            </button>
            <button
              onPointerDown={(e) => { e.preventDefault(); keysRef.current.w = true; }}
              onPointerUp={(e) => { e.preventDefault(); keysRef.current.w = false; }}
              onPointerLeave={() => { keysRef.current.w = false; }}
              aria-label="Accelerate"
              style={{
                width: 56,
                height: 54,
                borderRadius: 16,
                background: 'rgba(34,197,94,0.45)',
                border: '1.5px solid rgba(34,197,94,0.8)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                touchAction: 'none',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 6px 18px rgba(34,197,94,0.35)',
              }}
            >
              GAS ▲
            </button>
          </div>
        </>
      )}
    </>
  );
}
