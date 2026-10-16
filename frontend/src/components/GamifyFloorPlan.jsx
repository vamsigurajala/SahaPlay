import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Gamepad2 } from 'lucide-react';
import GamifyScene from './gamify/GamifyScene';
const PropViewer = React.lazy(() => import('./gamify/PropViewers'));
import Avatar3D from './gamify/Avatar3D';
import { ViewContext } from './gamify/parts';
import { DEFAULT_SPAWN, ALL_ZONES, STAIR_LINKS, FLOOR_Y } from '../data/gamifyZones';
import { SkyBackdrop, WEATHER, autoWeather, fetchLiveWeather } from './gamify/environment';
import { stopRadio } from './gamify/radioPlayer';
import GamifyRig, { MIN_ZOOM, MAX_ZOOM, clamp } from './gamify/GamifyRig';
import MirrorRoot from './gamify/GamifyMirror';
import TvProjector from './gamify/GamifyTvProjector';
import GamifyControls from './gamify/GamifyControls';

const FLIP_KEY = 'sp_gamify_flip';
const WEATHER_KEY = 'sp_gamify_weather';

class WebGLBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.warn('[GAMIFY] 3D view failed to start:', err?.message); }
  render() {
    if (this.state.failed) {
      return (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', padding: 24 }}>
          3D view isn't supported on this device — turn Gamify Mode off to go back to the normal player.
        </div>
      );
    }
    return this.props.children;
  }
}

function readFlip() {
  try { return localStorage.getItem(FLIP_KEY) === '1'; } catch { return false; }
}

const roomCenterTarget = (id, flip) => {
  const c = ALL_ZONES[id].center;
  return flip ? { x: c.z, z: c.x } : { x: c.x, z: c.z };
};

