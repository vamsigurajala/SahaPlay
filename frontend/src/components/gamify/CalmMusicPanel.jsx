import { useState } from 'react';
import { Play, Square, Youtube, Music2, ExternalLink, AlertCircle, Headphones } from 'lucide-react';
import { SONGS, parseYouTube, parseSpotify, playCalm, spotifyEmbed, stopCalm, useCalmMusic, youTubeEmbed } from './calmMusic';
import { stopRadio } from './radioPlayer';

// The "Calm Music" tab of the Breakup Room: a few gentle songs to start with, and a box
// to play anything of your own from YouTube or Spotify. The song then plays in a small
// player in the corner of the house, so you can sit in the room and just listen.

export default function CalmMusicPanel({ onClose, ink, muted, card, border, isLight }) {
  const { current } = useCalmMusic();
  const [yt, setYt] = useState('');
  const [sp, setSp] = useState('');
  const [err, setErr] = useState({ yt: '', sp: '' });

  const start = (item) => {
    stopRadio(); // one thing playing at a time
    playCalm(item);
    if (onClose) onClose();
  };
  const playSong = (s) => start({ provider: 'youtube', title: s.title, by: s.by, src: youTubeEmbed({ video: s.yt }) });
  const playYt = () => {
    const p = parseYouTube(yt);
    if (!p) { setErr(e => ({ ...e, yt: 'That does not look like a YouTube link. Copy the link from the Share button and paste it here.' })); return; }
    setErr(e => ({ ...e, yt: '' }));
    start({ provider: 'youtube', title: p.list && !p.video ? 'Your YouTube playlist' : 'Your YouTube song', by: '', src: youTubeEmbed(p) });
  };
  const playSp = () => {
    const p = parseSpotify(sp);
    if (!p) { setErr(e => ({ ...e, sp: 'That does not look like a Spotify link. Use Share, then Copy link, on a song, album or playlist.' })); return; }
    setErr(e => ({ ...e, sp: '' }));
    start({ provider: 'spotify', title: `Your Spotify ${p.type}`, by: '', src: spotifyEmbed(p) });
  };

  const field = { flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 12, border: `1px solid ${border}`, background: isLight ? '#ffffff' : 'rgba(0,0,0,0.3)', color: ink, fontSize: 14, outline: 'none' };
  const btn = (bg) => ({ border: 'none', borderRadius: 12, padding: '10px 16px', fontWeight: 800, fontSize: 13, cursor: 'pointer', background: bg, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(145deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Headphones size={24} color="#fff" /></div>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: ink }}>Sit down. Breathe. Let the music do the talking.</div>
          <div style={{ fontSize: 13.5, color: muted, lineHeight: 1.5, marginTop: 3 }}>There is no hurry here. Pick something gentle, or play your own, and the song will keep going while you sit in the room.</div>
        </div>
      </div>

      {current && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 14, background: card, border: `1px solid ${border}` }}>
          <Music2 size={16} color="#818cf8" />
          <span style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 13.5, color: ink }}>Now playing: {current.title}{current.by ? `, ${current.by}` : ''}</span>
          <button onClick={stopCalm} style={btn('#64748b')}><Square size={13} />Stop</button>
        </div>
      )}

      <div>
        <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: muted, marginBottom: 10 }}>A few gentle songs to start with</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {Object.entries(SONGS).map(([key, lang]) => (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#818cf8' }}>{lang.label}</div>
              {lang.songs.map(s => (
                <button key={s.yt} onClick={() => playSong(s)} aria-label={`Play ${s.title}`} style={{ textAlign: 'left', cursor: 'pointer', padding: '12px 14px', borderRadius: 14, background: card, border: `1px solid ${border}`, color: ink, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#6366f1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Play size={15} color="#fff" /></span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: 14, color: ink }}>{s.title}</span>
                    <span style={{ display: 'block', fontSize: 12, color: muted }}>{s.by}</span>
                    <span style={{ display: 'block', fontSize: 12, color: muted, marginTop: 2, lineHeight: 1.4 }}>{s.note}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: muted, marginBottom: 10 }}>Play your own</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={yt} onChange={(e) => setYt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') playYt(); }} placeholder="Paste a YouTube song or playlist link" aria-label="YouTube link" style={{ ...field, flex: '1 1 220px' }} />
              <button onClick={playYt} style={btn('#e0302f')}><Youtube size={15} />Play from YouTube</button>
            </div>
            {err.yt && <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12.5, color: '#e0524d', marginTop: 6 }}><AlertCircle size={14} style={{ flex: 'none', marginTop: 1 }} />{err.yt}</div>}
          </div>
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={sp} onChange={(e) => setSp(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') playSp(); }} placeholder="Paste a Spotify song, album or playlist link" aria-label="Spotify link" style={{ ...field, flex: '1 1 220px' }} />
              <button onClick={playSp} style={btn('#1db954')}><Music2 size={15} />Play from Spotify</button>
            </div>
            {err.sp && <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12.5, color: '#e0524d', marginTop: 6 }}><AlertCircle size={14} style={{ flex: 'none', marginTop: 1 }} />{err.sp}</div>}
          </div>
          <div style={{ fontSize: 12.5, color: muted, lineHeight: 1.55 }}>
            Songs play inside the house, in a small player in the corner. Spotify plays full songs when you are signed in to Spotify in this browser; otherwise you will hear a short preview.
            {' '}
            <a href="https://open.spotify.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', fontWeight: 700 }}>Open Spotify <ExternalLink size={11} style={{ verticalAlign: -1 }} /></a>
            {' | '}
            <a href="https://music.youtube.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', fontWeight: 700 }}>Open YouTube Music <ExternalLink size={11} style={{ verticalAlign: -1 }} /></a>
          </div>
        </div>
      </div>
    </div>
  );
}
