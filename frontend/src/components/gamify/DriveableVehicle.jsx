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
export function DriveableSupercar({ initialPos = [13.0, 0, 8.6], onDriveChange, onInspect }) {
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
      view.current.exitCarDrive = exitDrive;
      view.current.setCarDrivingState?.(true, 0);
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
      view.current.setCarDrivingState?.(false, 0);
      if (view.current.driveKeys) {
        view.current.driveKeys = { w: false, s: false, a: false, d: false };
      }
      // Drop avatar right beside the driver's side of the car
      const wp = new THREE.Vector3();
      if (carRef.current) carRef.current.getWorldPosition(wp);
      else wp.set(4, 0, 0.6);
      view.current.walk = {
        x: Math.max(-26, Math.min(26, wp.x - 2.2)),
        z: Math.max(6, Math.min(36, wp.z)),
        floor: 0,
      };
      view.current.glide = true;
    }
    onDriveChange && onDriveChange(false);
  };

  useEffect(() => {
    if (view?.current) {
      view.current.exitCarDrive = exitDrive;
      view.current.startCarDrive = startDrive;
    }
  });

  useFrame((_, dt) => {
    const car = carRef.current;
    if (!car) return;
    const st = stateRef.current;

    if (isDriving) {
      const maxSpeed = 16.0; // ~58 km/h in scaled units
      const accel = 18.0;
      const decel = 12.0;
      const turnSpeed = 2.4;

      // Handle forward/reverse from both keyboard and viewRef virtual buttons
      const extKeys = view?.current?.driveKeys || {};
      let throttle = 0;
      if (keysRef.current.w || extKeys.w) throttle += 1;
      if (keysRef.current.s || extKeys.s) throttle -= 0.6;

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
      if (keysRef.current.a || extKeys.a) steer += 1;
      if (keysRef.current.d || extKeys.d) steer -= 1;
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

      // Road, frontyard, and street boundary clamping relative to turntable
      st.x = Math.max(-28.0, Math.min(20.0, st.x));
      st.z = Math.max(-2.0, Math.min(32.0, st.z));

      // Update sound
      if (audioRef.current) {
        audioRef.current.setSpeed(Math.abs(st.speed) / maxSpeed);
      }

      const spd = Math.round(Math.abs(st.speed) * 3.6 * 2.5);
      setSpeedKmh(spd);
      if (view?.current?.setCarDrivingState) {
        view.current.setCarDrivingState(true, spd);
      }

      // Camera dynamically tracks the supercar in world space
      if (view?.current && !view.current.dragging) {
        view.current.glide = false;
        const wp = new THREE.Vector3();
        car.getWorldPosition(wp);
        view.current.tx = wp.x;
        view.current.tz = wp.z;
      }
    }

    car.position.x = st.x;
    car.position.z = st.z;
    car.rotation.y = st.rot;
  });

  const handleCarClick = (e) => {
    if (isDriving) return;
    e.stopPropagation();
    if (onInspect) {
      onInspect(e);
    } else if (view?.current?.openProp) {
      view.current.openProp('supercar', 'shared');
    }
  };

  return (
    <group
      ref={carRef}
      position={initialPos}
      onClick={handleCarClick}
      onPointerOver={() => { try { if (!isDriving) document.body.style.cursor = 'pointer'; } catch {} }}
      onPointerOut={() => { try { document.body.style.cursor = ''; } catch {} }}
    >
      <Supercar3D
        color="#c8102e"
        lightsOn={true}
        interior={true}
        spin={isDriving ? stateRef.current.speed * 2.4 : 0}
      />

      {/* 3D Modern Glassmorphic Action Card above the Supercar */}
      {!isDriving && (
        <ScaledHtml position={[0, 2.5, 0]} zIndexRange={[50, 0]}>
          <div
            className="stay-white"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 30,
              background: 'rgba(10, 8, 22, 0.92)',
              border: '1.5px solid rgba(255, 255, 255, 0.28)',
              boxShadow: '0 8px 26px rgba(0, 0, 0, 0.6), 0 0 16px rgba(239, 68, 68, 0.35)',
              backdropFilter: 'blur(12px)',
              pointerEvents: 'auto',
              userSelect: 'none',
            }}
          >
            {/* 1. Supercar Info & Cockpit button */}
            <button
              onClick={handleCarClick}
              title="Inspect Supercar 3D Cockpit, Engine Sound & Specs"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 13px',
                borderRadius: 20,
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span>🏎️</span>
              <span>Supercar Info</span>
            </button>

            {/* 2. Drive Supercar Action button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                startDrive();
              }}
              title="Drive Supercar across the Frontyard & Street"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 15px',
                borderRadius: 20,
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                fontSize: 12,
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.55)',
                whiteSpace: 'nowrap',
                letterSpacing: '0.02em',
                transition: 'transform 0.15s ease',
              }}
            >
              <span>⚡</span>
              <span>Drive ▶</span>
            </button>
          </div>
        </ScaledHtml>
      )}
    </group>
  );
}
