import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, FlipHorizontal2, Users, CloudSun, Layers, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { ALL_ZONES, COLS } from '../../data/gamifyZones';
import { ZONES_BY_FLOOR } from './GamifyRig';
import { WEATHER, WEATHER_ORDER } from './environment';

export default function GamifyControls({
  focus,
  floor,
  uiShown,
  zoomedIn,
  counts,
  weather,
  weatherPref,
  autoWx,
  realWx,
  realWxLoading,
  wxOpen,
  flipped,
  alwaysDots,
  onChangeFloor,
  onFocusRoom,
  onResetZoom,
  onToggleWx,
  onPickWeather,
  onToggleFlip,
  onToggleAlwaysDots,
  onResetView,
  onZoomIn,
  onZoomOut,
}) {
  const btn = {
    width: 34,
    height: 34,
    borderRadius: 9,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(12,10,24,0.72)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    backdropFilter: 'blur(6px)',
  };
  const glass = {
    background: 'rgba(12,10,24,0.72)',
    border: '1px solid rgba(255,255,255,0.16)',
    backdropFilter: 'blur(6px)',
    color: '#fff',
  };

  return (
    <>
      {/* Current room + hint + stairs button */}
      <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, pointerEvents: 'none' }}>
        <div className="stay-white" style={{ ...glass, padding: '5px 16px', borderRadius: 99, fontSize: 13, fontWeight: 800, letterSpacing: '0.04em' }}>
          {ALL_ZONES[focus]?.label || focus}
        </div>
        <div className="stay-white" style={{ transition: 'opacity .2s', fontSize: 11, opacity: uiShown ? 0.7 : 0, textShadow: '0 1px 3px #000' }}>
          Drag to look around, tap a door to go through
        </div>
        <button
          className="stay-white"
          onClick={onChangeFloor}
          title={floor === 0 ? 'Take the stairs up' : 'Take the stairs down'}
          style={{ ...glass, pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 800, cursor: 'pointer', marginTop: 2 }}
        >
          {floor === 0 ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
          {floor === 0 ? 'Go upstairs' : 'Go downstairs'}
        </button>
      </div>

      {/* Zoom out pill when zoomed in */}
      {zoomedIn && (
        <button
          className="stay-white"
          onClick={onResetZoom}
          style={{ ...glass, position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 62, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 99, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
        >
          <ZoomOut size={15} />Zoom out
        </button>
      )}

      {/* Floors + room map */}
      <div className="stay-white" style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 60, padding: 6, borderRadius: 12, ...glass }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
          {[['Ground floor', 0], ['Upstairs', 1]].map(([label, f]) => (
            <button
              key={f}
              className="stay-white"
              onClick={() => onFocusRoom(f ? 'f2hall' : 'hall')}
              style={{
                flex: 1,
                padding: '5px 6px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: 800,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                background: floor === f ? 'rgba(255,255,255,0.22)' : 'transparent',
                border: '1px solid rgba(255,255,255,0.14)',
              }}
            >
              <Layers size={10} />{label}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 4 }}>
          {ZONES_BY_FLOOR[floor].slice().sort((a, b) => a.row - b.row || a.col - b.col).map(z => (
            <button
              key={z.id}
              className="stay-white"
              onClick={() => onFocusRoom(z.id)}
              title={`Go to ${z.label}`}
              style={{
                gridColumn: z.col + 1,
                gridRow: z.row + 1,
                minWidth: 62,
                padding: '6px 6px 5px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: 700,
                color: '#fff',
                background: z.id === focus ? 'rgba(139,92,255,0.8)' : 'rgba(255,255,255,0.07)',
                border: z.id === focus ? '1px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.12)',
              }}
            >
              {z.label}
              {counts[z.id] > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: 4, fontSize: 10 }}>
                  <Users size={9} />{counts[z.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Weather selection menu */}
      {wxOpen && (
        <div className="stay-white" style={{ position: 'absolute', bottom: 12, right: 54, zIndex: 61, display: 'flex', flexDirection: 'column', gap: 3, padding: 6, borderRadius: 12, ...glass }}>
          {['auto', 'real', ...WEATHER_ORDER].map(k => (
            <button
              key={k}
              className="stay-white"
              onClick={() => onPickWeather(k)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                textAlign: 'left',
                background: weatherPref === k ? 'rgba(139,92,255,0.8)' : 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              {k === 'auto'
                ? `Auto (${WEATHER[autoWx]?.label || autoWx})`
                : k === 'real'
                ? `Real weather${realWx ? ` (${WEATHER[realWx]?.label || realWx})` : realWxLoading ? ' (fetching...)' : ''}`
                : WEATHER[k]?.label || k}
            </button>
          ))}
        </div>
      )}

      {/* Floating control buttons on right */}
      <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 60 }}>
        <button
          className="stay-white"
          onClick={onToggleWx}
          title={`Weather: ${WEATHER[weather]?.label || weather}`}
          style={{ ...btn, background: wxOpen ? 'rgba(139,92,255,0.75)' : btn.background }}
        >
          <CloudSun size={16} />
        </button>
        <button
          className="stay-white"
          onClick={onToggleFlip}
          title="Flip house left/right"
          style={{ ...btn, background: flipped ? 'rgba(139,92,255,0.75)' : btn.background }}
        >
          <FlipHorizontal2 size={16} />
        </button>
        <button
          className="stay-white"
          onClick={onToggleAlwaysDots}
          title={alwaysDots ? 'Interactive dots: Always on (click to auto-fade)' : 'Interactive dots: Tap to reveal (click for always on)'}
          style={{ ...btn, background: alwaysDots ? 'rgba(139,92,255,0.85)' : btn.background }}
        >
          <Eye size={16} />
        </button>
        <button className="stay-white" onClick={onResetView} title="Back to my room" style={btn}>
          <Maximize2 size={16} />
        </button>
        <button className="stay-white" onClick={onZoomIn} title="Zoom in" style={btn}>
          <ZoomIn size={16} />
        </button>
        <button className="stay-white" onClick={onZoomOut} title="Zoom out" style={btn}>
          <ZoomOut size={16} />
        </button>
      </div>
    </>
  );
}
