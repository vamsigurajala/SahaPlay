import React, { useRef, useState, useEffect } from 'react';
import { useIsLight } from './useIsLight';

/**
 * Mobile Virtual Joystick for Avatar Navigation
 * Computes normalized (vx, vy) vector from -1 to 1.
 */
export default function VirtualJoystick({ onMove, onStop, visible = true }) {
  const isLight = useIsLight();
  const baseRef = useRef(null);
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const touchIdRef = useRef(null);

  const RADIUS = 44; // max drag radius in pixels

  const handleTouchStart = (e) => {
    if (touchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    setActive(true);
    updateVector(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e) => {
    if (touchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        updateVector(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        break;
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (touchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        touchIdRef.current = null;
        setActive(false);
        setPos({ x: 0, y: 0 });
        onStop && onStop();
        break;
      }
    }
  };

  const updateVector = (cx, cy) => {
    if (!baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = cx - centerX;
    const dy = cy - centerY;
    const dist = Math.hypot(dx, dy);

    const clampedDist = Math.min(dist, RADIUS);
    const angle = Math.atan2(dy, dx);

    const nx = Math.cos(angle) * (clampedDist / RADIUS);
    const ny = Math.sin(angle) * (clampedDist / RADIUS);

    setPos({
      x: Math.cos(angle) * clampedDist,
      y: Math.sin(angle) * clampedDist,
    });

    onMove && onMove(nx, ny);
  };

  if (!visible) return null;

  const baseStyle = {
    position: 'absolute',
    left: 20,
    bottom: 24,
    width: RADIUS * 2 + 16,
    height: RADIUS * 2 + 16,
    borderRadius: '50%',
    zIndex: 65,
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(15, 12, 28, 0.55)',
    border: isLight ? '2px solid rgba(139, 92, 255, 0.4)' : '2px solid rgba(255, 255, 255, 0.22)',
    boxShadow: isLight
      ? '0 8px 24px rgba(0, 0, 0, 0.12), inset 0 2px 6px rgba(255, 255, 255, 0.6)'
      : '0 8px 24px rgba(0, 0, 0, 0.45), inset 0 2px 6px rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(8px)',
    transition: 'opacity 0.2s ease',
    opacity: active ? 0.95 : 0.65,
  };

  const knobStyle = {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: active
      ? 'linear-gradient(135deg, #8b5cff, #6366f1)'
      : isLight
      ? 'linear-gradient(135deg, #94a3b8, #64748b)'
      : 'linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0.18))',
    boxShadow: active
      ? '0 0 16px rgba(139, 92, 255, 0.8), 0 4px 10px rgba(0,0,0,0.3)'
      : '0 4px 12px rgba(0,0,0,0.25)',
    border: '2px solid rgba(255,255,255,0.7)',
    transform: `translate(${pos.x}px, ${pos.y}px)`,
    transition: active ? 'none' : 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
    pointerEvents: 'none',
  };

  return (
    <div
      ref={baseRef}
      style={baseStyle}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div style={knobStyle} />
    </div>
  );
}
