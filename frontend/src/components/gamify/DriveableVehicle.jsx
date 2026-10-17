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
      {/* Invisible hit box so tapping or clicking anywhere on or around the car opens the showroom */}
      <mesh visible={false} position={[0, 0.6, 0]}>
        <boxGeometry args={[3.2, 1.6, 5.6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Supercar3D
        color="#c8102e"
        lightsOn={true}
        interior={true}
        spin={0}
      />
    </group>
  );
}
