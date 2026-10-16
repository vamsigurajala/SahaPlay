import { useEffect, useRef, useState } from 'react';
import { Play, Square, Youtube, Music2, AlertCircle, Headphones, Check, ExternalLink, LogOut, Users } from 'lucide-react';
import { SONGS, MUSIC_APPS, parseYouTube, parseSpotify, playCalm, spotifyEmbed, stopCalm, useCalmMusic, youTubeEmbed, youTubeQueue, setCalmSlot, setAppLinked, shareCurrentMusic } from './calmMusic';
import { stopRadio } from './radioPlayer';
import { CONTENT, SPOTIFY_PLAYLISTS } from './breakupLang';
import { SpotifyLogo, YouTubeMusicLogo, YouTubeLogo } from './MusicLogos';

// The "Calm Music" tab of the Breakup Room. Link Spotify, YouTube Music or YouTube, or
// just pick one of a few gentle songs for the language you chose, or paste a link. The
// song plays in a player right here in the panel, and moves to a small corner player when
// you close the panel, so you can keep sitting in the room and listening.

const STRINGS = {
  en: {
    appsHead: 'Connect your music',
    appsNote: 'Sign in opens the app\'s own page in a small window. You can use your email and password or your Google account there. We never see your password.',
    signIn: 'Sign in', signOut: 'Unlink', linked: 'Linked', notLinked: 'Not linked',
    skip: 'Already signed in on this browser?', skipBtn: 'Link without signing in',
    blocked: 'The sign-in window was blocked. Allow pop-ups for this site and try again.',
    openHere: 'Play here', playlists: 'Playlists for tonight', playAll: 'Play all three songs', openApp: 'Open the full app',
    yt: 'YouTube', ytm: 'YouTube Music', sp: 'Spotify',
    spLine: 'Songs, albums and playlists', ytmLine: 'Sign in with Google', ytLine: 'Videos and playlists',
    listen: 'Listen together', listenDone: 'Invite sent to everyone in the house', listenNote: 'Sends an invite to the others in the house. They choose whether to join.',
    nowPlaying: 'Now playing', stop: 'Stop', nothing: 'Pick a song, or link an app above, and the player opens here.',
    own: 'Play your own', ytPlace: 'Paste a YouTube song or playlist link', spPlace: 'Paste a Spotify song, album or playlist link',
    ytBtn: 'Play from YouTube', spBtn: 'Play from Spotify',
    ytErr: 'That does not look like a YouTube link. Copy the link from the Share button and paste it here.',
    spErr: 'That does not look like a Spotify link. Use Share, then Copy link, on a song, album or playlist.',
    fullApp: 'Spotify, YouTube Music and Google do not allow their full apps to be shown inside other sites, so the player here is each service\'s official player. Spotify plays full songs when you are signed in to Spotify in this browser, and a short preview otherwise.',
  },
  hi: {
    appsHead: 'अपना संगीत जोड़ो',
    appsNote: 'साइन इन दबाने पर ऐप का अपना पन्ना एक छोटी खिड़की में खुलेगा। वहाँ ईमेल-पासवर्ड या अपना Google खाता, दोनों से लॉगिन हो सकता है। आपका पासवर्ड हमें कभी नहीं दिखता।',
    signIn: 'साइन इन', signOut: 'हटाओ', linked: 'जुड़ा है', notLinked: 'जुड़ा नहीं',
    skip: 'इस ब्राउज़र में पहले से लॉगिन है?', skipBtn: 'बिना साइन इन के जोड़ो',
    blocked: 'साइन इन की खिड़की रोक दी गई। इस साइट के लिए पॉप-अप की अनुमति दो और फिर कोशिश करो।',
    openHere: 'यहीं सुनो', playlists: 'आज की रात के लिए प्लेलिस्ट', playAll: 'तीनों गीत एक साथ चलाओ', openApp: 'पूरा ऐप खोलो',
    yt: 'YouTube', ytm: 'YouTube Music', sp: 'Spotify',
    spLine: 'गीत, एल्बम और प्लेलिस्ट', ytmLine: 'Google से साइन इन', ytLine: 'वीडियो और प्लेलिस्ट',
    listen: 'साथ में सुनो', listenDone: 'घर में सबको न्योता भेज दिया', listenNote: 'घर के बाकी लोगों को न्योता जाता है। जुड़ना या न जुड़ना उनकी मर्ज़ी है।',
    nowPlaying: 'अभी बज रहा है', stop: 'रोको', nothing: 'कोई गीत चुनो या ऊपर से कोई ऐप जोड़ो, प्लेयर यहीं खुलेगा।',
    own: 'अपना गीत चलाओ', ytPlace: 'YouTube गीत या प्लेलिस्ट का लिंक चिपकाओ', spPlace: 'Spotify गीत, एल्बम या प्लेलिस्ट का लिंक चिपकाओ',
    ytBtn: 'YouTube से चलाओ', spBtn: 'Spotify से चलाओ',
    ytErr: 'यह YouTube का लिंक नहीं लगता। Share बटन से लिंक कॉपी करके यहाँ चिपकाओ।',
    spErr: 'यह Spotify का लिंक नहीं लगता। किसी गीत, एल्बम या प्लेलिस्ट पर Share और फिर Copy link दबाओ।',
    fullApp: 'Spotify, YouTube Music और Google अपने पूरे ऐप को दूसरी साइटों के अंदर दिखने नहीं देते, इसलिए यहाँ हर सेवा का अपना आधिकारिक प्लेयर चलता है। इस ब्राउज़र में Spotify में लॉगिन हो तो पूरे गीत बजते हैं, नहीं तो छोटा-सा अंश।',
  },
  te: {
    appsHead: 'మీ సంగీతాన్ని కలపండి',
    appsNote: 'సైన్ ఇన్ నొక్కితే యాప్ సొంత పేజీ చిన్న విండోలో తెరుచుకుంటుంది. అక్కడ ఈమెయిల్, పాస్‌వర్డ్‌తో లేదా మీ Google ఖాతాతో లాగిన్ అవ్వవచ్చు. మీ పాస్‌వర్డ్ మాకు ఎప్పుడూ కనిపించదు.',
    signIn: 'సైన్ ఇన్', signOut: 'తొలగించు', linked: 'కలిపారు', notLinked: 'కలపలేదు',
    skip: 'ఈ బ్రౌజర్‌లో ఇప్పటికే లాగిన్ అయ్యారా?', skipBtn: 'సైన్ ఇన్ లేకుండా కలపండి',
    blocked: 'సైన్ ఇన్ విండో ఆగిపోయింది. ఈ సైట్‌కు పాప్-అప్‌లను అనుమతించి మళ్లీ ప్రయత్నించండి.',
    openHere: 'ఇక్కడే వినండి', playlists: 'ఈ రాత్రికి ప్లేలిస్టులు', playAll: 'మూడు పాటలూ వరుసగా వినండి', openApp: 'పూర్తి యాప్ తెరవండి',
    yt: 'YouTube', ytm: 'YouTube Music', sp: 'Spotify',
    spLine: 'పాటలు, ఆల్బమ్‌లు, ప్లేలిస్టులు', ytmLine: 'Googleతో సైన్ ఇన్', ytLine: 'వీడియోలు, ప్లేలిస్టులు',
    listen: 'కలిసి వినండి', listenDone: 'ఇంట్లో అందరికీ ఆహ్వానం పంపాము', listenNote: 'ఇంట్లో మిగతావారికి ఆహ్వానం వెళ్తుంది. చేరాలా వద్దా అన్నది వారి ఇష్టం.',
    nowPlaying: 'ఇప్పుడు వినిపిస్తోంది', stop: 'ఆపు', nothing: 'ఒక పాట ఎంచుకోండి లేదా పైన ఒక యాప్ కలపండి, ప్లేయర్ ఇక్కడే తెరుచుకుంటుంది.',
    own: 'మీ సొంత పాట', ytPlace: 'YouTube పాట లేదా ప్లేలిస్ట్ లింక్ అతికించండి', spPlace: 'Spotify పాట, ఆల్బమ్ లేదా ప్లేలిస్ట్ లింక్ అతికించండి',
    ytBtn: 'YouTube నుంచి వినండి', spBtn: 'Spotify నుంచి వినండి',
    ytErr: 'ఇది YouTube లింక్‌లా లేదు. Share బటన్ నుంచి లింక్ కాపీ చేసి ఇక్కడ అతికించండి.',
    spErr: 'ఇది Spotify లింక్‌లా లేదు. ఏదైనా పాట, ఆల్బమ్ లేదా ప్లేలిస్ట్‌లో Share, ఆపై Copy link నొక్కండి.',
    fullApp: 'Spotify, YouTube Music, Google తమ పూర్తి యాప్‌లను ఇతర సైట్‌లలో చూపనివ్వవు, అందుకే ఇక్కడ ప్రతి సేవ అధికారిక ప్లేయర్ పనిచేస్తుంది. ఈ బ్రౌజర్‌లో Spotifyకి లాగిన్ అయి ఉంటే పూర్తి పాటలు వినిపిస్తాయి, లేకపోతే చిన్న భాగం మాత్రమే.',
  },
};

