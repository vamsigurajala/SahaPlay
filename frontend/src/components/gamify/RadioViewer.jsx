import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useTranslation } from 'react-i18next';
import { Radio, Play, Pause, Search, Shuffle, Volume2, Square, Loader2, MapPin, AlertTriangle, Globe2 } from 'lucide-react';
import { FALLBACK_STATIONS, fetchGlobeStations, playStation, searchStations, setRadioVolume, stopRadio, toggleRadio, useRadio } from './radioPlayer';

// World Radio: spin the globe, tap a glowing dot, and listen to a live station from
// that part of the world (stations come from the open radio-browser.info directory).

const R = 1;
const toVec = (lat, lon, r = R) => {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
};

const km = (a, b) => {
  const rad = Math.PI / 180;
  const d = Math.acos(Math.min(1, Math.max(-1, Math.sin(a.lat * rad) * Math.sin(b.lat * rad) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((a.lon - b.lon) * rad))));
  return d * 6371;
};

function Dot({ s, selected, playing, onPick }) {
  const ref = useRef();
  const pos = useMemo(() => toVec(s.lat, s.lon, R * 1.012), [s.lat, s.lon]);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const base = selected ? 0.03 : 0.015;
    const pulse = selected ? 1 + 0.25 * Math.sin(state.clock.elapsedTime * 6) : 1;
    m.scale.setScalar(base * pulse);
  });
  return (
    <mesh ref={ref} position={pos} onClick={(e) => { e.stopPropagation(); if (e.delta < 6) onPick(s); }} onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color={playing ? '#4ade80' : selected ? '#ff5a8a' : '#ffd36b'} toneMapped={false} />
    </mesh>
  );
}

function Ripple({ s }) {
  const ref = useRef();
  const { pos, quat } = useMemo(() => {
    const p = toVec(s.lat, s.lon, R * 1.015);
    return { pos: p, quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), p.clone().normalize()) };
  }, [s.lat, s.lon]);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const u = (state.clock.elapsedTime * 0.8) % 1;
    m.scale.setScalar(0.03 + u * 0.12);
    m.material.opacity = (1 - u) * 0.8;
  });
  return (
    <mesh ref={ref} position={pos} quaternion={quat}>
      <ringGeometry args={[0.8, 1, 32]} />
      <meshBasicMaterial color="#4ade80" transparent opacity={0.8} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}

// Glide the camera round to whichever station was just picked.
function FlyTo({ target }) {
  const { camera } = useThree();
  const goal = useRef(null);
  useEffect(() => { goal.current = target ? toVec(target.lat, target.lon).normalize() : null; }, [target]);
  useFrame((_, dt) => {
    const g = goal.current;
    if (!g) return;
    const dist = camera.position.length();
    const want = g.clone().multiplyScalar(dist);
    camera.position.lerp(want, 1 - Math.exp(-Math.min(dt, 0.1) * 4));
    if (camera.position.clone().normalize().angleTo(g) < 0.02) goal.current = null;
  });
  return null;
}

function Globe({ stations, selected, playingId, onPick }) {
  const [tex, setTex] = useState(null);
  useEffect(() => {
    let live = true;
    new THREE.TextureLoader().load('/images/gamify/space/earth.jpg', (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (live) setTex(t); });
    return () => { live = false; };
  }, []);
  return (
    <>
      <ambientLight intensity={1.15} />
      <directionalLight position={[3, 2, 4]} intensity={1.6} />
      <mesh onClick={(e) => e.stopPropagation()}>
        <sphereGeometry args={[R, 64, 48]} />
        <meshStandardMaterial key={tex ? 'earth' : 'plain'} map={tex} color={tex ? '#ffffff' : '#1c4f9a'} roughness={0.9} />
      </mesh>
      <mesh scale={1.07}>
        <sphereGeometry args={[R, 48, 36]} />
        <meshBasicMaterial color="#4f9bff" transparent opacity={0.1} side={THREE.BackSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {stations.map(s => <Dot key={s.id} s={s} selected={selected && selected.id === s.id} playing={playingId === s.id} onPick={onPick} />)}
      {selected && !stations.some(s => s.id === selected.id) && <Dot s={selected} selected playing={playingId === selected.id} onPick={onPick} />}
      {selected && playingId === selected.id && <Ripple s={selected} />}
      <FlyTo target={selected} />
      <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} minDistance={1.6} maxDistance={4} rotateSpeed={0.6} zoomSpeed={0.7} autoRotate={!selected} autoRotateSpeed={0.5} />
    </>
  );
}