// The 3D social-space view Room.jsx swaps in for the video rectangle when
// Gamify Mode is on (loaded lazily — three.js is the heaviest dependency in
// the app and only matters to people who turn this on). One room fills the
// screen at a time; drag to roam to the next, or use a door / the room map.
export default function GamifyFloorPlan({ userList, mySocketId, avatarPositions, knownAvatars, hostId, onMove, onExitHouse, tvElementRef, onTvReady }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const myZoneRef = useRef(avatarPositions?.[mySocketId]?.zone || DEFAULT_SPAWN.zone);
  if (!viewRef.current) {
    const flip = readFlip();
    const t = roomCenterTarget(myZoneRef.current, flip);
    const floor0 = ALL_ZONES[myZoneRef.current]?.floor || 0;
    viewRef.current = { uiVisible: true, alwaysDots: false, openProp: null, zoom: 1, cur: 1, tx: t.x, tz: t.z, px: t.x, pz: t.z, floor: floor0, py: floor0 * FLOOR_Y, flip, focus: myZoneRef.current, doors: {}, glide: false, walk: null, vel: null, dragging: false, out: false, open: {} };
  }
  const dragLockRef = useRef(false);
  useEffect(() => stopRadio, []); // the house radio only plays while you are in the house
  const [flipped, setFlipped] = useState(() => viewRef.current.flip);
  const [focus, setFocus] = useState(() => viewRef.current.focus);
  const [zoomedOut, setZoomedOut] = useState(false);
  const [zoomedIn, setZoomedIn] = useState(false);
  const [floor, setFloor] = useState(() => viewRef.current.floor);
  const [weatherPref, setWeatherPref] = useState(() => { try { return localStorage.getItem(WEATHER_KEY) || 'auto'; } catch { return 'auto'; } });
  const [autoWx, setAutoWx] = useState(() => autoWeather());
  const [realWx, setRealWx] = useState(null);
  const [realWxLoading, setRealWxLoading] = useState(false);
  const [wxOpen, setWxOpen] = useState(false);
  const weather = weatherPref === 'real'
    ? (realWx || autoWx)
    : (weatherPref === 'auto' || !WEATHER[weatherPref] ? autoWx : weatherPref);
  const [myZone, setMyZone] = useState(() => myZoneRef.current);
  const [viewer, setViewer] = useState(null); // { kind: 'books'|'fridge'|'oven'|'stove', arg }
  const [uiShown, setUiShown] = useState(true);
  const [alwaysDots, setAlwaysDots] = useState(() => {
    try {
      return localStorage.getItem('sp_gamify_always_dots') === 'true';
    } catch {
      return false;
    }
  });

  // drei <Html> overlays (avatars, door buttons, signs) must not mount until the
  // canvas has rendered its first frame: mounted earlier, their DOM parent is
  // still changing, and the resulting unmount/remount race leaves some of them
  // missing for good.
  const [ready, setReady] = useState(false);
  // Phones/tablets: lighter render settings from the start, and PerformanceMonitor
  // drops further (no shadows, 1x pixels) if the frame rate is still poor.
  const coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
  const [lowQ, setLowQ] = useState(false);

  // Sync alwaysDots to viewRef
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.alwaysDots = alwaysDots;
      if (alwaysDots) {
        viewRef.current.uiVisible = true;
        setUiShown(true);
      }
    }
  }, [alwaysDots]);

  const toggleAlwaysDots = () => {
    setAlwaysDots((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sp_gamify_always_dots', String(next));
      } catch {}
      return next;
    });
  };

  // In-room labels (door buttons, prop chips, interactive dots) fade out after idle
  // seconds so they stop covering the scene. On phones / touch, tap anywhere reveals
  // them for 4.5 seconds so users can comfortably locate and tap them. An optional
  // always-on toggle keeps them permanently visible.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    let t;
    const show = () => {
      viewRef.current.uiVisible = true;
      setUiShown(true);
      clearTimeout(t);
      if (!viewRef.current.alwaysDots) {
        const dur = coarse ? 4500 : 3200;
        t = setTimeout(() => {
          if (!viewRef.current.alwaysDots) {
            viewRef.current.uiVisible = false;
            setUiShown(false);
          }
        }, dur);
      }
    };
    show();
    const evs = ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'touchend', 'keydown'];
    evs.forEach(e => el.addEventListener(e, show, { passive: true }));
    return () => { clearTimeout(t); evs.forEach(e => el.removeEventListener(e, show)); };
  }, [coarse, alwaysDots]);
  useEffect(() => { const t = setInterval(() => setAutoWx(autoWeather()), 60000); return () => clearInterval(t); }, []);

  // Fetch optional real weather for the user's location via Open-Meteo
  useEffect(() => {
    if (weatherPref !== 'real') return;
    let active = true;
    const loadReal = async () => {
      setRealWxLoading(true);
      let lat = 20;
      let lon = clamp(-new Date().getTimezoneOffset() / 4, -180, 180);
      try {
        const saved = JSON.parse(localStorage.getItem('sp_gamify_space_geo'));
        if (saved && typeof saved.lat === 'number') {
          lat = saved.lat;
          lon = saved.lon;
        }
      } catch {}

      if (navigator.geolocation && !localStorage.getItem('sp_gamify_space_geo')) {
        try {
          await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (p) => {
                lat = Math.round(p.coords.latitude * 100) / 100;
                lon = Math.round(p.coords.longitude * 100) / 100;
                try { localStorage.setItem('sp_gamify_space_geo', JSON.stringify({ lat, lon })); } catch {}
                resolve();
              },
              () => resolve(),
              { timeout: 5000 },
            );
          });
        } catch {}
      }

      const res = await fetchLiveWeather(lat, lon);
      if (active) {
        setRealWxLoading(false);
        if (res?.preset) {
          setRealWx(res.preset);
        }
      }
    };
    loadReal();
    const interval = setInterval(loadReal, 15 * 60 * 1000); // update every 15m
    return () => { active = false; clearInterval(interval); };
  }, [weatherPref]);

  const pickWeather = (k) => { setWeatherPref(k); setWxOpen(false); try { localStorage.setItem(WEATHER_KEY, k); } catch { /* private mode */ } };
  // Scene props (bookshelf, fridge) open their full-screen viewer through this hook.
  useEffect(() => {
    const v = viewRef.current;
    v.openProp = (kind, arg) => setViewer({ kind, arg });
    return () => { v.openProp = null; };
  }, []);

  // Wheel zoom: multiplicative (each tick scales by a fixed ratio) so it feels
  // the same at any zoom level. Native non-passive listener — React's onWheel
  // is passive, so preventDefault there silently no-ops and the page scrolls.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const v = viewRef.current;
      const rate = e.ctrlKey ? 0.012 : 0.0022; // trackpad pinch reports ctrlKey with small deltas
      v.zoom = clamp(v.zoom * Math.exp(-e.deltaY * rate), MIN_ZOOM, MAX_ZOOM);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // However far in you are, one tap gets you back: double-click / double-tap, Escape,
  // or the Zoom out pill all return to a one-room view.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const reset = () => { const v = viewRef.current; if (v.zoom > 1.05) v.zoom = 1; };
    const onKey = (e) => { if (e.key === 'Escape') reset(); };
    el.addEventListener('dblclick', reset);
    window.addEventListener('keydown', onKey);
    return () => { el.removeEventListener('dblclick', reset); window.removeEventListener('keydown', onKey); };
  }, []);

  // Glide the camera so room `id` fills the view.
  const focusRoom = (id, zoom = 1) => {
    const v = viewRef.current;
    const t = roomCenterTarget(id, v.flip);
    const f = ALL_ZONES[id].floor || 0;
    if (f !== v.floor) { v.floor = f; setFloor(f); }
    v.tx = t.x; v.tz = t.z; v.zoom = zoom; v.glide = true;
  };
  // A door: glide into the next room and, if that is where you were standing, walk through it.
  const goThroughDoor = (link) => {
    focusRoom(link.to);
    if (!link.dir) { const v = viewRef.current; (v.doors || (v.doors = {}))[[link.from, link.to].sort().join('|')] = performance.now() + 3000; }
    // A door only carries you if you are standing in that room; a staircase always does.
    if (link.dir || myZoneRef.current === link.from) {
      const f = ALL_ZONES[link.to].floor || 0;
      viewRef.current.walk = { x: link.entry.x, z: link.entry.z, floor: f, snap: f !== (ALL_ZONES[link.from].floor || 0) };
    }
  };
  const handleMove = (x, y, zone) => {
    if (zone !== myZoneRef.current) { myZoneRef.current = zone; setMyZone(zone); } // keeps the room map's head-count live
    if (onMove) onMove(x, y, zone);
  };
  // Dropping your avatar into another room brings the camera along.
  const handleDrop = (zone) => { if (zone !== viewRef.current.focus) focusRoom(zone, viewRef.current.zoom); };

  // Take the stairs from anywhere: camera and your avatar go to the other floor.
  const goToFloor = (f) => {
    const v = viewRef.current;
    // Already on that floor: just bring the camera back to your own room.
    if ((ALL_ZONES[myZoneRef.current]?.floor || 0) === f) { focusRoom(myZoneRef.current); return; }
    const link = STAIR_LINKS.find(l => (f ? l.from === 'hall' : l.from === 'f2hall'));
    focusRoom(link.to);
    v.walk = { x: link.entry.x, z: link.entry.z, floor: f, snap: true };
  };
  const changeFloor = () => goToFloor(viewRef.current.floor === 0 ? 1 : 0);
  viewRef.current.changeFloor = changeFloor;
  const zoomBy = (ratio) => { const v = viewRef.current; v.zoom = clamp(v.zoom * ratio, MIN_ZOOM, MAX_ZOOM); };
  const resetView = () => focusRoom(myZoneRef.current);
  const toggleFlip = () => {
    const v = viewRef.current;
    const next = !v.flip;
    v.flip = next;
    // The mirrored world is the old one reflected across x=z, so swap the camera
    // target too — otherwise a panned view would jump to a different spot.
    [v.tx, v.tz] = [v.tz, v.tx];
    [v.px, v.pz] = [v.pz, v.px];
    setFlipped(next);
    try { localStorage.setItem(FLIP_KEY, next ? '1' : '0'); } catch { /* private mode etc. */ }
  };

  const counts = useMemo(() => {
    const c = {};
    // Your own moves are not echoed back through avatarPositions, so use the live local zone for you.
    userList.forEach(u => { const z = u.socketId === mySocketId ? myZone : (avatarPositions?.[u.socketId]?.zone || DEFAULT_SPAWN.zone); c[z] = (c[z] || 0) + 1; });
    return c;
  }, [userList, avatarPositions, myZone, mySocketId]);

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0b0a14', touchAction: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: ready ? 1 : 0, transition: 'opacity .5s' }}><SkyBackdrop weather={weather} /></div>
      {!ready && (
        <div className="stay-white" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 13, fontWeight: 700, zIndex: 5, pointerEvents: 'none' }}><Gamepad2 size={30} />Building your house...</div>
      )}
      <WebGLBoundary>
        <Canvas
          orthographic
          shadows={!lowQ}
          dpr={lowQ ? 1 : [1, coarse ? 1.25 : 1.5]}
          camera={{ position: [18, 15.5, 18], zoom: 30, near: -120, far: 320 }}
          gl={{ antialias: true, alpha: true }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <ViewContext.Provider value={viewRef}>
            <PerformanceMonitor onDecline={() => setLowQ(true)} flipflops={2} />
            <GamifyRig viewRef={viewRef} dragLockRef={dragLockRef} onFocusChange={setFocus} onOutChange={setZoomedOut} onInChange={setZoomedIn} onReady={() => setReady(true)} />
            <MirrorRoot>
              <GamifyScene onGoToRoom={goThroughDoor} onExitHouse={onExitHouse} focus={ready ? focus : null} zoomedOut={ready && zoomedOut} lowQ={lowQ} coarse={coarse} weather={weather} />
              {ready && userList.map(user => {
                const pos = avatarPositions?.[user.socketId] || DEFAULT_SPAWN;
                const own = user.socketId === mySocketId;
                return (
                  <Avatar3D
                    key={user.socketId}
                    username={user.username}
                    avatarPath={knownAvatars?.[user.username] || user.avatarPath}
                    isHost={user.isHost || user.socketId === hostId}
                    isOwn={own}
                    x={pos.x}
                    y={pos.y}
                    zone={own ? myZone : pos.zone}
                    onMove={own ? handleMove : undefined}
                    onDrop={own ? handleDrop : undefined}
                    dragLockRef={dragLockRef}
                  />
                );
              })}
            </MirrorRoot>
            <TvProjector tvElementRef={tvElementRef} onTvReady={onTvReady} />
          </ViewContext.Provider>
        </Canvas>
      </WebGLBoundary>

      <GamifyControls
        focus={focus}
        floor={floor}
        uiShown={uiShown}
        zoomedIn={zoomedIn}
        counts={counts}
        weather={weather}
        weatherPref={weatherPref}
        autoWx={autoWx}
        realWx={realWx}
        realWxLoading={realWxLoading}
        wxOpen={wxOpen}
        flipped={flipped}
        alwaysDots={alwaysDots}
        onChangeFloor={changeFloor}
        onSetFloor={goToFloor}
        onFocusRoom={focusRoom}
        onResetZoom={() => { viewRef.current.zoom = 1; }}
        onToggleWx={() => setWxOpen(o => !o)}
        onPickWeather={pickWeather}
        onToggleFlip={toggleFlip}
        onToggleAlwaysDots={toggleAlwaysDots}
        onResetView={resetView}
        onZoomIn={() => zoomBy(1.3)}
        onZoomOut={() => zoomBy(1 / 1.3)}
      />

      {viewer && (
        <React.Suspense fallback={null}>
          <PropViewer kind={viewer.kind} arg={viewer.arg} onClose={() => setViewer(null)} />
        </React.Suspense>
      )}
    </div>
  );
}