const SONG_KEY = { en: 'english', hi: 'hindi', te: 'telugu' };
const LOGOS = { spotify: SpotifyLogo, ytmusic: YouTubeMusicLogo, youtube: YouTubeLogo };

export default function CalmMusicPanel({ lang = 'en', ink, muted, card, border, isLight }) {
  const s = STRINGS[lang] || STRINGS.en;
  const tx = CONTENT[lang] || CONTENT.en;
  const songs = SONGS[SONG_KEY[lang] || 'english'].songs;
  const { current, linked, shareReady } = useCalmMusic();
  const [shared, setShared] = useState(false);
  useEffect(() => { setShared(false); }, [current?.src]);
  const [yt, setYt] = useState('');
  const [sp, setSp] = useState('');
  const [err, setErr] = useState({ yt: '', sp: '', app: '' });
  const pollers = useRef({});
  useEffect(() => () => { Object.values(pollers.current).forEach(clearInterval); }, []);

  const start = (item) => { stopRadio(); playCalm(item); };
  const playSong = (song) => start({ provider: 'youtube', title: song.title, by: song.by, src: youTubeEmbed({ video: song.yt }), desc: { provider: 'youtube', video: song.yt } });
  const playQueue = (title) => start({ provider: 'youtube', title, by: '', src: youTubeQueue(songs.map(x => x.yt)), desc: { provider: 'youtube', ids: songs.map(x => x.yt) } });
  const playSpotifyList = (pl) => start({ provider: 'spotify', title: pl.title, by: 'Spotify', src: spotifyEmbed({ type: 'playlist', id: pl.id }), desc: { provider: 'spotify', type: 'playlist', id: pl.id } });
  const playYt = () => {
    const p = parseYouTube(yt);
    if (!p) { setErr(e => ({ ...e, yt: s.ytErr })); return; }
    setErr(e => ({ ...e, yt: '' }));
    start({ provider: 'youtube', title: p.list && !p.video ? 'YouTube playlist' : 'YouTube', by: '', src: youTubeEmbed(p), desc: { provider: 'youtube', video: p.video || undefined, list: p.list || undefined } });
  };
  const playSp = () => {
    const p = parseSpotify(sp);
    if (!p) { setErr(e => ({ ...e, sp: s.spErr })); return; }
    setErr(e => ({ ...e, sp: '' }));
    start({ provider: 'spotify', title: `Spotify ${p.type}`, by: '', src: spotifyEmbed(p), desc: { provider: 'spotify', type: p.type, id: p.id } });
  };

  // Open the service's own sign-in page in a small window; when it closes, the app is linked.
  const signIn = (key) => {
    const w = window.open(MUSIC_APPS[key].login, `sp-login-${key}`, 'width=480,height=760');
    if (!w) { setErr(e => ({ ...e, app: s.blocked })); return; }
    setErr(e => ({ ...e, app: '' }));
    clearInterval(pollers.current[key]);
    pollers.current[key] = setInterval(() => {
      if (w.closed) { clearInterval(pollers.current[key]); setAppLinked(key, true); }
    }, 600);
  };

  const field = { flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 12, border: `1px solid ${border}`, background: isLight ? '#ffffff' : 'rgba(0,0,0,0.3)', color: ink, fontSize: 14, outline: 'none' };
  const btn = (bg) => ({ border: 'none', borderRadius: 12, padding: '10px 16px', fontWeight: 800, fontSize: 13, cursor: 'pointer', background: bg, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none' });
  const ghost = { border: `1px solid ${border}`, borderRadius: 10, padding: '7px 12px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', background: 'transparent', color: ink, display: 'inline-flex', alignItems: 'center', gap: 6 };
  const head = { fontSize: 11.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: muted, marginBottom: 10 };
  const accent = isLight ? '#4338ca' : '#a5b4fc';

  const apps = [
    { key: 'spotify', name: s.sp, line: s.spLine },
    { key: 'ytmusic', name: s.ytm, line: s.ytmLine },
    { key: 'youtube', name: s.yt, line: s.ytLine },
  ];
  const playSlotHeight = current ? (current.provider === 'spotify' ? 352 : undefined) : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(145deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Headphones size={24} color="#fff" /></div>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: ink }}>{tx.music.greeting}</div>
          <div style={{ fontSize: 13.5, color: muted, lineHeight: 1.6, marginTop: 3 }}>{tx.music.greetingSub}</div>
        </div>
      </div>

      {/* the player: the room's one player is drawn over this box */}
      <div>
        {current ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <Music2 size={16} color="#818cf8" />
              <span style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 13.5, color: ink }}>{s.nowPlaying}: {current.title}{current.by ? `, ${current.by}` : ''}</span>
              {shareReady && current.desc && (
                <button onClick={() => { if (shareCurrentMusic()) setShared(true); }} disabled={shared} title={s.listenNote} style={{ ...btn(shared ? '#16a34a' : '#6366f1'), opacity: shared ? 0.9 : 1 }}>{shared ? <Check size={13} /> : <Users size={13} />}{shared ? s.listenDone : s.listen}</button>
              )}
              <button onClick={stopCalm} style={btn('#64748b')}><Square size={13} />{s.stop}</button>
            </div>
            <div ref={setCalmSlot} style={{ width: '100%', maxWidth: 640, margin: '0 auto', height: playSlotHeight, aspectRatio: playSlotHeight ? undefined : '16 / 9', maxHeight: 380, borderRadius: 16, background: '#0e0c1a' }} />
          </>
        ) : (
          <div style={{ padding: '22px 16px', borderRadius: 16, border: `1px dashed ${border}`, textAlign: 'center', color: muted, fontSize: 13.5, lineHeight: 1.6 }}>{s.nothing}</div>
        )}
      </div>

      {/* connect your apps */}
      <div>
        <div style={head}>{s.appsHead}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 12 }}>
          {apps.map(({ key, name, line }) => {
            const Logo = LOGOS[key];
            const on = !!linked[key];
            return (
              <div key={key} style={{ padding: 14, borderRadius: 16, background: card, border: `1px solid ${on ? '#22c55e' : border}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Logo size={42} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 15, color: ink }}>{name}</div>
                    <div style={{ fontSize: 12, color: muted }}>{line}</div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 800, color: on ? '#16a34a' : muted }}>{on && <Check size={13} />}{on ? s.linked : s.notLinked}</span>
                </div>

                {!on ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button onClick={() => signIn(key)} style={{ ...btn(key === 'spotify' ? '#1db954' : '#e0302f'), justifyContent: 'center' }}>{s.signIn}</button>
                    <button onClick={() => setAppLinked(key, true)} style={{ background: 'none', border: 'none', color: accent, fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left', padding: 0 }}>{s.skip} {s.skipBtn}</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {key === 'spotify' ? (
                      <>
                        <div style={{ fontSize: 11.5, fontWeight: 800, color: muted }}>{s.playlists}</div>
                        {(SPOTIFY_PLAYLISTS[lang] || SPOTIFY_PLAYLISTS.en).map(pl => (
                          <button key={pl.id} onClick={() => playSpotifyList(pl)} style={{ ...ghost, justifyContent: 'flex-start' }}><Play size={14} color="#1db954" />{pl.title}</button>
                        ))}
                      </>
                    ) : (
                      <button onClick={() => playQueue(name)} style={{ ...ghost, justifyContent: 'flex-start' }}><Play size={14} color="#e0302f" />{s.playAll}</button>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <a href={MUSIC_APPS[key].home} target="_blank" rel="noopener noreferrer" style={{ ...ghost, textDecoration: 'none' }}><ExternalLink size={13} />{s.openApp}</a>
                      <button onClick={() => setAppLinked(key, false)} style={ghost}><LogOut size={13} />{s.signOut}</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {err.app && <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12.5, color: '#e0524d', marginTop: 8 }}><AlertCircle size={14} style={{ flex: 'none', marginTop: 1 }} />{err.app}</div>}
        <div style={{ fontSize: 12.5, color: muted, lineHeight: 1.6, marginTop: 10 }}>{s.appsNote}</div>
        <div style={{ fontSize: 12.5, color: muted, lineHeight: 1.6, marginTop: 4 }}>{s.fullApp}</div>
      </div>

      {/* a few gentle songs in this language */}
      <div>
        <div style={head}>{tx.music.songsHead}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 12 }}>
          {songs.map(song => (
            <button key={song.yt} onClick={() => playSong(song)} aria-label={`Play ${song.title}`} style={{ textAlign: 'left', cursor: 'pointer', padding: '12px 14px', borderRadius: 14, background: card, border: `1px solid ${border}`, color: ink, display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ width: 36, height: 36, borderRadius: '50%', background: '#6366f1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Play size={16} color="#fff" /></span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: 14, color: ink }}>{song.title}</span>
                <span style={{ display: 'block', fontSize: 12, color: muted }}>{song.by}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: muted, marginTop: 2, lineHeight: 1.5 }}>{tx.songNotes[song.yt] || song.note}</span>
              </span>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: muted, marginTop: 10 }}>{tx.music.otherLang}</div>
      </div>

      {/* paste a link */}
      <div>
        <div style={head}>{s.own}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={yt} onChange={(e) => setYt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') playYt(); }} placeholder={s.ytPlace} aria-label="YouTube link" style={{ ...field, flex: '1 1 220px' }} />
              <button onClick={playYt} style={btn('#e0302f')}><Youtube size={15} />{s.ytBtn}</button>
            </div>
            {err.yt && <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12.5, color: '#e0524d', marginTop: 6 }}><AlertCircle size={14} style={{ flex: 'none', marginTop: 1 }} />{err.yt}</div>}
          </div>
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={sp} onChange={(e) => setSp(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') playSp(); }} placeholder={s.spPlace} aria-label="Spotify link" style={{ ...field, flex: '1 1 220px' }} />
              <button onClick={playSp} style={btn('#1db954')}><Music2 size={15} />{s.spBtn}</button>
            </div>
            {err.sp && <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12.5, color: '#e0524d', marginTop: 6 }}><AlertCircle size={14} style={{ flex: 'none', marginTop: 1 }} />{err.sp}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