const EQ_CSS = `
@keyframes radio-eq { 0%,100% { transform: scaleY(.25) } 50% { transform: scaleY(1) } }
@keyframes radio-spin { to { transform: rotate(360deg) } }
`;

function Equalizer({ on }) {
  return (
    <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 3, height: 22 }}>
      {[0.9, 0.6, 1.1, 0.75, 1.0].map((d, i) => <span key={i} style={{ width: 4, height: 22, borderRadius: 2, background: '#4ade80', transformOrigin: 'bottom', transform: 'scaleY(.25)', animation: on ? `radio-eq ${d}s ease-in-out ${i * 0.1}s infinite` : 'none' }} />)}
    </span>
  );
}

const card = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 18 };

export default function RadioViewer() {
  const { t } = useTranslation();
  const radio = useRadio();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState(() => radio.station);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let live = true;
    fetchGlobeStations()
      .then(list => { if (live) { setStations(list); setLoading(false); } })
      .catch(() => { if (live) { setStations(FALLBACK_STATIONS); setOffline(true); setLoading(false); } });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults(null); setSearching(false); return undefined; }
    setSearching(true);
    let live = true;
    const timer = setTimeout(() => {
      searchStations(q).then(r => { if (live) { setResults(r); setSearching(false); } }).catch(() => { if (live) { setResults([]); setSearching(false); } });
    }, 450);
    return () => { live = false; clearTimeout(timer); };
  }, [query]);

  const pick = (s) => { setSelected(s); playStation(s); };
  const surprise = () => { if (stations.length) pick(stations[Math.floor(Math.random() * stations.length)]); };
  const near = useMemo(() => {
    if (!selected || selected.lat == null) return [];
    return stations.filter(s => s.id !== selected.id).map(s => ({ s, d: km(selected, s) })).sort((a, b) => a.d - b.d).slice(0, 6);
  }, [stations, selected]);

  const cur = radio.station;
  const status = radio.status;
  const globeSel = selected && selected.lat != null ? selected : null;
  const statusText = status === 'loading' ? t('gamify.radio.connecting', 'Tuning in...') : status === 'playing' ? t('gamify.radio.live', 'Live now') : status === 'paused' ? t('gamify.radio.paused', 'Paused') : status === 'error' ? radio.error : t('gamify.radio.idle', 'Tap a glowing dot on the globe');

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 1100, color: '#fff', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{EQ_CSS}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(145deg,#c2783a,#8a4a1e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Radio size={26} /></div>
        <div>
          <div style={{ fontSize: 'clamp(20px,4.5vw,28px)', fontWeight: 900, lineHeight: 1.1 }}>{t('gamify.radio.title', 'World Radio')}</div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>{t('gamify.radio.sub', 'Spin the globe and listen to live radio from anywhere on Earth')}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <div style={{ ...card, flex: '1 1 440px', minHeight: 320, height: 'min(58vh, 520px)', position: 'relative', overflow: 'hidden', background: 'radial-gradient(circle at 50% 40%, #12224a, #060a1c)' }}>
          <Canvas camera={{ position: [0, 0.4, 2.9], fov: 42 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
            <Globe stations={stations} selected={globeSel} playingId={status === 'playing' && cur ? cur.id : null} onPick={pick} />
          </Canvas>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 800, pointerEvents: 'none' }}>
              <Loader2 size={18} style={{ animation: 'radio-spin 1s linear infinite' }} />{t('gamify.radio.loading', 'Finding stations...')}
            </div>
          )}
          <div style={{ position: 'absolute', left: 10, bottom: 8, fontSize: 11.5, opacity: 0.7, display: 'flex', alignItems: 'center', gap: 5, pointerEvents: 'none' }}><Globe2 size={13} />{t('gamify.radio.hint', 'Drag to spin, pinch or scroll to zoom')}</div>
        </div>

        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Equalizer on={status === 'playing'} />
              <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: status === 'error' ? '#ff8a8a' : '#4ade80' }}>{status === 'idle' ? t('gamify.radio.ready', 'Ready') : statusText}</span>
            </div>
            <div style={{ minHeight: 56 }}>
              <div style={{ fontSize: 19, fontWeight: 900, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{cur ? cur.name : t('gamify.radio.none', 'No station selected')}</div>
              {cur ? (
                <div style={{ fontSize: 13, opacity: 0.75, marginTop: 3, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {cur.country && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={12} />{cur.country}</span>}
                  {cur.tags && <span>{cur.tags}</span>}
                  {cur.bitrate > 0 && <span>{cur.bitrate} kbps</span>}
                </div>
              ) : <div style={{ fontSize: 13, opacity: 0.7, marginTop: 3 }}>{statusText}</div>}
            </div>
            {status === 'error' && <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: '#ffb3b3' }}><AlertTriangle size={14} />{radio.error}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={toggleRadio} disabled={!cur} aria-label={status === 'playing' || status === 'loading' ? 'Pause' : 'Play'} style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: cur ? 'pointer' : 'default', opacity: cur ? 1 : 0.4, background: '#8b5cff', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {status === 'loading' ? <Loader2 size={22} style={{ animation: 'radio-spin 1s linear infinite' }} /> : status === 'playing' ? <Pause size={22} /> : <Play size={22} />}
              </button>
              <button onClick={() => { stopRadio(); setSelected(null); }} disabled={!cur} aria-label="Stop radio" style={{ ...ghost, opacity: cur ? 1 : 0.4 }}><Square size={14} />{t('gamify.radio.stop', 'Stop')}</button>
              <button onClick={surprise} disabled={!stations.length} style={ghost}><Shuffle size={14} />{t('gamify.radio.surprise', 'Surprise me')}</button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, opacity: 0.9 }}>
              <Volume2 size={16} />
              <input type="range" min="0" max="1" step="0.02" value={radio.volume} onChange={(e) => setRadioVolume(Number(e.target.value))} aria-label="Volume" style={{ flex: 1, accentColor: '#8b5cff' }} />
            </label>
          </div>

          <div style={{ ...card, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, flex: 1 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 12, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.14)' }}>
              <Search size={15} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('gamify.radio.search', 'Search a station or city')} aria-label="Search stations" style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14 }} />
              {searching && <Loader2 size={14} style={{ animation: 'radio-spin 1s linear infinite' }} />}
            </label>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.6 }}>
              {results ? t('gamify.radio.results', 'Search results') : near.length ? t('gamify.radio.near', 'Near this station') : offline ? t('gamify.radio.featured', 'Featured stations') : t('gamify.radio.popular', 'Popular stations')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 220 }}>
              {(results || (near.length ? near.map(n => n.s) : stations.slice(0, 8))).map(s => (
                <button key={s.id} onClick={() => pick(s)} style={{ textAlign: 'left', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '8px 10px', cursor: 'pointer', color: '#fff', background: cur && cur.id === s.id ? 'rgba(139,92,255,0.35)' : 'rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontWeight: 800, fontSize: 13.5, overflowWrap: 'anywhere' }}>{s.name}</span>
                  <span style={{ fontSize: 11.5, opacity: 0.7 }}>{[s.country, s.tags].filter(Boolean).join(' | ')}</span>
                </button>
              ))}
              {results && !results.length && !searching && <div style={{ fontSize: 13, opacity: 0.7, padding: 6 }}>{t('gamify.radio.nothing', 'No stations found. Try another word.')}</div>}
            </div>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11.5, opacity: 0.55, textAlign: 'center' }}>{t('gamify.radio.credit', 'Station directory: radio-browser.info. The radio keeps playing while you walk around the house.')}</div>
    </div>
  );
}

const ghost = { border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, padding: '10px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer', background: 'transparent', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 };
