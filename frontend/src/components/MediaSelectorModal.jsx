import React, { useRef, useState } from 'react';
import { X, Monitor, Link as LinkIcon, Upload, ChevronRight } from 'lucide-react';

import { FaYoutube, FaTwitch, FaVimeo, FaInstagram, FaApple, FaSpotify, FaTiktok, FaSoundcloud } from 'react-icons/fa';
import { SiNetflix, SiCrunchyroll, SiHbomax, SiAppletv } from 'react-icons/si';
import { GiGolfFlag, GiPoolTriangle, GiSnake, GiRaceCar, GiPistolGun } from 'react-icons/gi';

const OPTIONS = [
  // Quick Actions
  { id: 'screenshare', name: 'Screen Share', category: 'Quick Actions', bgColor: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.05) 100%)', color: '#10b981', icon: Monitor, type: 'action', action: 'screenshare' },
  { id: 'custom', name: 'Paste URL', category: 'Quick Actions', bgColor: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(99,102,241,0.05) 100%)', color: '#a5b4fc', icon: LinkIcon, type: 'action', action: 'url' },
  { id: 'upload', name: 'Upload File', category: 'Quick Actions', bgColor: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(245,158,11,0.05) 100%)', color: '#f59e0b', icon: Upload, type: 'action', action: 'upload' },

  // Streaming & Movies
  { id: 'youtube', name: 'YouTube', category: 'Movies & Video', bgColor: '#18181b', color: '#fff', brandColor: '#FF0000', icon: FaYoutube, type: 'browser', isWide: true, image: '/images/apps/youtube.jpg' },
  { id: 'twitch', name: 'Twitch', category: 'Movies & Video', bgColor: '#18181b', color: '#fff', brandColor: '#9146FF', icon: FaTwitch, type: 'browser', isWide: true, image: '/images/apps/twitch.jpg' },
  { id: 'vimeo', name: 'vimeo', category: 'Movies & Video', bgColor: '#111', color: '#fff', brandColor: '#00adef', icon: FaVimeo, type: 'browser', isWide: true, image: '/images/apps/vimeo.jpg' },
  { id: 'netflix', name: 'NETFLIX', category: 'Movies & Video', bgColor: '#000', color: '#E50914', brandColor: '#E50914', icon: SiNetflix, type: 'placeholder', url: 'https://netflix.com', isWide: true, image: '/images/apps/netflix.jpg' },
  { id: 'appletv', name: 'Apple TV', category: 'Movies & Video', bgColor: '#000', color: '#fff', brandColor: '#a855f7', icon: SiAppletv, type: 'placeholder', url: 'https://tv.apple.com', isWide: true, image: '/images/apps/appletv.jpg' },
  { id: 'prime', name: 'prime video', category: 'Movies & Video', bgColor: '#0F1721', color: '#00A8E1', brandColor: '#00A8E1', type: 'placeholder', url: 'https://primevideo.com', isWide: true, image: '/images/apps/prime.jpg' },
  { id: 'hulu', name: 'hulu', category: 'Movies & Video', bgColor: '#000', color: '#1ce783', brandColor: '#1ce783', type: 'placeholder', url: 'https://hulu.com', isWide: true, image: '/images/apps/hulu.jpg' },
  { id: 'hbomax', name: 'HBO MAX', category: 'Movies & Video', bgColor: '#18002a', color: '#fff', brandColor: '#991ef2', icon: SiHbomax, type: 'placeholder', url: 'https://max.com', isWide: true, image: '/images/apps/hbomax.jpg' },
  { id: 'hotstar', name: 'Disney+ Hotstar', category: 'Movies & Video', bgColor: '#040714', color: '#0063e5', brandColor: '#0063e5', type: 'placeholder', url: 'https://hotstar.com', isWide: true, image: '/images/apps/hotstar.jpg' },
  { id: 'crunchyroll', name: 'Crunchyroll', category: 'Movies & Video', bgColor: '#000', color: '#F47521', brandColor: '#F47521', icon: SiCrunchyroll, type: 'placeholder', url: 'https://crunchyroll.com', isWide: true, image: '/images/apps/crunchyroll.jpg' },

  // Live Web Games
  { id: 'minigolf', name: 'Mini Golf', category: 'Web Games', bgColor: 'linear-gradient(135deg, #059669 0%, #064e3b 100%)', color: '#fff', brandColor: '#10b981', icon: GiGolfFlag, type: 'placeholder', url: 'https://games.crazygames.com/en_US/mini-golf-club/index.html', isWide: true, image: '/images/apps/minigolf.jpg' },
  { id: '8ball', name: '8 Ball Pool', category: 'Web Games', bgColor: 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)', color: '#fff', brandColor: '#3b82f6', icon: GiPoolTriangle, type: 'placeholder', url: 'https://games.crazygames.com/en_US/8-ball-billiards-classic/index.html', isWide: true, image: '/images/apps/8ball.jpg' },
  { id: 'slither', name: 'Slither.io', category: 'Web Games', bgColor: 'linear-gradient(135deg, #a855f7 0%, #4c1d95 100%)', color: '#fff', brandColor: '#a855f7', icon: GiSnake, type: 'placeholder', url: 'https://slither.io', isWide: true, image: '/images/apps/slither.jpg' },
  { id: 'smashkarts', name: 'Smash Karts', category: 'Web Games', bgColor: 'linear-gradient(135deg, #e11d48 0%, #881337 100%)', color: '#fff', brandColor: '#e11d48', icon: GiRaceCar, type: 'placeholder', url: 'https://smashkarts.io', isWide: true, image: '/images/apps/smashkarts.jpg' },
  { id: 'krunker', name: 'Krunker.io', category: 'Web Games', bgColor: 'linear-gradient(135deg, #f59e0b 0%, #78350f 100%)', color: '#fff', brandColor: '#f59e0b', icon: GiPistolGun, type: 'placeholder', url: 'https://krunker.io', isWide: true, image: '/images/apps/krunker.jpg' },
  
  // Music & Podcasts
  { id: 'soundcloud', name: 'SOUNDCLOUD', category: 'Music & Podcasts', bgColor: '#ff5500', color: '#fff', icon: FaSoundcloud, type: 'direct', isWide: true, image: '/images/apps/soundcloud.jpg' },
  { id: 'spotify', name: 'Spotify', category: 'Music & Podcasts', bgColor: '#000', color: '#fff', brandColor: '#1DB954', icon: FaSpotify, type: 'placeholder', url: 'https://open.spotify.com', isWide: true, image: '/images/apps/spotify.jpg' },
  { id: 'apple', name: 'Apple Music', category: 'Music & Podcasts', bgColor: '#fff', color: '#000', icon: FaApple, type: 'placeholder', url: 'https://music.apple.com', isWide: true, image: '/images/apps/apple.jpg' },

  // Social Media
  { id: 'tiktok', name: 'TikTok', category: 'Social Media', bgColor: '#000', color: '#fff', icon: FaTiktok, type: 'placeholder', url: 'https://tiktok.com', isWide: true, image: '/images/apps/tiktok.jpg' },
  { id: 'instagram', name: 'Instagram', category: 'Social Media', bgColor: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', color: '#fff', icon: FaInstagram, type: 'placeholder', url: 'https://instagram.com', isWide: true, image: '/images/apps/instagram.jpg' },
];

