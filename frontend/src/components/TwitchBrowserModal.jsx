import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Search, Play, User, Tv } from 'lucide-react';
import { FaTwitch } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const SOCKET_SERVER_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `http://${window.location.hostname}:3001`
  : `https://${window.location.hostname}`;

export default function TwitchBrowserModal({ onSelect, onClose, isLight }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hoveredId, setHoveredId] = useState(null);
  const [activeTag, setActiveTag] = useState('All');
  const [isCloseHovered, setIsCloseHovered] = useState(false);
  const inputRef = useRef(null);

  const tags = ['All', 'Just Chatting', 'Gaming', 'Music', 'Esports', 'Art'];

  useEffect(() => { inputRef.current?.focus(); }, []);

  const fetchTopStreams = useCallback(async (category = 'All') => {
    setLoading(true);
    try {
      const r = await fetch(`${SOCKET_SERVER_URL}/api/twitch/top`);
      let data = await r.json();
      if (category !== 'All') {
        data = data.filter(c => c.category === category || c.category.toLowerCase().includes(category.toLowerCase()));
      }
      setResults(data);
    } catch {
      setError(t('failedToLoadTopStreams', 'Failed to load top streams.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback(async (q) => {
    if (!q.trim()) {
      fetchTopStreams(activeTag);
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
      setError(t('searchFailed', 'Search failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [onSelect, onClose, fetchTopStreams, activeTag]);

  useEffect(() => {
    fetchTopStreams(activeTag);
  }, [fetchTopStreams, activeTag]);

  // Debounced search logic
  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim()) search(query);
      else fetchTopStreams(activeTag);
    }, 400);
    return () => clearTimeout(t);
  }, [query, search, fetchTopStreams, activeTag]);

  const handleKey = (e) => { if (e.key === 'Enter') search(query); };

  const pick = (channel) => {
    onSelect(`https://www.twitch.tv/${channel.id}`);
    onClose();
  };

  const bgColor = isLight ? 'rgba(255, 255, 255, 0.75)' : 'rgba(14, 14, 16, 0.85)';
  const textColor = isLight ? '#1f1f23' : '#efeff1';
  const subTextColor = isLight ? '#53535f' : '#adadb8';
  const borderColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(145,70,255,0.15)';
  const inputBg = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)';
  const accentColor = '#9146ff';

  return (
    <div
      className="room-modals-overlay"
      onClick={onClose}
      style={{
        position:'fixed', inset:0, background: isLight ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.85)', zIndex:20000,
        display:'flex', alignItems:'center', justifyContent:'center',
        backdropFilter:'blur(12px)'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: bgColor, border: `1px solid ${borderColor}`,
          borderRadius:24, width:'min(840px, 96vw)', maxHeight:'85vh',
          display:'flex', flexDirection:'column', position:'relative',
          boxShadow: isLight ? '0 30px 60px rgba(0,0,0,0.1)' : '0 24px 80px rgba(0,0,0,0.6)',
          fontFamily:"'Outfit',sans-serif",
          overflow: 'hidden',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}
      >
        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent: 'space-between',
          padding:'20px 24px', borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
          flexShrink:0
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{
              width:40, height:40, borderRadius:12,
              background: accentColor,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
              boxShadow: 'none'
            }}>
              <FaTwitch size={20} color="#fff"/>
            </div>
            <div>
              <span style={{fontWeight:800, fontSize:19, color: textColor, display:'block', letterSpacing:'-0.5px'}}>{t('twitchBrowser', 'Twitch Browser')}</span>
              <span style={{fontSize:11, color: accentColor, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.5px'}}>{t('liveDiscovery', 'Live Discovery')}</span>
            </div>
          </div>
          
          <button
             onClick={onClose}
             style={{
               width: 38, height: 38, borderRadius: '50%', 
               background: isCloseHovered ? accentColor : (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'),
               border: 'none', 
               color: isCloseHovered ? '#fff' : textColor, 
               display: 'flex', alignItems: 'center', justifyContent: 'center',
               cursor: 'pointer', transition: 'all 0.2s'
             }}
             onMouseEnter={() => setIsCloseHovered(true)}
             onMouseLeave={() => setIsCloseHovered(false)}
           >
             <X size={20} className={isCloseHovered ? "stay-white" : ""} />
           </button>
        </div>

        {/* Search & Tabs Area */}
        <div style={{padding:'20px 24px 12px', flexShrink:0, display:'flex', flexDirection:'column', gap:16}}>
          {/* Search bar */}
          <div style={{
            display:'flex', gap:14, 
            background: inputBg,
            border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)'}`, 
            borderRadius:100, padding:'14px 22px', alignItems:'center',
            boxShadow: 'none',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
          }} onFocusCapture={e => {
            e.currentTarget.style.borderColor = accentColor;
            e.currentTarget.style.background = isLight ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.1)';
          }} onBlurCapture={e => {
            e.currentTarget.style.borderColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)';
            e.currentTarget.style.background = inputBg;
          }}>
            <Search size={18} color={isLight ? '#999' : '#666'}/>
            <input
              id="twitch-search-input"
              ref={inputRef}
              className="discovery-search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder={t('searchTwitchPlaceholder', 'Search for a streamer or paste a link...')}
              style={{
                flex:1, fontFamily:'inherit', fontSize:15
              }}
            />
            {query && (
               <button onClick={() => setQuery('')} style={{ background:'transparent', border:'none', color: subTextColor, cursor:'pointer' }}>
                <X size={16} />
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
                  padding:'8px 18px', borderRadius:'100px', fontSize:13, fontWeight:700,
                  whiteSpace:'nowrap', cursor:'pointer', transition:'all 0.2s',
                  background: activeTag === tag ? accentColor : 'transparent',
                  color: activeTag === tag ? '#fff' : (isLight ? '#000' : '#efeff1'),
                  border: `1px solid ${activeTag === tag ? accentColor : (isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)')}`,
                  boxShadow: 'none'
                }}
                onMouseEnter={e => { if(activeTag !== tag) e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)' }}
                onMouseLeave={e => { if(activeTag !== tag) e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)' }}
              >
                {t(`tag${tag.replace(/\s+/g, '')}`, tag)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1, overflowY:'auto', padding:'4px 24px 24px'}}>
          {error && (
            <div style={{
              textAlign:'center', color:'#ff8080', fontSize:14,
              background:'rgba(255,128,128,0.1)', borderRadius:14,
              padding:'20px', margin:'12px 0', border: '1px solid rgba(255,128,128,0.2)'
            }}>{error}</div>
          )}

          {!loading && results.length === 0 && !error && (
            <div style={{
              textAlign:'center', color: subTextColor, fontSize:14,
              padding:'80px 0', display:'flex', flexDirection:'column',
              alignItems:'center', gap:20
            }}>
              <Tv size={64} strokeWidth={1} opacity={0.2}/>
              <p style={{margin:0, maxWidth: 300, lineHeight: 1.6}}>{t('noLiveStreamsFound', "We couldn't find any live streams in this category. Try searching for something else!")}</p>
            </div>
          )}

          <div style={{
            display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',
            gap:24, marginTop:10
          }}>
            {loading ? (
               Array.from({length:8}).map((_,i) => (
                <div key={i} style={{borderRadius:16, overflow:'hidden', background: isLight ? '#f2f2f7' : '#18181b', border: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`}}>
                  <div style={{width:'100%', paddingBottom:'56.25%', background: isLight ? '#e5e5ea' : 'rgba(255,255,255,0.03)', animation:'pulse 1.5s infinite'}}/>
                  <div style={{padding:16}}>
                    <div style={{height:16, borderRadius:4, background: isLight ? '#e5e5ea' : 'rgba(255,255,255,0.04)', marginBottom:10, width:'75%'}}/>
                    <div style={{height:12, borderRadius:4, background: isLight ? '#f2f2f7' : 'rgba(255,255,255,0.02)', width:'45%'}}/>
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
                    borderRadius:16, overflow:'hidden', cursor:'pointer',
                    background: hoveredId === c.id ? (isLight ? '#fff' : '#1f1f23') : (isLight ? '#fff' : '#18181b'),
                    border: hoveredId === c.id ? `1px solid ${accentColor}` : `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
                    transform: hoveredId === c.id ? 'translateY(-6px)' : 'none',
                    transition:'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: hoveredId === c.id ? (isLight ? '0 12px 24px rgba(0,0,0,0.1)' : '0 12px 30px rgba(0,0,0,0.7)') : 'none'
                  }}
                >
                  <div style={{position:'relative', paddingBottom:'56.25%', background:'#000'}}>
                    <img
                      src={c.thumbnail}
                      alt={c.name}
                      style={{
                        position:'absolute', inset:0, width:'100%', height:'100%',
                        objectFit:'cover', opacity: hoveredId === c.id ? 0.7 : 1,
                        transition: 'opacity 0.3s'
                      }}
                      onError={e => {
                         e.target.src = 'https://static-cdn.jtvnw.net/ttv-static/404_preview-440x248.jpg';
                      }}
                    />
                    
                    {/* Live Badge */}
                    <div className="stay-white" style={{
                      position:'absolute', top:10, left:10,
                      background:'#eb0400',
                      padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:900,
                      color:'#fff', textTransform:'uppercase', letterSpacing:'1px',
                      zIndex: 2, boxShadow: '0 2px 8px rgba(235,4,0,0.4)'
                    }}>
                      {t('liveBadge', 'LIVE')}
                    </div>

                    {/* Category Badge */}
                    <div className="stay-white" style={{
                      position:'absolute', bottom:10, left:10,
                      background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)',
                      padding:'3px 10px', borderRadius:8, fontSize:10, fontWeight:700,
                      color:'#fff', border:'1px solid rgba(255,255,255,0.15)',
                      textTransform:'uppercase', letterSpacing:'0.5px',
                      zIndex: 2
                    }}>
                      {c.category}
                    </div>

                    {hoveredId === c.id && (
                      <div style={{
                        position:'absolute', inset:0, display:'flex',
                        alignItems:'center', justifyContent:'center',
                        background:'rgba(145, 70, 255, 0.1)',
                        zIndex: 1
                      }}>
                        <div style={{
                          width:52, height:52, borderRadius:'50%',
                          background: accentColor,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          boxShadow:'0 0 25px rgba(145,70,255,0.6)',
                          transform: 'scale(1.1)', transition: 'transform 0.2s'
                        }}>
                          <Play size={22} fill="#fff" color="#fff" style={{marginLeft:3}}/>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{padding:'16px'}}>
                    <div style={{
                      fontSize:15, fontWeight:800, color: textColor,
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      letterSpacing: '-0.3px'
                    }}>
                      {c.name}
                    </div>
                    <div style={{
                      fontSize:12, color: subTextColor, marginTop:6,
                      display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical',
                      overflow:'hidden', height: 34, lineHeight: 1.4, fontWeight: 500
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
        #twitch-search-input, .discovery-search-input {
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
        html[data-theme='light'] #twitch-search-input {
          background: transparent !important;
          background-color: transparent !important;
        }
        /* Aggressively kill any browser-default background */
        input.discovery-search-input:-webkit-autofill,
        input.discovery-search-input:-webkit-autofill:hover, 
        input.discovery-search-input:-webkit-autofill:focus, 
        input.discovery-search-input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px ${isLight ? 'rgba(0,0,0,0.07)' : '#18181b'} inset !important;
          -webkit-text-fill-color: ${textColor} !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        .discovery-search-input::placeholder {
          color: ${isLight ? '#999' : '#666'} !important;
        }
        .stay-white { color: #fff !important; }
        ::-webkit-scrollbar{width:8px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${isLight ? '#ddd' : '#2f2f35'};border-radius:10px;border: 2px solid ${bgColor};}
        ::-webkit-scrollbar-thumb:hover{background:${isLight ? '#ccc' : '#3f3f45'};}
      `}</style>
    </div>
  );
}





