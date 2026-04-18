import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Search, Play, Tv, Film } from 'lucide-react';
import { FaVimeo } from 'react-icons/fa';

const SOCKET_SERVER_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `http://${window.location.hostname}:3001`
  : `https://${window.location.hostname}`;

export default function VimeoBrowserModal({ onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hoveredId, setHoveredId] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const fetchTopVideos = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${SOCKET_SERVER_URL}/api/vimeo/top`);
      const data = await r.json();
      setResults(data);
    } catch {
      setError('Failed to load Staff Picks.');
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback(async (q) => {
    if (!q.trim()) {
      fetchTopVideos();
      return;
    }
    
    // Direct Vimeo URL detection
    const vimeoMatch = q.match(/(?:vimeo\.com\/)(\d+)/i);
    if (vimeoMatch && vimeoMatch[1]) {
      onSelect(`https://vimeo.com/${vimeoMatch[1]}`);
      onClose();
      return;
    }

    setLoading(true); setError('');
    try {
      const r = await fetch(`${SOCKET_SERVER_URL}/api/vimeo/search?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      setResults(data);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [onSelect, onClose, fetchTopVideos]);

  useEffect(() => {
    fetchTopVideos();
  }, [fetchTopVideos]);

  // Debounced search logic
  useEffect(() => {
    const t = setTimeout(() => {
      search(query);
    }, 400);
    return () => clearTimeout(t);
  }, [query, search]);

  const handleKey = (e) => { if (e.key === 'Enter') search(query); };

  const pick = (video) => {
    onSelect(`https://vimeo.com/${video.id}`);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:20000,
        display:'flex', alignItems:'center', justifyContent:'center',
        backdropFilter:'blur(10px)'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:'#ffffff', border:'none',
          borderRadius:24, width:'min(840px, 96vw)', maxHeight:'85vh',
          display:'flex', flexDirection:'column', position:'relative',
          boxShadow:'0 30px 100px rgba(0,0,0,1)',
          fontFamily:"'Outfit',sans-serif",
          overflow: 'hidden'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 20, right: 20, width: 40, height: 40,
            borderRadius: '50%', background: 'rgba(0,0,0,0.05)', border: 'none',
            color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10, transition: 'all 0.3s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background='#00adef'; e.currentTarget.style.color='#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(0,0,0,0.05)'; e.currentTarget.style.color='#333' }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', gap:14,
          padding:'30px 30px 20px', borderBottom:'1px solid rgba(0,0,0,0.05)',
          flexShrink:0
        }}>
          <div style={{
            width:42, height:42, borderRadius:12,
            background:'#00adef',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            boxShadow: '0 8px 20px rgba(0,173,239,0.3)'
          }}>
            <FaVimeo size={20} color="#fff"/>
          </div>
          <div style={{ display:'flex', flexDirection:'column' }}>
            <span style={{fontWeight:800, fontSize:22, color:'#1a1a1a', letterSpacing:'-0.5px'}}>Vimeo Staff Picks</span>
            <span style={{fontSize:12, color:'#666', fontWeight:600, letterSpacing:0.5}}>DISCOVER EXTRAORDINARY VIDEOS</span>
          </div>
        </div>

        {/* Search bar */}
        <div style={{padding:'20px 30px 15px', flexShrink:0}}>
          <div style={{
            display:'flex', gap:12, background: '#f5f5f7',
            border:'1px solid transparent', borderRadius:16,
            padding:'14px 20px', alignItems:'center',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }} onFocusCapture={e => {
            e.currentTarget.style.borderColor = '#00adef';
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.boxShadow = '0 0 0 4px rgba(0,173,239,0.1)';
          }} onBlurCapture={e => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.background = '#f5f5f7';
            e.currentTarget.style.boxShadow = 'none';
          }}>
            <Search size={20} color="#999"/>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search cinematic films or paste a Vimeo link..."
              style={{
                flex:1, background:'transparent', border:'none', outline:'none',
                color:'#1a1a1a', fontSize:16, fontFamily:'inherit'
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background:'transparent', border:'none', color:'#ccc', cursor:'pointer' }}>
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1, overflowY:'auto', padding:'0 30px 30px'}}>
          {error && (
            <div style={{
              textAlign:'center', color:'#ff3b30', fontSize:14,
              background:'rgba(255,59,48,0.05)', borderRadius:16,
              padding:'20px', margin:'12px 0'
            }}>{error}</div>
          )}

          {!loading && results.length === 0 && !error && (
            <div style={{
              textAlign:'center', color:'#999', fontSize:15,
              padding:'80px 0', display:'flex', flexDirection:'column',
              alignItems:'center', gap:20
            }}>
              <Film size={56} strokeWidth={1} opacity={0.3}/>
              <p style={{margin:0, maxWidth: 320, lineHeight: 1.6}}>Search for world-class creators or explore our curated selection of Staff Picks.</p>
            </div>
          )}

          <div style={{
            display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',
            gap:24, marginTop:10
          }}>
            {loading ? (
               Array.from({length:6}).map((_,i) => (
                <div key={i} style={{borderRadius:20, overflow:'hidden', background:'#f5f5f7'}}>
                  <div style={{width:'100%', paddingBottom:'56.25%', background:'rgba(0,0,0,0.03)', animation:'pulse 1.5s infinite'}}/>
                  <div style={{padding:20}}>
                    <div style={{height:18, borderRadius:6, background:'rgba(0,0,0,0.04)', marginBottom:10, width:'80%'}}/>
                    <div style={{height:12, borderRadius:4, background:'rgba(0,0,0,0.02)', width:'50%'}}/>
                  </div>
                </div>
              ))
            ) : (
              results.map(v => (
                <div
                  key={v.id}
                  onClick={() => pick(v)}
                  onMouseEnter={() => setHoveredId(v.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    borderRadius:20, overflow:'hidden', cursor:'pointer',
                    background: '#fff',
                    border: '1px solid rgba(0,0,0,0.05)',
                    transform: hoveredId === v.id ? 'translateY(-6px)' : 'none',
                    transition:'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    boxShadow: hoveredId === v.id ? '0 20px 40px rgba(0,0,0,0.1)' : '0 4px 12px rgba(0,0,0,0.03)'
                  }}
                >
                  <div style={{position:'relative', paddingBottom:'56.25%', background:'#000'}}>
                    <img
                      src={v.thumbnail}
                      alt={v.name}
                      style={{
                        position:'absolute', inset:0, width:'100%', height:'100%',
                        objectFit:'cover', opacity: hoveredId === v.id ? 0.9 : 1,
                        transition: 'opacity 0.3s'
                      }}
                      onError={e => {
                        e.target.src = 'https://i.vimeocdn.com/video/default-video_640';
                      }}
                    />
                    
                    {/* Badge */}
                    <div style={{
                      position:'absolute', top:12, left:12,
                      background:'rgba(255,255,255,0.95)', backdropFilter:'blur(8px)',
                      padding:'5px 10px', borderRadius:8, fontSize:10, fontWeight:800,
                      color:'#00adef', boxShadow:'0 4px 10px rgba(0,0,0,0.1)',
                      textTransform:'uppercase', letterSpacing:'1px',
                      zIndex: 2
                    }}>
                      {v.category}
                    </div>

                    {hoveredId === v.id && (
                      <div style={{
                        position:'absolute', inset:0, display:'flex',
                        alignItems:'center', justifyContent:'center',
                        background:'rgba(0, 173, 239, 0.1)',
                        zIndex: 1
                      }}>
                        <div style={{
                          width:50, height:50, borderRadius:'50%',
                          background:'#00adef',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          boxShadow:'0 10px 25px rgba(0,173,239,0.5)',
                          transform: 'scale(1.1)',
                          transition: 'transform 0.2s'
                        }}>
                          <Play size={20} fill="#fff" color="#fff" style={{marginLeft:3}}/>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{padding:'18px 20px'}}>
                    <div style={{
                      fontSize:16, fontWeight:700, color:'#1a1a1a',
                      lineHeight:1.3, marginBottom:6
                    }}>
                      {v.name}
                    </div>
                    <div style={{
                      fontSize:13, color:'#777',
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      fontWeight: 500
                    }}>
                      {v.title}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        ::-webkit-scrollbar{width:8px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#eee;border-radius:10px;border:2px solid #fff;}
        ::-webkit-scrollbar-thumb:hover{background:#ddd;}
      `}</style>
    </div>
  );
}
