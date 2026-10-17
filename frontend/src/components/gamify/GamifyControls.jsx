import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ZoomIn, ZoomOut, Maximize2, FlipHorizontal2, Users, CloudSun, Layers, ArrowUp, ArrowDown, ChevronDown, Eye, EyeOff, SmilePlus, Gauge, HelpCircle, Volume2, VolumeX, Camera, MessageCircle, Gamepad2, Tv } from 'lucide-react';
import { useAmbience } from './ambience';
import { useHideLabels, toggleHideLabels } from './labelPrefs';
import { ALL_ZONES, COLS } from '../../data/gamifyZones';
import { zoneName, goToText } from './gamifyText';
import { ZONES_BY_FLOOR } from './GamifyRig';
import { WEATHER, WEATHER_ORDER } from './environment';

export default function GamifyControls({
  onPhoto,
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
  onSetFloor,
  onFocusRoom,
  onResetZoom,
  onToggleWx,
  onPickWeather,
  onToggleFlip,
  onToggleAlwaysDots,
  onResetView,
  onZoomIn,
  onZoomOut,
  panel,
  onPanel,
  peopleCount = 0,
  smooth,
  onToggleSmooth,
  onTour,
  showJoystick,
  onToggleJoystick,
  pip,
  onTogglePip,
}) {
  const [rightOpen, setRightOpen] = useState(true);
  const hideLabels = useHideLabels();
  const { t } = useTranslation();
  const sound = useAmbience();
  const [leftOpen, setLeftOpen] = useState(true);

  const btn = {
    flex: 'none',
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
    transition: 'all 0.2s ease',
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
        {!hideLabels && (
          <div className="stay-white" style={{ ...glass, padding: '5px 16px', borderRadius: 99, fontSize: 13, fontWeight: 800, letterSpacing: '0.04em' }}>
            {zoneName(ALL_ZONES[focus]) || focus}
          </div>
        )}
        {!hideLabels && (
          <div className="stay-white" style={{ transition: 'opacity .2s', fontSize: 11, opacity: uiShown ? 0.7 : 0, textShadow: '0 1px 3px #000' }}>
            Drag to look around, tap a door to go through
          </div>
        )}
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

      {/* Floors + room map with smooth collapsible dropdown */}
      <div
        className="stay-white"
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          zIndex: 60,
          padding: '6px 8px',
          borderRadius: 14,
          ...glass,
          transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          minWidth: leftOpen ? 210 : 120,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header bar with Floor switch & Arrow dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: leftOpen ? 6 : 0 }}>
          {leftOpen ? (
            <div style={{ display: 'flex', gap: 4, flex: 1 }}>
              {[['Ground floor', 0], ['Upstairs', 1]].map(([label, f]) => (
                <button
                  key={f}
                  className="stay-white"
                  onClick={() => onSetFloor(f)}
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
                    transition: 'background 0.2s ease',
                  }}
                >
                  <Layers size={10} />{label}
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => setLeftOpen(true)}
              className="stay-white"
              title="Expand room navigation"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 4px',
              }}
            >
              <Layers size={12} color="#a56bff" />
              <span>{zoneName(ALL_ZONES[focus]) || 'Rooms'}</span>
            </button>
          )}

          <button
            className="stay-white"
            onClick={() => setLeftOpen(o => !o)}
            title={leftOpen ? 'Hide room navigation' : 'Show room navigation'}
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              border: '1px solid rgba(255,255,255,0.16)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 0.2s',
            }}
          >
            <ChevronDown
              size={14}
              style={{
                transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: leftOpen ? 'rotate(0deg)' : 'rotate(180deg)',
              }}
            />
          </button>
        </div>

        {/* Room grid with smooth collapsible height and opacity */}
        <div
          style={{
            maxHeight: leftOpen ? 180 : 0,
            opacity: leftOpen ? 1 : 0,
            overflow: 'hidden',
            transformOrigin: 'top left',
            transform: leftOpen ? 'scaleY(1)' : 'scaleY(0)',
            transition: 'max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: leftOpen ? 'auto' : 'none',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 4, paddingTop: 2 }}>
            {ZONES_BY_FLOOR[floor].slice().sort((a, b) => a.row - b.row || a.col - b.col).map(z => (
              <button
                key={z.id}
                className="stay-white"
                onClick={() => onFocusRoom(z.id)}
                title={goToText(z)}
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
                  transition: 'background 0.18s, border-color 0.18s',
                }}
              >
                {zoneName(z)}
                {counts[z.id] > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: 4, fontSize: 10 }}>
                    <Users size={9} />{counts[z.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Weather selection menu */}
      {wxOpen && rightOpen && (
        <div className="stay-white" style={{ position: 'absolute', bottom: 50, right: 54, zIndex: 61, display: 'flex', flexDirection: 'column', gap: 3, padding: 6, borderRadius: 12, ...glass }}>
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

      {/* Floating control buttons on right with smooth arrow collapse */}
      <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 60 }}>
        {/* Collapsible Action buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxHeight: rightOpen ? 'min(580px, calc(100vh - 80px))' : 0,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            padding: '2px 0',
            opacity: rightOpen ? 1 : 0,
            transform: rightOpen ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(24px)',
            transformOrigin: 'bottom center',
            transition: 'max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: rightOpen ? 'auto' : 'none',
          }}
        >
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
            onClick={toggleHideLabels}
            aria-pressed={hideLabels}
            title={hideLabels ? 'Show names and dots' : 'Hide names and dots'}
            style={{ ...btn, background: hideLabels ? 'rgba(139,92,255,0.75)' : btn.background }}
          >
            {hideLabels ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button
            className="stay-white"
            onClick={() => onPanel('people')}
            aria-pressed={panel === 'people'}
            title="Who is where"
            style={{ ...btn, position: 'relative', flex: 'none', background: panel === 'people' ? 'rgba(139,92,255,0.75)' : btn.background }}
          >
            <Users size={16} />
            {peopleCount > 1 && <span style={{ position: 'absolute', top: 1, right: 1, minWidth: 14, height: 14, borderRadius: 8, background: '#8b5cff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }}>{peopleCount}</span>}
          </button>
          <button
            className="stay-white"
            onClick={() => onPanel('emote')}
            aria-pressed={panel === 'emote'}
            title="Send a reaction"
            style={{ ...btn, flex: 'none', background: panel === 'emote' ? 'rgba(139,92,255,0.75)' : btn.background }}
          >
            <SmilePlus size={16} />
          </button>
          <button
            className="stay-white"
            onClick={() => onPanel('say')}
            aria-pressed={panel === 'say'}
            title={t('gamify.say.title', 'Say something')}
            aria-label={t('gamify.say.title', 'Say something')}
            style={{ ...btn, flex: 'none', background: panel === 'say' ? 'rgba(139,92,255,0.75)' : btn.background }}
          >
            <MessageCircle size={16} />
          </button>
          <button
            className="stay-white"
            onClick={onToggleJoystick}
            aria-pressed={showJoystick}
            title={showJoystick ? 'Hide on-screen joystick' : 'Show on-screen joystick (WASD / Touch)'}
            style={{ ...btn, flex: 'none', background: showJoystick ? 'rgba(139,92,255,0.75)' : btn.background }}
          >
            <Gamepad2 size={16} />
          </button>
          <button
            className="stay-white"
            onClick={onTogglePip}
            aria-pressed={pip}
            title={pip ? 'Dock video back to 3D TV' : 'Floating Picture-in-Picture (PiP) Video'}
            style={{ ...btn, flex: 'none', background: pip ? 'rgba(139,92,255,0.75)' : btn.background }}
          >
            <Tv size={16} />
          </button>
          <button
            className="stay-white"
            onClick={() => onPanel('sound')}
            aria-pressed={panel === 'sound'}
            title="Room sounds"
            style={{ ...btn, background: panel === 'sound' ? 'rgba(139,92,255,0.75)' : sound.on ? 'rgba(34,197,94,0.6)' : btn.background }}
          >
            {sound.on ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            className="stay-white"
            onClick={onToggleSmooth}
            aria-pressed={smooth}
            title={smooth ? 'Smooth mode is on (lighter graphics). Tap to go back to automatic.' : 'Smooth mode: lighter graphics for slower devices'}
            style={{ ...btn, flex: 'none', background: smooth ? 'rgba(34,197,94,0.75)' : btn.background }}
          >
            <Gauge size={16} />
          </button>
          <button className="stay-white" onClick={onPhoto} title={t('gamify.photo.take', 'Take a photo of this room')} aria-label={t('gamify.photo.take', 'Take a photo of this room')} style={{ ...btn, flex: 'none' }}>
            <Camera size={16} />
          </button>
          <button className="stay-white" onClick={onTour} title="How this works" style={{ ...btn, flex: 'none' }}>
            <HelpCircle size={16} />
          </button>
          <button className="stay-white" onClick={onResetView} title="Back to my room" style={{ ...btn, flex: 'none' }}>
            <Maximize2 size={16} />
          </button>
          <button className="stay-white" onClick={onZoomIn} title="Zoom in (+)" aria-label="Zoom in" style={{ ...btn, flex: 'none' }}>
            <ZoomIn size={16} />
          </button>
          <button className="stay-white" onClick={onZoomOut} title="Zoom out (-)" aria-label="Zoom out" style={{ ...btn, flex: 'none' }}>
            <ZoomOut size={16} />
          </button>
        </div>

        {/* Smooth Arrow dropdown toggle button: collapses all controls so everything disappears */}
        <button
          className="stay-white"
          onClick={() => setRightOpen(o => !o)}
          title={rightOpen ? 'Hide controls' : 'Show controls'}
          style={{
            ...btn,
            background: rightOpen ? 'rgba(12,10,24,0.72)' : 'rgba(139,92,255,0.85)',
            boxShadow: rightOpen ? 'none' : '0 0 16px rgba(139,92,255,0.6)',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <ChevronDown
            size={16}
            style={{
              transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              transform: rightOpen ? 'rotate(0deg)' : 'rotate(180deg)',
            }}
          />
        </button>
      </div>
    </>
  );
}
