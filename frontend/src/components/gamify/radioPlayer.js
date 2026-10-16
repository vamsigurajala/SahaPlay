import { useSyncExternalStore } from 'react';

// One radio for the whole house. The audio element lives outside React so a station
// keeps playing when the radio viewer is closed, and stops when gamify mode is left.
// Stations come from the community Radio Browser directory (radio-browser.info).

const HOSTS = ['https://de1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info'];

// A handful of long-running public streams, used only when the directory is
// unreachable so the radio never opens empty.
export const FALLBACK_STATIONS = [
  { id: 'fb-bbc', name: 'BBC World Service', country: 'United Kingdom', tags: 'news,world', lat: 51.5, lon: -0.12, url: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service', bitrate: 128 },
  { id: 'fb-soma', name: 'SomaFM Groove Salad', country: 'United States', tags: 'ambient,chill', lat: 37.77, lon: -122.42, url: 'https://ice1.somafm.com/groovesalad-128-mp3', bitrate: 128 },
  { id: 'fb-rp', name: 'Radio Paradise', country: 'United States', tags: 'eclectic,rock', lat: 39.0, lon: -120.0, url: 'https://stream.radioparadise.com/aac-128', bitrate: 128 },
  { id: 'fb-kexp', name: 'KEXP Seattle', country: 'United States', tags: 'indie,alternative', lat: 47.6, lon: -122.33, url: 'https://kexp.streamguys1.com/kexp160.aac', bitrate: 160 },
  { id: 'fb-fi', name: 'France Inter', country: 'France', tags: 'news,talk', lat: 48.85, lon: 2.35, url: 'https://icecast.radiofrance.fr/franceinter-midfi.mp3', bitrate: 128 },
];

let audio = null;
let state = { station: null, status: 'idle', volume: 0.8, error: '' };
const listeners = new Set();
const emit = () => listeners.forEach(l => l());
const set = (patch) => { state = { ...state, ...patch }; emit(); };

function ensureAudio() {
  if (audio || typeof Audio === 'undefined') return audio;
  audio = new Audio();
  audio.preload = 'none';
  audio.volume = state.volume;
  audio.addEventListener('playing', () => set({ status: 'playing', error: '' }));
  audio.addEventListener('waiting', () => { if (state.station) set({ status: 'loading' }); });
  audio.addEventListener('stalled', () => { if (state.status === 'playing') set({ status: 'loading' }); });
  audio.addEventListener('pause', () => { if (state.station && state.status !== 'error') set({ status: 'paused' }); });
  audio.addEventListener('error', () => { if (state.station) set({ status: 'error', error: 'This station is not available right now. Try another one.' }); });
  return audio;
}

export const getRadioState = () => state;
export const subscribeRadio = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const useRadio = () => useSyncExternalStore(subscribeRadio, getRadioState, getRadioState);

export function playStation(station) {
  const a = ensureAudio();
  if (!a || !station) return;
  set({ station, status: 'loading', error: '' });
  a.src = station.url;
  a.volume = state.volume;
  const p = a.play();
  if (p && p.catch) p.catch((e) => { if (e && e.name !== 'AbortError') set({ status: 'error', error: 'This station is not available right now. Try another one.' }); });
  // The directory asks apps to register a listen so the ranking stays honest.
  if (station.uuid) { try { fetch(`${HOSTS[0]}/json/url/${station.uuid}`, { mode: 'cors' }).catch(() => {}); } catch { /* offline */ } }
}

export function toggleRadio() {
  const a = ensureAudio();
  if (!a || !state.station) return;
  if (state.status === 'playing' || state.status === 'loading') { a.pause(); } else {
    set({ status: 'loading', error: '' });
    if (!a.src || state.status === 'error') a.src = state.station.url;
    const p = a.play();
    if (p && p.catch) p.catch((e) => { if (e && e.name !== 'AbortError') set({ status: 'error', error: 'This station is not available right now. Try another one.' }); });
  }
}

export function stopRadio() {
  if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
  if (state.station || state.status !== 'idle') set({ station: null, status: 'idle', error: '' });
}

export function setRadioVolume(v) {
  const volume = Math.max(0, Math.min(1, v));
  if (audio) audio.volume = volume;
  set({ volume });
}

// ---------------------------------------------------------------- directory
const toStation = (s) => ({
  id: s.stationuuid,
  uuid: s.stationuuid,
  name: (s.name || '').trim() || 'Unnamed station',
  country: s.country || '',
  tags: (s.tags || '').split(',').filter(Boolean).slice(0, 3).join(', '),
  lat: s.geo_lat,
  lon: s.geo_long,
  url: s.url_resolved || s.url,
  bitrate: s.bitrate || 0,
  favicon: s.favicon || '',
});

async function getJson(path) {
  let lastErr;
  for (const host of HOSTS) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 9000);
      const res = await fetch(`${host}${path}`, { signal: ctl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('offline');
}

const usable = (s) => s.url_resolved && /^https:/i.test(s.url_resolved) && !s.hls && s.lastcheckok === 1;

// Popular stations that know where they are, thinned out so the dots spread across the
// globe instead of piling up over Europe (one per ~3 degree cell, best voted first).
export async function fetchGlobeStations() {
  const list = await getJson('/json/stations/search?has_geo_info=true&is_https=true&hidebroken=true&order=votes&reverse=true&limit=900');
  const seen = new Set();
  const out = [];
  for (const s of list) {
    if (!usable(s) || typeof s.geo_lat !== 'number' || typeof s.geo_long !== 'number') continue;
    const key = `${Math.round(s.geo_lat / 3)}:${Math.round(s.geo_long / 3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(toStation(s));
    if (out.length >= 260) break;
  }
  if (!out.length) throw new Error('no stations');
  return out;
}

export async function searchStations(query) {
  const q = encodeURIComponent(query.trim());
  if (!q) return [];
  const list = await getJson(`/json/stations/search?name=${q}&is_https=true&hidebroken=true&order=votes&reverse=true&limit=30`);
  return list.filter(usable).map(toStation);
}

export async function stationsInCountry(code) {
  const list = await getJson(`/json/stations/search?countrycode=${encodeURIComponent(code)}&is_https=true&hidebroken=true&order=votes&reverse=true&limit=30`);
  return list.filter(usable).map(toStation);
}