// Stateful card component — tracks whether background image loaded successfully
function AppCard({ app, isQuickAction, onClick }) {
  const [imgFailed, setImgFailed] = useState(false);
  const Icon = app.icon;
  const hasImage = app.isWide && app.image && !imgFailed;

  return (
    <button
      onClick={onClick}
      style={{
        background: app.bgColor,
        border: isQuickAction ? `1px solid ${app.color}40` : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        height: isQuickAction ? 100 : 130,
        display: 'flex',
        flexDirection: isQuickAction ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        gap: 12,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s',
        boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.6)';
        if (!isQuickAction) e.currentTarget.style.filter = 'brightness(1.15)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
        if (!isQuickAction) e.currentTarget.style.filter = 'brightness(1)';
      }}
    >
      {/* Quick action inner glow */}
      {isQuickAction && (
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at center, ${app.color}20 0%, transparent 70%)` }} />
      )}

      {/* Background image (for wide app cards) */}
      {app.isWide && app.image && (
        <img
          src={app.image}
          alt={app.name}
          onError={() => setImgFailed(true)}
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover',
            position: 'absolute', inset: 0,
            zIndex: 0,
            display: imgFailed ? 'none' : 'block'
          }}
        />
      )}

      {/* Fallback: icon + name when no image or image failed */}
      {(!hasImage || isQuickAction) && (
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex',
          flexDirection: isQuickAction ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: isQuickAction ? 14 : 10,
          width: '100%', height: '100%',
          padding: 24,
        }}>
          {Icon && (
            <div style={{
              color: isQuickAction ? app.color : (app.brandColor || app.color || '#fff'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              filter: isQuickAction ? 'none' : 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
            }}>
              <Icon size={isQuickAction ? 32 : 46} />
            </div>
          )}
          <span style={{
            fontSize: isQuickAction ? 15 : (app.id === 'prime' ? 22 : 26),
            fontWeight: 900,
            color: isQuickAction ? app.color : (app.color || '#fff'),
            letterSpacing: isQuickAction ? 0 : '-0.5px',
            textShadow: isQuickAction ? 'none' : '0 1px 4px rgba(0,0,0,0.6)',
            textAlign: 'center',
          }}>
            {app.name}
          </span>
        </div>
      )}

      {/* Red dot for screenshare-required apps */}
      {app.type === 'placeholder' && !isQuickAction && (
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff4444', boxShadow: '0 0 8px #ff4444' }} title="Requires Screenshare" />
        </div>
      )}
    </button>
  );
}

export default function MediaSelectorModal({ onClose, onSelectPlatform, onSelectUrl, onUpload, onScreenshare, onSelectPlaceholder }) {
  const fileInputRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');

  const categories = ['Quick Actions', 'Movies & Video', 'Web Games', 'Music & Podcasts', 'Social Media'];
  
  const sectionRefs = useRef({});
  categories.forEach(cat => {
    if (!sectionRefs.current[cat]) {
      sectionRefs.current[cat] = React.createRef();
    }
  });

  const scrollToSection = (cat) => {
    sectionRefs.current[cat]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleAppClick = (app) => {
    if (app.type === 'action') {
      if (app.action === 'upload') {
        fileInputRef.current?.click();
      } else if (app.action === 'url') {
        setShowUrlInput(prev => !prev);
      } else if (app.action === 'screenshare') {
        onScreenshare();
      }
    } else if (app.type === 'browser') {
      onSelectPlatform(app.id);
    } else if (app.type === 'direct' && app.isSpecialUrl) {
      onSelectUrl(app.url);
    } else if (app.type === 'direct') {
      setShowUrlInput(true);
    } else if (app.type === 'placeholder') {
      if (onSelectPlaceholder) {
        onSelectPlaceholder(app);
      } else {
        window.open(app.url, '_blank');
        onScreenshare();
      }
    }
  };

  const handleUrlSubmit = () => {
    if (customUrl.trim()) onSelectUrl(customUrl.trim());
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(12px)', padding: '24px'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #11111a 0%, #0a0a0f 100%)',
          border: '1px solid rgba(255,255,255,0.06)', position: 'relative',
          borderRadius: 24, width: '100%', maxWidth: 1100, maxHeight: '85vh',
          display: 'flex', flexDirection: 'column', 
          boxShadow: '0 32px 120px rgba(0,0,0,0.9), inset 0 1px 1px rgba(255,255,255,0.05)',
          fontFamily: "'Outfit',sans-serif"
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: -2, right: -60, width: 44, height: 44,
            borderRadius: '50%', background: '#1f1f2e', border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            transition: 'background 0.2s, transform 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background='#2f2f3e'; e.currentTarget.style.transform='scale(1.05)' }}
          onMouseLeave={e => { e.currentTarget.style.background='#1f1f2e'; e.currentTarget.style.transform='scale(1)' }}
        >
          <X size={20} />
        </button>

        <div style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 24,
          padding: '24px 36px', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0
        }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>App Directory</h2>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto', paddingBottom: 4 }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => scrollToSection(cat)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 20, padding: '6px 14px',
                  color: '#ccc', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#ccc'; }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {showUrlInput && (
          <div style={{
            background: 'rgba(99,102,241,0.1)', borderBottom: '1px solid rgba(99,102,241,0.2)',
            padding: '24px 36px', display: 'flex', gap: 12, alignItems: 'center'
          }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', background: '#0a0a0f',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '8px 16px',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
            }}>
              <LinkIcon size={18} color="#6366f1" style={{ marginRight: 12 }} />
              <input 
                autoFocus
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
                placeholder="Paste any YouTube, Twitch, Vimeo, SoundCloud or MP4 URL here..."
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  color: '#fff', fontSize: 16, flex: 1, fontFamily: 'inherit'
                }}
              />
            </div>
            <button 
              onClick={handleUrlSubmit}
              disabled={!customUrl.trim()}
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                border: 'none', borderRadius: 12, padding: '12px 24px', color: '#fff',
                fontSize: 15, fontWeight: 700, cursor: customUrl.trim() ? 'pointer' : 'not-allowed',
                opacity: customUrl.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 8,
                transition: 'transform 0.2s', boxShadow: '0 4px 12px rgba(99,102,241,0.4)'
              }}
              onMouseEnter={e => { if(customUrl.trim()) e.currentTarget.style.transform='scale(1.05)' }}
              onMouseLeave={e => { if(customUrl.trim()) e.currentTarget.style.transform='scale(1)' }}
            >
              Launch <ChevronRight size={18} />
            </button>
            <button 
              onClick={() => setShowUrlInput(false)}
              style={{
                background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%',
                width: 44, height: 44, color: '#aaa', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '32px 36px', scrollBehavior: 'smooth' }}>
          {categories.map(cat => (
            <div key={cat} ref={sectionRefs.current[cat]} style={{ marginBottom: 40, scrollMarginTop: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 20, color: '#fff', fontWeight: 800 }}>{cat}</h3>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, transparent 100%)' }} />
              </div>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: cat === 'Quick Actions' 
                  ? 'repeat(auto-fill, minmax(280px, 1fr))' 
                  : 'repeat(auto-fill, minmax(240px, 1fr))', 
                gap: 16 
              }}>
                {OPTIONS.filter(o => o.category === cat).map(app => {
                  const isQuickAction = app.type === 'action';
                  return (
                    <AppCard key={app.id} app={app} isQuickAction={isQuickAction} onClick={() => handleAppClick(app)} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Hidden file input for uploads (Strictly Video) */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="video/*" 
        style={{ display: 'none' }} 
        onChange={e => { 
          const file = e.target.files?.[0];
          if (file && !file.type.startsWith('video/')) {
            toast.error('Only video files are allowed!');
            e.target.value = '';
            return;
          }
          if (file) {
            onClose(); 
            onUpload(file); 
          }
        }} 
      />
    </div>
  );
}
