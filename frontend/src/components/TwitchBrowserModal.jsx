import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Search, Play, User, Tv } from 'lucide-react';
import { FaTwitch } from 'react-icons/fa';

const SOCKET_SERVER_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `http://${window.location.hostname}:3001`
  : `https://${window.location.hostname}`;

export default function TwitchBrowserModal({ onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hoveredId, setHoveredId] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const fetchTopStreams = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${SOCKET_SERVER_URL}/api/twitch/top`);
      const data = await r.json();
      setResults(data);
    } catch {
      setError('Failed to load top streams.');
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback(async (q) => {
    if (!q.trim()) {
      fetchTopStreams();
      return;
    }
    
    // Direct Twitch URL detection
    const twitchMatch = q.match(/(?:twitch\.tv\/)([a-zA-Z0-9_]+)/i);
    if (twitchMatch && twitchMatch[1]) {
      onSelect(`https://www.twitch.tv/${twitchMatch[1]}`);
      onClose();
      return;
    }

    setLoading(true); setError('');
    try {
      const r = await fetch(`${SOCKET_SERVER_URL}/api/twitch/search?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      setResults(data);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [onSelect, onClose, fetchTopStreams]);

  useEffect(() => {
    fetchTopStreams();
  }, [fetchTopStreams]);

  // Debounced search logic - auto-refreshes Top Streams when query is cleared
  useEffect(() => {
    const t = setTimeout(() => {
      search(query);
    }, 400); // Slightly faster debounce for better feel
    return () => clearTimeout(t);
  }, [query, search]);

  const handleKey = (e) => { if (e.key === 'Enter') search(query); };

  const pick = (channel) => {
    onSelect(`https://www.twitch.tv/${channel.id}`);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:20000,
        display:'flex', alignItems:'center', justifyContent:'center',
        backdropFilter:'blur(8px)'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:'#0e0e10', border:'1px solid rgba(145,70,255,0.2)',
          borderRadius:20, width:'min(820px, 96vw)', maxHeight:'85vh',
          display:'flex', flexDirection:'column', position:'relative',
          boxShadow:'0 24px 80px rgba(0,0,0,0.9)',
          fontFamily:"'Outfit',sans-serif"
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: -2, right: -64, width: 44, height: 44,
            borderRadius: '50%', background: '#1f1f23', border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background='#9146ff'; e.currentTarget.style.transform='scale(1.1)' }}
          onMouseLeave={e => { e.currentTarget.style.background='#1f1f23'; e.currentTarget.style.transform='scale(1)' }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', gap:12,
          padding:'18px 24px', borderBottom:'1px solid rgba(255,255,255,0.05)',
          flexShrink:0
        }}>
          <div style={{
            width:36, height:36, borderRadius:10,
            background:'#9146ff',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            boxShadow: '0 0 15px rgba(145,70,255,0.4)'
          }}>
            <FaTwitch size={18} color="#fff"/>
          </div>
          <div style={{ display:'flex', flexDirection:'column' }}>
            <span style={{fontWeight:800, fontSize:18, color:'#fff', letterSpacing:'-0.5px'}}>Twitch Browser</span>
            <span style={{fontSize:11, color:'#adadb8', fontWeight:600}}>DISCOVER LIVE STREAMS</span>
          </div>
        </div>

        {/* Search bar */}
        <div style={{padding:'20px 24px 12px', flexShrink:0}}>
          <div style={{
            display:'flex', gap:10, background: '#18181b',
            border:'1px solid rgba(255,255,255,0.1)', borderRadius:12,
            padding:'10px 16px', alignItems:'center',
            boxShadow:'inset 0 2px 4px rgba(0,0,0,0.3)',
            transition: 'border-color 0.2s'
          }} onFocusCapture={e => e.currentTarget.style.borderColor = '#9146ff'}>
            <Search size={18} color="#666"/>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search for a channel or paste a link..."
              style={{
                flex:1, background:'transparent', border:'none', outline:'none',
                color:'#efeff1', fontSize:15, fontFamily:'inherit'
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background:'transparent', border:'none', color:'#666', cursor:'pointer' }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1, overflowY:'auto', padding:'0 24px 24px'}}>
          {error && (
            <div style={{
              textAlign:'center', color:'#ff8080', fontSize:14,
              background:'rgba(255,128,128,0.1)', borderRadius:12,
              padding:'16px', margin:'12px 0', border: '1px solid rgba(255,128,128,0.2)'
            }}>{error}</div>
          )}

          {!loading && results.length === 0 && !error && (
            <div style={{
              textAlign:'center', color:'#adadb8', fontSize:14,
              padding:'60px 0', display:'flex', flexDirection:'column',
              alignItems:'center', gap:14
            }}>
              <Tv size={48} opacity={0.2}/>
              <p style={{margin:0, maxWidth: 300, lineHeight: 1.5}}>Enter a Twitch channel name or search to find something to watch.</p>
            </div>
          )}

          <div style={{
            display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',
            gap:20, marginTop:8
          }}>
            {loading ? (
               Array.from({length:8}).map((_,i) => (
                <div key={i} style={{borderRadius:12, overflow:'hidden', background:'#18181b', border:'1px solid rgba(255,255,255,0.05)'}}>
                  <div style={{width:'100%', paddingBottom:'56.25%', background:'rgba(255,255,255,0.03)', animation:'pulse 1.5s infinite'}}/>
                  <div style={{padding:12}}>
                    <div style={{height:14, borderRadius:4, background:'rgba(255,255,255,0.04)', marginBottom:8, width:'70%'}}/>
                    <div style={{height:10, borderRadius:4, background:'rgba(255,255,255,0.02)', width:'40%'}}/>
                  </div>
                </div>
              ))
            ) : (
              results.map(c => (
                <div
                  key={c.id}
                  onClick={() => pick(c)}
                  onMouseEnter={() => setHoveredId(c.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    borderRadius:12, overflow:'hidden', cursor:'pointer',
                    background: hoveredId === c.id ? '#1f1f23' : '#18181b',
                    border: hoveredId === c.id ? '1px solid #9146ff' : '1px solid rgba(255,255,255,0.05)',
                    transform: hoveredId === c.id ? 'translateY(-4px)' : 'none',
                    transition:'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: hoveredId === c.id ? '0 12px 24px rgba(0,0,0,0.6)' : 'none'
                  }}
                >
                  <div style={{position:'relative', paddingBottom:'56.25%', background:'#000'}}>
                    <img
                      src={`${c.thumbnail}?t=${Date.now()}`}
                      alt={c.name}
                      style={{
                        position:'absolute', inset:0, width:'100%', height:'100%',
                        objectFit:'cover', opacity: hoveredId === c.id ? 0.8 : 1,
                        transition: 'opacity 0.2s'
                      }}
                      onError={e => {
                        // Improved fallback: Try a slightly different size or show the branded placeholder
                        if (!e.target.dataset.triedFallback) {
                           e.target.dataset.triedFallback = 'true';
                           e.target.src = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${c.id.toLowerCase()}-440x250.jpg`;
                        } else {
                           e.target.src = 'https://static-cdn.jtvnw.net/ttv-static/404_preview-440x248.jpg';
                        }
                      }}
                    />
                    
                    {/* Category Badge */}
                    <div style={{
                      position:'absolute', top:8, left:8,
                      background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)',
                      padding:'3px 8px', borderRadius:6, fontSize:10, fontWeight:700,
                      color:'#fff', border:'1px solid rgba(255,255,255,0.1)',
                      textTransform:'uppercase', letterSpacing:'0.5px',
                      zIndex: 2
                    }}>
                      {c.category}
                    </div>

                    {hoveredId === c.id && (
                      <div style={{
                        position:'absolute', inset:0, display:'flex',
                        alignItems:'center', justifyContent:'center',
                        background:'rgba(145, 70, 255, 0.15)',
                        zIndex: 1
                      }}>
                        <div style={{
                          width:44, height:44, borderRadius:'50%',
                          background:'#9146ff',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          boxShadow:'0 0 20px rgba(145,70,255,0.5)'
                        }}>
                          <Play size={18} fill="#fff" color="#fff" style={{marginLeft:2}}/>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{padding:'12px'}}>
                    <div style={{
                      fontSize:14, fontWeight:800, color:'#efeff1',
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'
                    }}>
                      {c.name}
                    </div>
                    <div style={{
                      fontSize:11, color:'#adadb8', marginTop:4,
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      fontWeight: 500, opacity: 0.8
                    }}>
                      {c.title}
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
        ::-webkit-scrollbar{width:6px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#2f2f35;border-radius:3px;}
        ::-webkit-scrollbar-thumb:hover{background:#3f3f45;}
      `}</style>
    </div>
  );
}





