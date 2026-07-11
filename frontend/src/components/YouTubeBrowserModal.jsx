import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Search, Play, Clock, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SOCKET_URL as SOCKET_SERVER_URL } from '../lib/api';

function formatDur(secs) {
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

export default function YouTubeBrowserModal({ onSelect, onClose, isLight }) {
  const { t } = useTranslation();
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [hoveredId, setHoveredId] = useState(null);
  const [activeTag, setActiveTag] = useState('Trending');
  const [isCloseHovered, setIsCloseHovered] = useState(false);
  const inputRef = useRef(null);

  const tags = ['Trending', 'Live', 'Music', 'Gaming', 'News', 'Movies'];

  useEffect(() => { inputRef.current?.focus(); }, []);

  const search = useCallback(async (q, isTag = false) => {
    const searchTerm = q.trim() || (isTag ? activeTag : 'top trending videos');
    
    // Detect direct YouTube URLs
    if (!isTag && searchTerm.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/))([a-zA-Z0-9_-]{11})/i)) {
      const ytMatch = searchTerm.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/))([a-zA-Z0-9_-]{11})/i);
      onSelect(`https://www.youtube.com/watch?v=${ytMatch[1]}`);
      onClose();
      return;
    }

    setLoading(true); setError('');
    try {
      // For tags, we append the category to search
      const finalQuery = isTag ? `top ${q} videos` : q;
      const r = await fetch(`${SOCKET_SERVER_URL}/api/youtube/search?q=${encodeURIComponent(finalQuery)}`);
      const data = await r.json();
      if (data.error) { setError(data.error); return; }
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setError(t('searchServiceError', 'Could not reach search service. Check your connection.'));
    } finally { setLoading(false); }
  }, [onSelect, onClose, activeTag]);

  // Initial load
  useEffect(() => {
    search(activeTag, true);
  }, []);

  const handleTagClick = (tag) => {
    setActiveTag(tag);
    setQuery('');
    search(tag, true);
  };

  const handleKey = (e) => { if (e.key === 'Enter') search(query); };

  const pick = (video) => {
    onSelect(`https://www.youtube.com/watch?v=${video.videoId}`);
    onClose();
  };

  const bgColor = isLight ? 'rgba(255, 255, 255, 0.75)' : 'rgba(15, 15, 23, 0.85)';
  const textColor = isLight ? '#1a1a1a' : '#fff';
  const subTextColor = isLight ? '#666' : '#aaa';
  const borderColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
  const inputBg = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)';

  return (
    <div
      className="room-modals-overlay"
      onClick={onClose}
      style={{
        position:'fixed', inset:0, background: isLight ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.75)', zIndex:20000,
        display:'flex', alignItems:'center', justifyContent:'center',
        backdropFilter:'blur(10px)'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: bgColor, border: `1px solid ${borderColor}`,
          borderRadius:24, width:'min(840px, 96vw)', maxHeight:'85vh',
          display:'flex', flexDirection:'column', position:'relative',
          boxShadow: isLight ? '0 20px 50px rgba(0,0,0,0.08)' : '0 24px 80px rgba(0,0,0,0.6)',
          fontFamily:"'Outfit',sans-serif",
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}
      >
        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent: 'space-between',
          padding:'20px 24px', borderBottom: `1px solid ${borderColor}`,
          flexShrink:0
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{
              width:36, height:36, borderRadius:10,
              background:'linear-gradient(135deg,#ef4444,#dc2626)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow: 'none'
            }}>
              <Play size={16} fill="#fff" color="#fff"/>
            </div>
            <div>
              <span style={{fontWeight:800, fontSize:18, color: textColor, display:'block', letterSpacing:'-0.5px'}}>{t('youtubeDiscovery', 'YouTube Discovery')}</span>
              <span style={{fontSize:11, color: subTextColor, fontWeight:600, textTransform:'uppercase'}}>{t('exploreTrending', 'Explore trending content')}</span>
            </div>
          </div>
          
           <button
             onClick={onClose}
             style={{
               width: 36, height: 36, borderRadius: '50%', 
               background: isCloseHovered ? '#ef4444' : (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'),
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

        {/* Search & Tags Area */}
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
            e.currentTarget.style.borderColor = '#ef4444';
            e.currentTarget.style.background = isLight ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.1)';
          }} onBlurCapture={e => {
            e.currentTarget.style.borderColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)';
            e.currentTarget.style.background = inputBg;
          }}>
            <Search size={18} color={isLight ? '#666' : '#999'}/>
            <input
              id="yt-search-input"
              ref={inputRef}
              className="discovery-search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder={t('searchYouTubePlaceholder', 'Search YouTube or paste a video link...')}
              style={{
                flex:1, fontFamily:'inherit', fontSize:15
              }}
            />
            {query.trim() && (
               <button
                className="stay-white"
                onClick={() => search(query)}
                style={{
                  background:'#ef4444', border:'none', borderRadius:100, padding:'6px 18px',
                  color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
                  boxShadow: 'none'
                }}
              >
                {t('search', 'Search')}
              </button>
            )}
          </div>

          {/* Tags */}
          <div style={{display:'flex', gap:8, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none'}}>
            {tags.map(tag => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                style={{
                  padding:'8px 16px', borderRadius:'100px', fontSize:13, fontWeight:700,
                  whiteSpace:'nowrap', cursor:'pointer', transition:'all 0.2s',
                  background: activeTag === tag ? '#ef4444' : 'transparent',
                  color: activeTag === tag ? '#fff' : textColor,
                  border: `1px solid ${activeTag === tag ? '#ef4444' : (isLight ? 'rgba(0,0,0,0.1)' : borderColor)}`,
                  boxShadow: 'none'
                }}
                className={activeTag === tag ? "stay-white" : ""}
                onMouseEnter={e => { if(activeTag !== tag) e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)' }}
                onMouseLeave={e => { if(activeTag !== tag) e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)' }}
              >
                {t(`tag${tag.replace(/\s+/g, '')}`, tag)}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div style={{flex:1, overflowY:'auto', padding:'4px 24px 24px'}}>
          {error && (
            <div style={{
              textAlign:'center', color:'#ef4444', fontSize:14,
              background:'rgba(239,68,68,0.08)', borderRadius:16,
              padding:'20px', margin:'12px 0', fontWeight: 500
            }}>{error}</div>
          )}
          
          {!loading && !error && results.length === 0 && (
            <div style={{
              textAlign:'center', color: subTextColor, fontSize:14,
              padding:'60px 0', display:'flex', flexDirection:'column',
              alignItems:'center', gap:16
            }}>
              <Search size={48} opacity={0.2}/>
              <p style={{margin:0, maxWidth:300, lineHeight:1.6}}>{t('ytNoResults', 'Try searching for something specific or explore the categories above.')}</p>
            </div>
          )}

          <div style={{
            display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',
            gap:20, marginTop:8
          }}>
            {loading ? (
              Array.from({length:8}).map((_,i) => (
                <div key={i} style={{borderRadius:16, overflow:'hidden', background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.03)'}}>
                  <div style={{width:'100%', paddingBottom:'56.25%', background: isLight ? '#e5e7eb' : 'rgba(255,255,255,0.05)', animation:'pulse 1.5s infinite'}}/>
                  <div style={{padding:'14px'}}>
                    <div style={{height:14, borderRadius:4, background: isLight ? '#e5e7eb' : 'rgba(255,255,255,0.05)', marginBottom:10, width:'85%'}}/>
                    <div style={{height:10, borderRadius:4, background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.03)', width:'50%'}}/>
                  </div>
                </div>
              ))
            ) : (
              results.map(v => (
                <div
                  key={v.videoId}
                  onClick={() => pick(v)}
                  onMouseEnter={() => setHoveredId(v.videoId)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    borderRadius:16, overflow:'hidden', cursor:'pointer',
                    background: hoveredId === v.videoId ? (isLight ? '#fff' : 'rgba(255,255,255,0.08)') : (isLight ? '#fff' : 'rgba(255,255,255,0.04)'),
                    border: `1px solid ${hoveredId === v.videoId ? '#ef4444' : borderColor}`,
                    transform: hoveredId === v.videoId ? 'translateY(-4px)' : 'none',
                    transition:'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: hoveredId === v.videoId ? (isLight ? '0 12px 24px rgba(0,0,0,0.08)' : '0 12px 30px rgba(0,0,0,0.5)') : 'none'
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{position:'relative', paddingBottom:'56.25%', background:'#000'}}>
                    <img
                      src={v.thumbnail}
                      alt={v.title}
                      style={{
                        position:'absolute', inset:0, width:'100%', height:'100%',
                        objectFit:'cover', opacity: hoveredId === v.videoId ? 0.8 : 1,
                        transition: 'opacity 0.2s'
                      }}
                    />
                    {/* Duration badge */}
                    {v.lengthSeconds > 0 && (
                      <div className="stay-white" style={{
                        position:'absolute', bottom:8, right:8,
                        background:'rgba(0,0,0,0.8)', backdropFilter:'blur(4px)',
                        borderRadius:6, padding:'3px 7px', fontSize:11, color:'#fff', fontWeight:700,
                        display:'flex', alignItems:'center', gap:4
                      }}>
                        {formatDur(v.lengthSeconds)}
                      </div>
                    )}
                    
                    {hoveredId === v.videoId && (
                      <div style={{
                        position:'absolute', inset:0, display:'flex',
                        alignItems:'center', justifyContent:'center',
                        background:'rgba(0,0,0,0.2)'
                      }}>
                        <div style={{
                          width:48, height:48, borderRadius:'50%',
                          background:'#ef4444',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          boxShadow:'0 0 20px rgba(239,68,68,0.5)',
                          transform:'scale(1.1)', transition:'transform 0.2s'
                        }}>
                          <Play size={20} fill="#fff" color="#fff" style={{marginLeft:2}}/>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div style={{padding:'14px'}}>
                    <div style={{
                      fontSize:14, fontWeight:700, color: textColor,
                      lineHeight:'1.4', display:'-webkit-box',
                      WebkitLineClamp:2, WebkitBoxOrient:'vertical',
                      overflow:'hidden', marginBottom:8, height: 40
                    }}>
                      {v.title}
                    </div>
                    <div style={{
                      display:'flex', alignItems:'center', gap:6,
                      color: subTextColor, fontSize:12, fontWeight: 500
                    }}>
                      <div style={{
                        width:20, height:20, borderRadius:'50%', background: isLight ? '#e5e7eb' : 'rgba(255,255,255,0.1)',
                        display:'flex', alignItems:'center', justifyContent:'center'
                      }}>
                        <User size={12}/>
                      </div>
                      <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{v.author}</span>
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
        #yt-search-input, .discovery-search-input {
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
        html[data-theme='light'] #yt-search-input {
          background: transparent !important;
          background-color: transparent !important;
        }
        /* Aggressively kill any browser-default background */
        input.discovery-search-input:-webkit-autofill,
        input.discovery-search-input:-webkit-autofill:hover, 
        input.discovery-search-input:-webkit-autofill:focus, 
        input.discovery-search-input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px ${isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)'} inset !important;
          -webkit-text-fill-color: ${textColor} !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        .discovery-search-input::placeholder {
          color: ${isLight ? '#999' : '#666'} !important;
        }
        .stay-white { color: #fff !important; }
        ::-webkit-scrollbar{width:6px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${isLight ? '#ddd' : '#333'};border-radius:10px;}
        ::-webkit-scrollbar-thumb:hover{background:${isLight ? '#ccc' : '#444'};}
      `}</style>
    </div>
  );
}





