import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Search, Play, Clock, User } from 'lucide-react';

const SOCKET_SERVER_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `http://${window.location.hostname}:3001`
  : `https://${window.location.hostname}`;

function formatDur(secs) {
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

export default function YouTubeBrowserModal({ onSelect, onClose }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [hoveredId, setHoveredId] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const search = useCallback(async (q) => {
    if (!q.trim()) return;

    // Detect direct YouTube URLs and handle them instantly
    const ytMatch = q.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/))([a-zA-Z0-9_-]{11})/i);
    if (ytMatch && ytMatch[1]) {
      onSelect(`https://www.youtube.com/watch?v=${ytMatch[1]}`);
      onClose();
      return;
    }

    setLoading(true); setError(''); setResults([]);
    try {
      const r = await fetch(`${SOCKET_SERVER_URL}/api/youtube/search?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      if (data.error) { setError(data.error); return; }
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setError('Could not reach search service. Check your connection.');
    } finally { setLoading(false); }
  }, [onSelect, onClose]);

  const searchRef = useRef(search);
  useEffect(() => { searchRef.current = search; }, [search]);

  // Debounced auto-search & default "home page"
  useEffect(() => {
    const t = setTimeout(() => {
      searchRef.current(query.trim() ? query : 'top trending videos');
    }, 600);
    return () => clearTimeout(t);
  }, [query]);

  const handleKey = (e) => { if (e.key === 'Enter') search(query); };

  const pick = (video) => {
    onSelect(`https://www.youtube.com/watch?v=${video.videoId}`);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:20000,
        display:'flex', alignItems:'center', justifyContent:'center',
        backdropFilter:'blur(6px)'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:'#0f0f17', border:'1px solid rgba(255,255,255,0.1)',
          borderRadius:20, width:'min(780px, 96vw)', maxHeight:'85vh',
          display:'flex', flexDirection:'column', position:'relative',
          boxShadow:'0 24px 80px rgba(0,0,0,0.8)',
          fontFamily:"'Outfit',sans-serif"
        }}
      >
        {/* Close Button (Outside) */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: -2, right: -64, width: 44, height: 44,
            borderRadius: '50%', background: '#2a2a3e', border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            transition: 'background 0.2s, transform 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background='#3a3a4e'; e.currentTarget.style.transform='scale(1.05)' }}
          onMouseLeave={e => { e.currentTarget.style.background='#2a2a3e'; e.currentTarget.style.transform='scale(1)' }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', gap:12,
          padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.08)',
          flexShrink:0
        }}>
          <div style={{
            width:32, height:32, borderRadius:8,
            background:'linear-gradient(135deg,#ef4444,#dc2626)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
          }}>
            <Play size={14} fill="#fff" color="#fff"/>
          </div>
          <span style={{fontWeight:700, fontSize:16, color:'#fff'}}>YouTube Browser</span>
        </div>

        {/* Search bar */}
        <div style={{padding:'14px 20px 10px', flexShrink:0}}>
          <div style={{
            display:'flex', gap:8, background:'rgba(255,255,255,0.05)',
            border:'1px solid rgba(255,255,255,0.1)', borderRadius:12,
            padding:'8px 14px', alignItems:'center'
          }}>
            <Search size={16} color="#666"/>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search YouTube..."
              style={{
                flex:1, background:'transparent', border:'none', outline:'none',
                color:'#fff', fontSize:14, fontFamily:'inherit'
              }}
            />
            <button
              onClick={() => search(query)}
              disabled={loading || !query.trim()}
              style={{
                background:'linear-gradient(135deg,#ef4444,#dc2626)',
                border:'none', borderRadius:8, padding:'6px 14px',
                color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer',
                opacity: (!query.trim() || loading) ? 0.5 : 1,
                transition:'opacity 0.15s'
              }}
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div style={{flex:1, overflowY:'auto', padding:'4px 20px 20px'}}>
          {error && (
            <div style={{
              textAlign:'center', color:'#ef4444', fontSize:13,
              background:'rgba(239,68,68,0.08)', borderRadius:10,
              padding:'12px', margin:'8px 0'
            }}>{error}</div>
          )}
          {!loading && !error && results.length === 0 && (
            <div style={{
              textAlign:'center', color:'#444', fontSize:13,
              padding:'40px 0', display:'flex', flexDirection:'column',
              alignItems:'center', gap:10
            }}>
              <Search size={36} opacity={0.2}/>
              <p style={{margin:0}}>Search for YouTube videos to watch together</p>
            </div>
          )}
          {loading && (
            <div style={{
              display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',
              gap:12, marginTop:8
            }}>
              {Array.from({length:8}).map((_,i) => (
                <div key={i} style={{borderRadius:12, overflow:'hidden', background:'rgba(255,255,255,0.04)'}}>
                  <div style={{width:'100%', paddingBottom:'56.25%', background:'rgba(255,255,255,0.06)', animation:'pulse 1.5s infinite'}}/>
                  <div style={{padding:'10px 12px'}}>
                    <div style={{height:12, borderRadius:6, background:'rgba(255,255,255,0.06)', marginBottom:8}}/>
                    <div style={{height:10, borderRadius:6, background:'rgba(255,255,255,0.04)', width:'60%'}}/>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && results.length > 0 && (
            <div style={{
              display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',
              gap:12, marginTop:8
            }}>
              {results.map(v => (
                <div
                  key={v.videoId}
                  onClick={() => pick(v)}
                  onMouseEnter={() => setHoveredId(v.videoId)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    borderRadius:12, overflow:'hidden', cursor:'pointer',
                    background: hoveredId === v.videoId ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                    border:'1px solid rgba(255,255,255,0.07)',
                    transform: hoveredId === v.videoId ? 'translateY(-2px)' : 'none',
                    transition:'all 0.18s ease',
                    boxShadow: hoveredId === v.videoId ? '0 8px 24px rgba(0,0,0,0.4)' : 'none'
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{position:'relative', paddingBottom:'56.25%', background:'#1a1a1a'}}>
                    <img
                      src={v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`}
                      alt={v.title}
                      onError={e => { e.target.src = `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`; }}
                      style={{
                        position:'absolute', inset:0, width:'100%', height:'100%',
                        objectFit:'cover'
                      }}
                    />
                    {/* Duration badge */}
                    {v.lengthSeconds > 0 && (
                      <div style={{
                        position:'absolute', bottom:6, right:6,
                        background:'rgba(0,0,0,0.85)', borderRadius:4,
                        padding:'2px 6px', fontSize:11, color:'#fff', fontWeight:600,
                        display:'flex', alignItems:'center', gap:4
                      }}>
                        <Clock size={9}/> {formatDur(v.lengthSeconds)}
                      </div>
                    )}
                    {/* Play button overlay on hover */}
                    {hoveredId === v.videoId && (
                      <div style={{
                        position:'absolute', inset:0, display:'flex',
                        alignItems:'center', justifyContent:'center',
                        background:'rgba(0,0,0,0.4)'
                      }}>
                        <div style={{
                          width:44, height:44, borderRadius:'50%',
                          background:'linear-gradient(135deg,#ef4444,#dc2626)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          boxShadow:'0 0 20px rgba(239,68,68,0.6)'
                        }}>
                          <Play size={18} fill="#fff" color="#fff" style={{marginLeft:2}}/>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div style={{padding:'10px 12px'}}>
                    <div style={{
                      fontSize:13, fontWeight:600, color:'#e5e5e5',
                      lineHeight:'1.35', display:'-webkit-box',
                      WebkitLineClamp:2, WebkitBoxOrient:'vertical',
                      overflow:'hidden', marginBottom:6
                    }}>
                      {v.title}
                    </div>
                    <div style={{
                      display:'flex', alignItems:'center', gap:5,
                      color:'#666', fontSize:11
                    }}>
                      <User size={10}/> {v.author}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#333;border-radius:2px;}
      `}</style>
    </div>
  );
}





