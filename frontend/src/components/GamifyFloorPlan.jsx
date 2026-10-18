import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Gamepad2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBackIntercept } from '../hooks/useBackIntercept';
import PhotoRig from './gamify/GamifyPhoto';
import { zoneName } from './gamify/gamifyText';
import GamifyScene from './gamify/GamifyScene';
const PropViewer = React.lazy(() => import('./gamify/PropViewers'));
import Avatar3D from './gamify/Avatar3D';
import { ViewContext } from './gamify/parts';
import { DEFAULT_SPAWN, ALL_ZONES, STAIR_LINKS, FLOOR_Y, virtualToWorld } from '../data/gamifyZones';
import { SkyBackdrop, WEATHER, autoWeather, fetchLiveWeather } from './gamify/environment';
import { stopRadio } from './gamify/radioPlayer';
import { stopCalm } from './gamify/calmMusic';
import { setAmbienceZone, stopAmbience, resumeAmbience, playSfx } from './gamify/ambience';
import QuickAccess from './gamify/QuickAccess';
import AmbiencePanel from './gamify/AmbiencePanel';
import DailyPanel from './gamify/DailyPanel';
import { gameOfTheDay } from './gamify/dailyGame';
import CalmMusicDock from './gamify/CalmMusicDock';
import GamifyRig, { MIN_ZOOM, MAX_ZOOM, clamp } from './gamify/GamifyRig';
import MirrorRoot from './gamify/GamifyMirror';
import TvProjector from './gamify/GamifyTvProjector';
import GamifyControls from './gamify/GamifyControls';
import GamifyTour, { tourSeen } from './gamify/GamifyTour';
import GamifyPeople from './gamify/GamifyPeople';
import EmotePicker from './gamify/EmotePicker';
import SayBox from './gamify/SayBox';
import VirtualJoystick from './gamify/VirtualJoystick';

const FLIP_KEY = 'sp_gamify_flip';
const WEATHER_KEY = 'sp_gamify_weather';
const SMOOTH_KEY = 'sp_gamify_smooth';
const LAST_ZONE_KEY = 'sp_gamify_last_zone';

class WebGLBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.warn('[GAMIFY] 3D view failed to start:', err?.message); }
  render() {
    if (this.state.failed) {
      return (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', padding: 24, gap: 12 }}>
          <span>3D view isn't supported on this device — turn Gamify Mode off to go back to the normal player.</span>
          {this.props.onExitHouse && (
            <button onClick={this.props.onExitHouse} style={{ padding: '8px 18px', borderRadius: 10, background: '#8b5cff', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Exit Gamify Mode
            </button>
          )}
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
export default function GamifyFloorPlan({ userList, mySocketId, avatarPositions, knownAvatars, hostId, emotes, says, wave, speakingIds, onMove, onEmote, onSay, onWave, onExitHouse, tvElementRef, onTvReady }) {
  const { t } = useTranslation();
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
  useEffect(() => () => { stopRadio(); stopCalm(); stopAmbience(); }, []); // the radio and the calm music only play while you are in the house
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
  // Mobile swipe-back cleanly closes open bookshelf, fridge, or in-house minigames
  useBackIntercept(viewer ? 1 : 0, (newLevel) => {
    if (newLevel === 0) setViewer(null);
  });
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
  // Fallback safety: guarantee ready flips to true even if useFrame in GamifyRig is delayed by phone layout or GPU init
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(t);
  }, []);
  // Phones/tablets: lighter render settings from the start, and PerformanceMonitor
  // drops further (no shadows, 1x pixels) if the frame rate is still poor.
  const coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
  const [autoLow, setAutoLow] = useState(false);
  // Smooth mode: the person asked for lighter graphics. Otherwise it is automatic.
  const [smooth, setSmooth] = useState(() => { try { return localStorage.getItem(SMOOTH_KEY) === '1'; } catch { return false; } });
  const lowQ = smooth || autoLow;
  const toggleSmooth = () => setSmooth(prev => { const next = !prev; try { localStorage.setItem(SMOOTH_KEY, next ? '1' : '0'); } catch { /* ignore */ } return next; });
  const [panel, setPanel] = useState(null); // 'people' | 'emote' | null
  const togglePanel = (name) => setPanel(p => (p === name ? null : name));
  const [tourOpen, setTourOpen] = useState(false);
  const [ownEmote, setOwnEmote] = useState(null);
  const myName = userList.find(u => u.socketId === mySocketId)?.username;

  const [showJoystick, setShowJoystick] = useState(false);

  const [pip, setPip] = useState(false);
  const togglePip = useCallback(() => {
    setPip(p => {
      const next = !p;
      if (viewRef.current) viewRef.current.pip = next;
      return next;
    });
  }, [viewRef]);

  const onJoystickMove = useCallback((nx, ny) => {
    if (viewRef.current) {
      viewRef.current.joystick = { x: nx, y: ny };
    }
  }, [viewRef]);

  const onJoystickStop = useCallback(() => {
    if (viewRef.current) {
      viewRef.current.joystick = null;
    }
  }, [viewRef]);

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

  // Keypad & keyboard zoom shortcuts (+, -, 0, Escape)
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      const v = viewRef.current;
      if (!v) return;
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        v.zoom = clamp(v.zoom * 1.25, MIN_ZOOM, MAX_ZOOM);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        v.zoom = clamp(v.zoom / 1.25, MIN_ZOOM, MAX_ZOOM);
      } else if (e.key === '0') {
        v.zoom = 1;
      } else if (e.key === 'Escape') {
        if (v.zoom > 1.05) v.zoom = 1;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
    playSfx('door');
    focusRoom(link.to);
    if (!link.dir) { const v = viewRef.current; (v.doors || (v.doors = {}))[[link.from, link.to].sort().join('|')] = performance.now() + 3000; }
    // A door only carries you if you are standing in that room; a staircase always does.
    if (link.dir || myZoneRef.current === link.from) {
      const f = ALL_ZONES[link.to].floor || 0;
      viewRef.current.walk = { x: link.entry.x, z: link.entry.z, floor: f, snap: f !== (ALL_ZONES[link.from].floor || 0) };
    }
  };
  const handleMove = (x, y, zone) => {
    if (zone !== myZoneRef.current) {
      myZoneRef.current = zone; setMyZone(zone); // keeps the room map's head-count live
      try { localStorage.setItem(LAST_ZONE_KEY, zone); } catch { /* ignore */ }
    }
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
  const zoomBy = (ratio) => { const v = viewRef.current; if (v) v.zoom = clamp(v.zoom * ratio, MIN_ZOOM, MAX_ZOOM); };
  const resetView = () => focusRoom(myZoneRef.current, 1);
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

  // Walk over to someone: bring the camera to their room and stand beside them.
  const goToPerson = (person) => {
    const pos = avatarPositions?.[person.socketId] || DEFAULT_SPAWN;
    const w = virtualToWorld(pos.x, pos.y);
    const f = ALL_ZONES[pos.zone]?.floor || 0;
    const myFloor = ALL_ZONES[myZoneRef.current]?.floor || 0;
    focusRoom(pos.zone);
    viewRef.current.walk = { x: w.x + 1.1, z: w.z + 0.7, floor: f, snap: f !== myFloor };
    setPanel(null);
  };
  const [ownSay, setOwnSay] = useState(null);
  const sendSay = (text) => {
    setOwnSay({ text, n: Date.now() });
    if (onSay) onSay(text);
  };
  // Tap on someone: wave at them. You see your own hand, they get a notice.
  const waveAt = (socketId) => {
    if (onWave) onWave(socketId);
    setOwnEmote({ id: 'wave', n: Date.now() });
    const who = userList.find(u => u.socketId === socketId)?.username || '';
    setNotice({ text: t('gamify.wave.sent', { defaultValue: 'You waved at {{name}}', name: who }) });
  };
  const waveRef = useRef(waveAt);
  waveRef.current = waveAt;
  const stableWave = useCallback((id) => waveRef.current(id), []);
  // Someone waved at you: tell them, with buttons to wave back or go to them.
  useEffect(() => {
    if (!wave) return;
    playSfx('join');
    setNotice({ text: t('gamify.wave.got', { defaultValue: '{{name}} waved at you', name: wave.name || '' }), person: { socketId: wave.from }, back: wave.from });
  }, [wave]); // eslint-disable-line react-hooks/exhaustive-deps
  const sendEmote = (id) => {
    setOwnEmote({ id, n: Date.now() });
    if (onEmote) onEmote(id);
    setPanel(null);
  };

  // A small notice at the bottom: someone arrived, a photo was saved.
  const [notice, setNotice] = useState(null); // { text, person? }
  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(() => setNotice(null), notice.person ? 8000 : 2500);
    return () => clearTimeout(id);
  }, [notice]);
  // Somebody new walked into the house: say so, with a button to go to them.
  const seenRef = useRef(null);
  useEffect(() => {
    const ids = new Set(userList.map(u => u.socketId));
    const prev = seenRef.current;
    seenRef.current = ids;
    if (!prev) return;
    const fresh = userList.find(u => !prev.has(u.socketId) && u.socketId !== mySocketId);
    if (fresh) {
      playSfx('join');
      setNotice({
        text: t('gamify.join.joined', { defaultValue: '{{name}} joined the house', name: fresh.username }),
        person: { socketId: fresh.socketId },
        canWave: fresh.socketId,
      });
    }
  }, [userList]); // eslint-disable-line react-hooks/exhaustive-deps
  const takePhoto = async () => {
    const v = viewRef.current;
    if (!v.snap) return;
    const names = {};
    userList.forEach(u => { names[u.socketId] = u.username; });
    const blob = await v.snap({ names, me: mySocketId, room: zoneName(ALL_ZONES[v.focus]), date: new Date().toLocaleDateString() });
    if (!blob) return;
    const file = new File([blob], 'sahaplay-house.png', { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
    } catch { /* cancelled or not allowed: fall back to a download */ }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setNotice({ text: t('gamify.photo.saved', 'Photo saved') });
  };

  // People for the "who is where" panel.
  const people = useMemo(() => userList.map(u => ({
    socketId: u.socketId,
    username: u.username,
    avatarPath: knownAvatars?.[u.username] || u.avatarPath,
    isHost: u.isHost || u.socketId === hostId,
    own: u.socketId === mySocketId,
    zone: u.socketId === mySocketId ? myZone : (avatarPositions?.[u.socketId]?.zone || DEFAULT_SPAWN.zone),
  })), [userList, knownAvatars, hostId, mySocketId, myZone, avatarPositions]);

  // The first visit gets a short tour once the house has appeared.
  useEffect(() => {
    if (!ready || tourSeen()) return undefined;
    const t = setTimeout(() => setTourOpen(true), 1200);
    return () => clearTimeout(t);
  }, [ready]);

  // First time in the house (no position yet): go to the room you were last in, or the
  // living room. Either way you are placed beside anyone already standing there, and that
  // spot is sent out so everyone sees you where you are instead of stacked at the spawn.
  useEffect(() => {
    if (!ready) return;
    resumeAmbience();
    if (avatarPositions?.[mySocketId]) return;
    let saved = null;
    try { saved = localStorage.getItem(LAST_ZONE_KEY); } catch { /* ignore */ }
    if (saved && ALL_ZONES[saved] && saved !== myZoneRef.current) {
      const c = ALL_ZONES[saved].center;
      focusRoom(saved);
      viewRef.current.walk = { x: c.x, z: c.z, floor: ALL_ZONES[saved].floor || 0, snap: true };
    } else {
      const w = virtualToWorld(DEFAULT_SPAWN.x, DEFAULT_SPAWN.y);
      viewRef.current.walk = { x: w.x, z: w.z, floor: ALL_ZONES[myZoneRef.current]?.floor || 0, snap: true };
    }
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Room sounds follow the room the camera is in.
  useEffect(() => { setAmbienceZone(focus); }, [focus]);

  // The scene is memoised, so it is given callbacks that never change identity.
  const goRef = useRef(null);
  const exitRef = useRef(null);
  goRef.current = goThroughDoor;
  exitRef.current = onExitHouse;
  const stableGo = useCallback((link) => goRef.current?.(link), []);
  const stableExit = useCallback(() => exitRef.current?.(), []);
  const moveRef = useRef(null);
  const dropRef = useRef(null);
  moveRef.current = handleMove;
  dropRef.current = handleDrop;
  const stableMove = useCallback((x, y, zone) => moveRef.current?.(x, y, zone), []);
  const stableDrop = useCallback((zone) => dropRef.current?.(zone), []);

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
      <WebGLBoundary onExitHouse={stableExit}>
        <Canvas
          orthographic
          shadows={!lowQ}
          dpr={lowQ ? 1 : [1, coarse ? 1.25 : 1.5]}
          // A full-screen viewer (a game, a shop) covers the house, so stop drawing it behind.
          frameloop={viewer ? 'never' : 'always'}
          camera={{ position: [18, 15.5, 18], zoom: 30, near: -250, far: 600 }}
          gl={{ antialias: !coarse, alpha: true, powerPreference: coarse ? 'default' : 'high-performance' }}
          style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
        >
          <ViewContext.Provider value={viewRef}>
            <PhotoRig />
            <PerformanceMonitor onDecline={() => setAutoLow(true)} flipflops={2} />
            <GamifyRig viewRef={viewRef} dragLockRef={dragLockRef} onFocusChange={setFocus} onOutChange={setZoomedOut} onInChange={setZoomedIn} onReady={() => setReady(true)} />
            <MirrorRoot>
              <GamifyScene onGoToRoom={stableGo} onExitHouse={stableExit} focus={ready ? focus : null} zoomedOut={ready && zoomedOut} lowQ={lowQ} coarse={coarse} weather={weather} />
              {ready && userList.map(user => {
                const pos = avatarPositions?.[user.socketId] || DEFAULT_SPAWN;
                const own = user.socketId === mySocketId;
                return (
                  <Avatar3D
                    key={user.socketId}
                    avatarId={user.socketId}
                    username={user.username}
                    avatarPath={knownAvatars?.[user.username] || user.avatarPath}
                    isHost={user.isHost || user.socketId === hostId}
                    isOwn={own}
                    speaking={speakingIds ? speakingIds.has(own ? 'local' : user.socketId) : false}
                    x={pos.x}
                    y={pos.y}
                    zone={own ? myZone : pos.zone}
                    emote={own ? ownEmote : emotes?.[user.socketId]}
                    say={own ? ownSay : says?.[user.socketId]}
                    onWave={own ? undefined : stableWave}
                    onMove={own ? stableMove : undefined}
                    onDrop={own ? stableDrop : undefined}
                    dragLockRef={dragLockRef}
                  />
                );
              })}
            </MirrorRoot>
            <TvProjector tvElementRef={tvElementRef} onTvReady={onTvReady} />
          </ViewContext.Provider>
        </Canvas>
      </WebGLBoundary>

      <CalmMusicDock />
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
        onExitHouse={stableExit}
        panel={panel}
        onPanel={togglePanel}
        peopleCount={userList.length}
        smooth={smooth}
        onToggleSmooth={toggleSmooth}
        onTour={() => { setPanel(null); setTourOpen(true); }}
        onPhoto={takePhoto}
        showJoystick={showJoystick}
        onToggleJoystick={() => setShowJoystick(s => !s)}
        pip={pip}
        onTogglePip={togglePip}
      />
      {showJoystick && !viewer && (
        <VirtualJoystick
          onMove={onJoystickMove}
          onStop={onJoystickStop}
          visible={true}
        />
      )}
      {notice && (
        <div
          className="stay-white"
          role="status"
          style={{
            position: 'absolute',
            left: '50%',
            top: 'max(72px, calc(env(safe-area-inset-top) + 64px))',
            transform: 'translateX(-50%)',
            zIndex: 90,
            width: 'min(360px, calc(100vw - 28px))',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 18,
            background: 'rgba(14, 11, 28, 0.94)',
            border: '1.5px solid rgba(139, 92, 246, 0.55)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.6), 0 0 24px rgba(139,92,246,0.25)',
            backdropFilter: 'blur(16px)',
            color: '#fff',
            animation: 'gp-fade 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Top row: Avatar icon, aligned text, and close button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.3))',
                border: '1.5px solid rgba(255,255,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              👋
            </div>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {notice.text}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>
                {notice.back
                  ? t('gamify.wave.hint', 'Waved at you just now')
                  : notice.canWave || notice.person
                  ? t('gamify.join.hint', 'Just joined the house')
                  : t('gamify.house.notice', 'Social Space')}
              </div>
            </div>

            <button
              onClick={() => setNotice(null)}
              aria-label={t('gamify.close', 'Close')}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: 'none',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.15s ease',
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Action buttons row if waving or navigation is possible */}
          {(notice.back || notice.canWave || notice.person) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              {(notice.back || notice.canWave) && (
                <button
                  onClick={() => {
                    const targetId = notice.back || notice.canWave;
                    waveAt(targetId);
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(245,158,11,0.35)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>👋</span>
                  <span>{notice.back ? t('gamify.wave.back', 'Wave back') : t('gamify.wave.wave_at', 'Wave at them')}</span>
                </button>
              )}

              {notice.person && (
                <button
                  onClick={() => {
                    goToPerson(notice.person);
                    setNotice(null);
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(139,92,246,0.35)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>📍</span>
                  <span>{t('gamify.join.go', 'Go to them')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {panel === 'people' && <GamifyPeople people={people} onGo={goToPerson} onClose={() => setPanel(null)} />}
      {panel === 'emote' && <EmotePicker onPick={sendEmote} />}
      {panel === 'say' && <SayBox onSend={sendSay} />}
      {panel === 'sound' && <AmbiencePanel onClose={() => setPanel(null)} />}
      {panel === 'daily' && <DailyPanel me={myName} onPlay={() => { setPanel(null); viewRef.current.openProp?.('game', gameOfTheDay()); }} onClose={() => setPanel(null)} />}
      <QuickAccess onOpen={(kind, arg) => viewRef.current.openProp?.(kind, arg)} onDaily={() => togglePanel('daily')} dailyOpen={panel === 'daily'} />
      <GamifyTour open={tourOpen} onClose={() => setTourOpen(false)} />

      {viewer && (
        <React.Suspense fallback={null}>
          <PropViewer kind={viewer.kind} arg={viewer.arg} onClose={() => setViewer(null)} />
        </React.Suspense>
      )}
    </div>
  );
}
