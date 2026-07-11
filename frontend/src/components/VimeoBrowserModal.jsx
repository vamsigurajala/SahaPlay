import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Search, Play, Tv, Film } from 'lucide-react';
import { FaVimeo } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { SOCKET_URL as SOCKET_SERVER_URL } from '../lib/api';

export default function VimeoBrowserModal({ onSelect, onClose, isLight }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hoveredId, setHoveredId] = useState(null);
  const [activeTag, setActiveTag] = useState('Staff Picks');
  const [isCloseHovered, setIsCloseHovered] = useState(false);
  const inputRef = useRef(null);

  const tags = ['Staff Picks', 'Animation', 'Creative', 'Arts', 'Cinema', 'Experimental'];

  useEffect(() => { inputRef.current?.focus(); }, []);

  const fetchTopVideos = useCallback(async (tag = 'Staff Picks') => {
    setLoading(true);
    try {
      const r = await fetch(`${SOCKET_SERVER_URL}/api/vimeo/top`);
      let data = await r.json();
      if (tag !== 'Staff Picks') {
        data = data.filter(v => v.category === tag);
      }
      setResults(data);
    } catch {
      setError(t('failedToLoadStaffPicks', 'Failed to load Staff Picks.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback(async (q) => {
    if (!q.trim()) {
      fetchTopVideos(activeTag);
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
      setError(t('searchFailed', 'Search failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [onSelect, onClose, fetchTopVideos, activeTag]);

  useEffect(() => {
    fetchTopVideos(activeTag);
  }, [fetchTopVideos, activeTag]);

  // Debounced search logic
  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim()) search(query);
    }, 400);
    return () => clearTimeout(t);
  }, [query, search]);

  const handleKey = (e) => { if (e.key === 'Enter') search(query); };

  const pick = (video) => {
    onSelect(`https://vimeo.com/${video.id}`);
    onClose();
  };

  const bgColor = isLight ? 'rgba(255, 255, 255, 0.75)' : 'rgba(15, 15, 18, 0.85)';
  const textColor = isLight ? '#1a1a1a' : '#fff';
  const subTextColor = isLight ? '#666' : '#999';
  const borderColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
  const inputBg = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)';
  const accentColor = '#00adef';

  return (
    <div
      className="room-modals-overlay"
      onClick={onClose}
      style={{
        position:'fixed', inset:0, background: isLight ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.9)', zIndex:20000,
        display:'flex', alignItems:'center', justifyContent:'center',
        backdropFilter:'blur(15px)'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: bgColor, border: `1px solid ${borderColor}`,
          borderRadius:28, width:'min(860px, 96vw)', maxHeight:'85vh',
          display:'flex', flexDirection:'column', position:'relative',
          boxShadow: isLight ? '0 40px 100px rgba(0,0,0,0.08)' : '0 30px 100px rgba(0,0,0,0.6)',
          fontFamily:"'Outfit',sans-serif",
          overflow: 'hidden',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}
      >
        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent: 'space-between',
          padding:'30px 30px 20px', borderBottom: `1px solid ${borderColor}`,
          flexShrink:0
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{
              width:44, height:44, borderRadius:14,
              background: accentColor,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
              boxShadow: 'none'
            }}>
              <FaVimeo size={22} color="#fff"/>
            </div>
            <div style={{ display:'flex', flexDirection:'column' }}>
              <span style={{fontWeight:800, fontSize:22, color: textColor, letterSpacing:'-0.5px'}}>{t('vimeoCinema', 'Vimeo Cinema')}</span>
              <span style={{fontSize:12, color: accentColor, fontWeight:800, letterSpacing:1, textTransform:'uppercase'}}>{t('staffPicksAndFilms', 'Staff Picks & Films')}</span>
            </div>
          </div>
          
          <button
            onClick={onClose}
            style={{
              width: 40, height: 40, borderRadius: '50%', 
              background: isCloseHovered ? accentColor : (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'), 
              border: 'none', 
              color: isCloseHovered ? '#fff' : textColor, 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.3s'
            }}
            onMouseEnter={() => setIsCloseHovered(true)}
            onMouseLeave={() => setIsCloseHovered(false)}
          >
            <X size={20} className={isCloseHovered ? "stay-white" : ""} />
          </button>
        </div>

        {/* Search & Tags Area */}
        <div style={{padding:'20px 30px 15px', flexShrink:0, display:'flex', flexDirection:'column', gap:20}}>
          {/* Search bar */}
          <div style={{
            display:'flex', gap:14, 
            background: inputBg,
            border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)'}`, borderRadius:100,
            padding:'14px 22px', alignItems:'center',
            boxShadow: 'none',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
          }} onFocusCapture={e => {
            e.currentTarget.style.borderColor = accentColor;
            e.currentTarget.style.background = isLight ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.1)';
          }} onBlurCapture={e => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.background = inputBg;
          }}>
            <Search size={22} color={isLight ? '#999' : '#666'}/>
            <input
              id="vimeo-search-input"
              ref={inputRef}
              className="discovery-search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder={t('searchVimeoPlaceholder', 'Search cinematic films or paste a link...')}
              style={{
                flex:1, fontFamily:'inherit', fontSize:16
              }}
            />
            {query && (
               <button onClick={() => setQuery('')} style={{ background:'transparent', border:'none', color: subTextColor, cursor:'pointer' }}>
                <X size={18} />
              </button>
            )}
          </div>

          {/* Tags */}
          <div style={{display:'flex', gap:10, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none'}}>
            {tags.map(tag => (
              <button
                key={tag}
                className={activeTag === tag ? "stay-white" : ""}
                onClick={() => { setActiveTag(tag); setQuery(''); }}
                style={{
                  padding:'10px 22px', borderRadius:'100px', fontSize:14, fontWeight:700,
                  whiteSpace:'nowrap', cursor:'pointer', transition:'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  background: activeTag === tag ? accentColor : 'transparent',
                  color: activeTag === tag ? '#fff' : textColor,
                  border: `1px solid ${activeTag === tag ? accentColor : borderColor}`,
                  boxShadow: 'none',
                  transform: activeTag === tag ? 'scale(1.05)' : 'scale(1)'
                }}
                onMouseEnter={e => { if(activeTag !== tag) e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)' }}
                onMouseLeave={e => { if(activeTag !== tag) e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : '#1a1a1e' }}
              >
                {t(`tag${tag.replace(/\s+/g, '')}`, tag)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1, overflowY:'auto', padding:'0 30px 30px'}}>
          {error && (
            <div style={{
              textAlign:'center', color:'#ff3b30', fontSize:15,
              background:'rgba(255,59,48,0.05)', borderRadius:18,
              padding:'24px', margin:'12px 0', fontWeight: 600
            }}>{error}</div>
          )}

          {!loading && results.length === 0 && !error && (
            <div style={{
              textAlign:'center', color: subTextColor, fontSize:16,
              padding:'80px 0', display:'flex', flexDirection:'column',
              alignItems:'center', gap:24
            }}>
              <Film size={64} strokeWidth={1} opacity={0.3}/>
              <p style={{margin:0, maxWidth: 320, lineHeight: 1.6, fontWeight: 500}}>{t('vimeoNoResults', 'No masterpieces found in this category. Try exploring other tags or search directly.')}</p>
            </div>
          )}

          <div style={{
            display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',
            gap:28, marginTop:10
          }}>
            {loading ? (
               Array.from({length:6}).map((_,i) => (
                <div key={i} style={{borderRadius:24, overflow:'hidden', background: isLight ? '#f5f5f7' : '#1a1a1e'}}>
                  <div style={{width:'100%', paddingBottom:'56.25%', background:'rgba(0,0,0,0.03)', animation:'pulse 1.5s infinite'}}/>
                  <div style={{padding:20}}>
                    <div style={{height:20, borderRadius:6, background: isLight ? '#e5e5e7' : 'rgba(255,255,255,0.04)', marginBottom:12, width:'85%'}}/>
                    <div style={{height:14, borderRadius:4, background: isLight ? '#f5f5f7' : 'rgba(255,255,255,0.02)', width:'55%'}}/>
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
                    borderRadius:24, overflow:'hidden', cursor:'pointer',
                    background: isLight ? '#fff' : '#1a1a1e',
                    border: hoveredId === v.id ? `1px solid ${accentColor}` : `1px solid ${borderColor}`,
                    transform: hoveredId === v.id ? 'translateY(-8px)' : 'none',
                    transition:'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    boxShadow: hoveredId === v.id ? (isLight ? '0 25px 50px rgba(0,0,0,0.1)' : '0 20px 40px rgba(0,0,0,0.8)') : '0 4px 12px rgba(0,0,0,0.03)'
                  }}
                >
                  <div style={{position:'relative', paddingBottom:'56.25%', background:'#000'}}>
                    <img
                      src={v.thumbnail}
                      alt={v.name}
                      style={{
                        position:'absolute', inset:0, width:'100%', height:'100%',
                        objectFit:'cover', opacity: hoveredId === v.id ? 0.8 : 1,
                        transition: 'opacity 0.4s'
                      }}
                      onError={e => {
                        e.target.src = 'https://i.vimeocdn.com/video/default-video_640';
                      }}
                    />
                    
                    {/* Category Badge */}
                    <div style={{
                      position:'absolute', top:14, left:14,
                      background: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.7)', 
                      backdropFilter:'blur(10px)',
                      padding:'5px 12px', borderRadius:10, fontSize:11, fontWeight:800,
                      color: accentColor, boxShadow:'0 4px 15px rgba(0,0,0,0.1)',
                      textTransform:'uppercase', letterSpacing:'1.2px',
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
                          width:56, height:56, borderRadius:'50%',
                          background: accentColor,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          boxShadow:'0 12px 30px rgba(0,173,239,0.5)',
                          transform: 'scale(1.15)', transition: 'transform 0.3s ease-out'
                        }}>
                          <Play size={24} fill="#fff" color="#fff" style={{marginLeft:4}}/>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{padding:'20px 24px'}}>
                    <div style={{
                      fontSize:17, fontWeight:800, color: textColor,
                      lineHeight:1.3, marginBottom:8, letterSpacing: '-0.3px'
                    }}>
                      {v.name}
                    </div>
                    <div style={{
                      fontSize:14, color: subTextColor,
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      fontWeight: 500, opacity: 0.9
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
        #vimeo-search-input, .discovery-search-input {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          color: ${textColor} !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          width: 100%;
          padding: 0 !important;
          margin: 0 !important;
        }
        /* Overriding global light mode overrides */
        html[data-theme='light'] #vimeo-search-input {
          background: transparent !important;
          background-color: transparent !important;
        }
        /* Aggressively kill any browser-default background */
        input.discovery-search-input:-webkit-autofill,
        input.discovery-search-input:-webkit-autofill:hover, 
        input.discovery-search-input:-webkit-autofill:focus, 
        input.discovery-search-input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px ${isLight ? 'rgba(0,0,0,0.07)' : '#1a1a1e'} inset !important;
          -webkit-text-fill-color: ${textColor} !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        .discovery-search-input::placeholder {
          color: ${isLight ? '#999' : '#666'} !important;
        }
        .stay-white { color: #fff !important; }
        ::-webkit-scrollbar{width:8px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${isLight ? '#eee' : '#222'};border-radius:10px;border:2px solid ${bgColor};}
        ::-webkit-scrollbar-thumb:hover{background:${isLight ? '#ddd' : '#333'};}
      `}</style>
    </div>
  );
}





