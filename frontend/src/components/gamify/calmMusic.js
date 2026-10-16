import { useSyncExternalStore } from 'react';

// Calm music for the Breakup Room. Songs play from YouTube or Spotify embeds that live
// in a small dock (CalmMusicDock) so the music keeps going while you sit in the room.
// We build every embed address ourselves from a parsed id, so a pasted link can never
// put an arbitrary page in the player.

export const SONGS = {
  english: {
    label: 'English',
    songs: [
      { yt: 'hLQl3WQQoQ0', title: 'Someone Like You', by: 'Adele', note: 'For letting go of someone who has moved on.' },
      { yt: 'k4V3Mo61fJM', title: 'Fix You', by: 'Coldplay', note: 'A quiet hand on the shoulder when you are tired of being strong.' },
      { yt: 'RBumgq5yVrA', title: 'Let Her Go', by: 'Passenger', note: 'About how you only see what you had once it is gone.' },
    ],
  },
  hindi: {
    label: 'Hindi',
    songs: [
      { yt: '284Ov7ysmfA', title: 'Channa Mereya', by: 'Arijit Singh', note: 'Loving someone who has to walk away.' },
      { yt: 'xRb8hxwN5zc', title: 'Agar Tum Saath Ho', by: 'Alka Yagnik and Arijit Singh', note: 'The ache of being close and still apart.' },
      { yt: 'KwiDJclWo44', title: 'Tadap Tadap Ke', by: 'KK', note: 'Raw longing, sung straight from the heart.' },
    ],
  },
  telugu: {
    label: 'Telugu',
    songs: [
      { yt: 'BpINyS4k7Uw', title: 'Priyathama Priyathama', by: 'Majili', note: 'A tender song about missing someone you still love.' },
      { yt: 'kca0cG9fiQw', title: 'Maate Vinadhuga', by: 'Sid Sriram, Taxiwaala', note: 'Words that will not listen, and a heart that waits.' },
      { yt: 'sNKD014uRj0', title: 'Ninnila', by: 'Tholi Prema', note: 'Remembering a first love, softly.' },
    ],
  },
};

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_LIST = /^[A-Za-z0-9_-]{10,60}$/;
const SP_ID = /^[A-Za-z0-9]{22}$/;
const SP_TYPES = ['track', 'album', 'playlist', 'artist', 'episode', 'show'];

// Accepts a YouTube / YouTube Music / youtu.be link and returns { video, list } or null.
export function parseYouTube(input) {
  const text = String(input || '').trim();
  if (!text) return null;
  let url;
  try { url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`); } catch { return null; }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let video = null;
  if (host === 'youtu.be') video = url.pathname.split('/')[1] || null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') video = url.searchParams.get('v');
    else { const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?]+)/); if (m && m[1] !== 'videoseries') video = m[1]; }
  } else return null;
  const list = url.searchParams.get('list');
  const v = video && YT_ID.test(video) ? video : null;
  const l = list && YT_LIST.test(list) ? list : null;
  if (!v && !l) return null;
  return { video: v, list: l };
}

export function youTubeEmbed({ video, list }) {
  const base = video ? `https://www.youtube-nocookie.com/embed/${video}` : 'https://www.youtube-nocookie.com/embed/videoseries';
  const q = ['autoplay=1', 'rel=0', 'playsinline=1'];
  if (list) q.push(`list=${list}`);
  return `${base}?${q.join('&')}`;
}

// Accepts an open.spotify.com link or a spotify: uri and returns { type, id } or null.
export function parseSpotify(input) {
  const text = String(input || '').trim();
  if (!text) return null;
  const uri = text.match(/^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]+)$/);
  if (uri) return SP_ID.test(uri[2]) ? { type: uri[1], id: uri[2] } : null;
  let url;
  try { url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`); } catch { return null; }
  if (url.hostname !== 'open.spotify.com') return null;
  const parts = url.pathname.split('/').filter(Boolean).filter(p => !/^intl-/.test(p));
  if (parts[0] === 'embed') parts.shift();
  const [type, id] = parts;
  if (!SP_TYPES.includes(type) || !SP_ID.test(id || '')) return null;
  return { type, id };
}

export const spotifyEmbed = ({ type, id }) => `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;

// ---------------------------------------------------------------- the player state
let state = { current: null, small: false };
const listeners = new Set();
const set = (patch) => { state = { ...state, ...patch }; listeners.forEach(l => l()); };

export const getCalmMusic = () => state;
export const useCalmMusic = () => useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, getCalmMusic, getCalmMusic);

// current: { provider: 'youtube' | 'spotify', title, by, src }
export function playCalm(current) { set({ current, small: false }); }
export function stopCalm() { if (state.current) set({ current: null }); }
export function setCalmSmall(small) { set({ small }); }
