import React, { useRef } from 'react';
import { Supercar3D } from './vehicles';
import { ViewContext, ScaledHtml } from './parts';

/**
 * Interactive Showcase Supercar in the Frontyard Turntable.
 * Clicking the vehicle or the floating badge opens the full 3D interactive
 * showroom modal (custom paints, scissor doors, revving & audio).
 * Driving physics removed for ultra-smooth 60-120fps performance.
 */
export function DriveableSupercar({ initialPos = [0, 0.12, 0], onInspect }) {
  const view = React.useContext(ViewContext);
  const carRef = useRef();

  const handleCarClick = (e) => {
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
      onPointerOver={() => { try { document.body.style.cursor = 'pointer'; } catch {} }}
      onPointerOut={() => { try { document.body.style.cursor = ''; } catch {} }}
    >
      <Supercar3D
        color="#c8102e"
        lightsOn={true}
        interior={true}
        spin={0}
      />

      {/* Modern Glassmorphic Showroom Badge directly above the Supercar */}
      <ScaledHtml position={[0, 2.4, 0]} zIndexRange={[50, 0]}>
        <div
          className="stay-white"
          onClick={handleCarClick}
          title="Inspect Supercar, Customize Colors & Cockpit Specs"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '7px 16px',
            borderRadius: 30,
            background: 'rgba(10, 8, 22, 0.92)',
            border: '1.5px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(239, 68, 68, 0.35)',
            backdropFilter: 'blur(12px)',
            pointerEvents: 'auto',
            userSelect: 'none',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
          }}
        >
          <span style={{ fontSize: 15 }}>🏎️</span>
          <span style={{ fontSize: 12.5, fontWeight: 900, color: '#f8fafc', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
            Supercar Showroom
          </span>
        </div>
      </ScaledHtml>
    </group>
  );
}
