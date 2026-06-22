import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Monitor, Link as LinkIcon, Upload, ChevronRight } from 'lucide-react';

import { FaYoutube, FaTwitch, FaVimeo, FaInstagram, FaApple, FaSpotify, FaTiktok, FaSoundcloud, FaFacebook } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { SiNetflix, SiCrunchyroll, SiHbomax, SiAppletv } from 'react-icons/si';
import { GiGolfFlag, GiPoolTriangle, GiSnake, GiRaceCar, GiPistolGun } from 'react-icons/gi';
import { MonitorPlay } from 'lucide-react';

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
  { id: 'zee5', name: 'ZEE5', category: 'Movies & Video', bgColor: 'linear-gradient(135deg, #1A0A3B 0%, #2D1B69 100%)', color: '#fff', brandColor: '#5E2A8C', icon: MonitorPlay, type: 'placeholder', url: 'https://zee5.com', isWide: true, image: '/platforms/zee5plt.jpg' },
  { id: 'sonyliv', name: 'SonyLIV', category: 'Movies & Video', bgColor: 'linear-gradient(135deg, #0A0A14 0%, #1A0A1A 100%)', color: '#fff', brandColor: '#D50000', icon: MonitorPlay, type: 'placeholder', url: 'https://sonyliv.com', isWide: true, image: '/platforms/Sonylivplt.jpg' },
  { id: 'peacocktv', name: 'Peacock', category: 'Movies & Video', bgColor: 'linear-gradient(135deg, #011825 0%, #022B3A 100%)', color: '#fff', brandColor: '#4FC3F7', icon: MonitorPlay, type: 'placeholder', url: 'https://peacocktv.com', isWide: true, image: '/platforms/Peacocktvplt.jpg' },
  { id: 'viki', name: 'Rakuten Viki', category: 'Movies & Video', bgColor: 'linear-gradient(135deg, #0A1929 0%, #0D2137 100%)', color: '#fff', brandColor: '#00B8D4', icon: MonitorPlay, type: 'placeholder', url: 'https://viki.com', isWide: true, image: '/platforms/vikiplt.png' },
  { id: 'mxplayer', name: 'MX Player', category: 'Movies & Video', bgColor: 'linear-gradient(135deg, #0A0A14 0%, #0F1020 100%)', color: '#fff', brandColor: '#FF6B35', icon: MonitorPlay, type: 'placeholder', url: 'https://mxplayer.in', isWide: true, image: '/platforms/MXplayerplt.jpg' },
  { id: 'aha', name: 'aha', category: 'Movies & Video', bgColor: 'linear-gradient(135deg, #E8400A 0%, #FF6B1A 100%)', color: '#fff', brandColor: '#FF5722', icon: MonitorPlay, type: 'placeholder', url: 'https://aha.video', isWide: true, image: '/platforms/Ahaplt.png' },

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
  { id: 'tiktok', name: 'TikTok', category: 'Social Media', bgColor: '#000', color: '#fff', brandColor: '#EE1D52', icon: FaTiktok, type: 'placeholder', url: 'https://tiktok.com', isWide: true, image: '/images/apps/tiktok.jpg' },
  { id: 'instagram', name: 'Instagram', category: 'Social Media', bgColor: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', color: '#fff', brandColor: '#E1306C', icon: FaInstagram, type: 'placeholder', url: 'https://instagram.com', isWide: true, image: '/images/apps/instagram.jpg' },
  { id: 'facebook', name: 'Facebook', category: 'Social Media', bgColor: 'linear-gradient(135deg, #0A3D91 0%, #1877F2 100%)', color: '#fff', brandColor: '#1877F2', icon: FaFacebook, type: 'placeholder', url: 'https://facebook.com', isWide: true, image: '/platforms/facebookplt.jpg' },
  { id: 'xtwitter', name: 'X', category: 'Social Media', bgColor: 'linear-gradient(135deg, #000000 0%, #15202B 100%)', color: '#fff', brandColor: '#fff', icon: FaXTwitter, type: 'placeholder', url: 'https://x.com', isWide: true, image: '/platforms/xplt.png' },
];

// Stateful card component — tracks whether background image loaded successfully
// Stateful card component — tracks whether background image loaded successfully
function AppCard({ app, isQuickAction, onClick, isLight }) {
  const { t } = useTranslation();
  const [imgFailed, setImgFailed] = useState(false);
  const Icon = app.icon;
  const hasImage = app.isWide && app.image && !imgFailed;

  // Theme-aware colors for Quick Actions
  let actionColor = app.color;
  let actionBg = app.bgColor;
  
  if (isQuickAction && isLight) {
    if (app.id === 'screenshare') {
      actionColor = '#059669';
      actionBg = 'rgba(16,185,129,0.08)';
    } else if (app.id === 'custom') {
      actionColor = '#4f46e5';
      actionBg = 'rgba(99,102,241,0.08)';
    } else if (app.id === 'upload') {
      actionColor = '#d97706';
      actionBg = 'rgba(245,158,11,0.08)';
    }
  }

  return (
    <button
      onClick={onClick}
      style={{
        background: actionBg,
        border: isQuickAction ? (isLight ? `1px solid ${actionColor}30` : `1px solid ${app.color}40`) : (isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)'),
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
        boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.05)' : '0 8px 16px rgba(0,0,0,0.2)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = isLight ? '0 12px 24px rgba(0,0,0,0.1)' : '0 12px 24px rgba(0,0,0,0.6)';
        if (!isQuickAction) e.currentTarget.style.filter = 'brightness(1.15)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = isLight ? '0 4px 12px rgba(0,0,0,0.05)' : '0 8px 16px rgba(0,0,0,0.2)';
        if (!isQuickAction) e.currentTarget.style.filter = 'brightness(1)';
      }}
    >
      {/* Quick action inner glow */}
      {isQuickAction && (
        <div style={{ position: 'absolute', inset: 0, background: isLight ? `radial-gradient(circle at center, ${actionColor}10 0%, transparent 70%)` : `radial-gradient(circle at center, ${app.color}20 0%, transparent 70%)` }} />
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
              color: isQuickAction ? actionColor : (app.brandColor || app.color || (isLight ? '#1e293b' : '#fff')),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              filter: isQuickAction ? 'none' : 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
            }}>
              <Icon size={isQuickAction ? 32 : 46} />
            </div>
          )}
          <span style={{
            fontSize: isQuickAction ? 15 : (app.id === 'prime' ? 22 : 26),
            fontWeight: 900,
            color: isQuickAction ? actionColor : (app.color || (isLight ? '#1e293b' : '#fff')),
            letterSpacing: isQuickAction ? 0 : '-0.5px',
            textShadow: isQuickAction ? 'none' : '0 1px 4px rgba(0,0,0,0.6)',
            textAlign: 'center',
          }}>
            {app.category === 'Quick Actions' ? t(`app_${app.id}`, app.name) : app.name}
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

export default function MediaSelectorModal({ onClose, onSelectPlatform, onSelectUrl, onUpload, onScreenshare, onSelectPlaceholder, isLight }) {
  console.log('[MODAL] MediaSelectorModal rendered');
  const { t } = useTranslation();
  const scrollContainerRef = useRef(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth < 640);
  React.useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const categories = ['Quick Actions', 'Movies & Video', 'Web Games', 'Music & Podcasts', 'Social Media'];
  const categoryTranslations = {
    'Quick Actions': t('catQuickActions', 'Quick Actions'),
    'Movies & Video': t('catMoviesVideo', 'Movies & Video'),
    'Web Games': t('catWebGames', 'Web Games'),
    'Music & Podcasts': t('catMusicPodcasts', 'Music & Podcasts'),
    'Social Media': t('catSocialMedia', 'Social Media')
  };
  
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
        console.log('[MODAL] Upload clicked — calling onUpload()');
        onUpload();
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
      className="media-selector-overlay"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100000,
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', padding: isMobile ? 0 : '24px'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="media-selector-modal-inner"
        style={{
          background: isLight ? '#ffffff' : 'linear-gradient(180deg, #11111a 0%, #0a0a0f 100%)',
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)', position: 'relative',
          borderRadius: isMobile ? '20px 20px 0 0' : 24, width: '100%', maxWidth: 1100, maxHeight: isMobile ? '94vh' : '85vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: isLight ? '0 40px 100px rgba(0,0,0,0.1)' : '0 32px 120px rgba(0,0,0,0.9), inset 0 1px 1px rgba(255,255,255,0.05)',
          fontFamily: "'Outfit',sans-serif"
        }}
      >
        <button
          onClick={onClose}
          className="media-selector-close-btn"
          style={{
            position: 'absolute', top: isMobile ? 12 : -2, right: isMobile ? 12 : -60, width: 44, height: 44,
            borderRadius: '50%', background: isLight ? '#fff' : '#1f1f2e', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
            color: isLight ? '#0f172a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10, boxShadow: isLight ? '0 8px 24px rgba(0,0,0,0.08)' : '0 4px 12px rgba(0,0,0,0.5)',
            transition: 'background 0.2s, transform 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background='#ef4444'; e.currentTarget.style.color='#fff'; e.currentTarget.style.transform='scale(1.05)' }}
          onMouseLeave={e => { e.currentTarget.style.background=isLight ? '#fff' : '#1f1f2e'; e.currentTarget.style.color=isLight ? '#0f172a' : '#fff'; e.currentTarget.style.transform='scale(1)' }}
        >
          <X size={20} />
        </button>

        <div style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 24,
          padding: isMobile ? '20px 20px 16px' : '24px 36px', borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.04)', flexShrink: 0
        }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: isLight ? '#0f172a' : '#fff', letterSpacing: '-0.5px' }}>
              {isMobile ? t('selectMedia', 'Select Media') : t('appDirectory', 'App Directory')}
            </h2>
          </div>
          <div style={{ flex: 1 }} />
          <div className="media-selector-filter-tabs" style={{ display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto', paddingBottom: 4 }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => scrollToSection(cat)}
                style={{
                  background: 'transparent',
                  border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 20, padding: '6px 14px',
                  color: isLight ? '#64748b' : '#ccc', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => { e.currentTarget.style.background=isLight ? '#f1f5f9' : 'rgba(255,255,255,0.1)'; e.currentTarget.style.color=isLight ? '#0f172a' : '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color=isLight ? '#64748b' : '#ccc'; }}
              >
                {categoryTranslations[cat] || cat}
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
              flex: 1, display: 'flex', alignItems: 'center', background: isLight ? '#fff' : '#0a0a0f',
              border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '8px 16px',
              boxShadow: isLight ? 'inset 0 1px 3px rgba(0,0,0,0.02)' : 'inset 0 2px 4px rgba(0,0,0,0.5)'
            }}>
              <LinkIcon size={18} color="#6366f1" style={{ marginRight: 12 }} />
              <input 
                autoFocus
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
                placeholder={t('urlInputPlaceholder', 'Paste any YouTube, Twitch, Vimeo, SoundCloud or MP4 URL here...')}
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  color: isLight ? '#0f172a' : '#fff', fontSize: 16, flex: 1, fontFamily: 'inherit'
                }}
              />
            </div>
            <button 
              onClick={handleUrlSubmit}
              disabled={!customUrl.trim()}
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                border: 'none', borderRadius: 12, padding: '12px 24px', color: '#ffffff', WebkitTextFillColor: '#ffffff',
                fontSize: 15, fontWeight: 700, cursor: customUrl.trim() ? 'pointer' : 'not-allowed',
                opacity: customUrl.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 8,
                transition: 'transform 0.2s', boxShadow: '0 4px 12px rgba(99,102,241,0.4)'
              }}
              onMouseEnter={e => { if(customUrl.trim()) e.currentTarget.style.transform='scale(1.05)' }}
              onMouseLeave={e => { if(customUrl.trim()) e.currentTarget.style.transform='scale(1)' }}
            >
              <span style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}>{t('launchBtn', 'Launch')}</span> <ChevronRight size={18} color="#ffffff" />
            </button>
            <button 
              onClick={() => setShowUrlInput(false)}
              style={{
                background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%',
                width: 44, height: 44, color: '#aaa', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }}
              onMouseEnter={e => { e.currentTarget.style.background='#ef4444'; e.currentTarget.style.color='#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='#aaa'; }}
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 16px' : '32px 36px', scrollBehavior: 'smooth' }}>
          {categories.map(cat => (
            <div key={cat} ref={sectionRefs.current[cat]} style={{ marginBottom: isMobile ? 24 : 40, scrollMarginTop: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: isMobile ? 12 : 20 }}>
                <h3 style={{ margin: 0, fontSize: isMobile ? 15 : 20, color: isLight ? '#1e293b' : '#fff', fontWeight: 800 }}>{categoryTranslations[cat] || cat}</h3>
                <div style={{ flex: 1, height: 1, background: isLight ? 'linear-gradient(90deg, rgba(0,0,0,0.05) 0%, transparent 100%)' : 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, transparent 100%)' }} />
              </div>

              <div className={isMobile ? (cat === 'Quick Actions' ? 'media-selector-grid-quick' : 'media-selector-grid') : ''} style={{
                display: 'grid',
                gridTemplateColumns: isMobile
                  ? (cat === 'Quick Actions' ? 'repeat(1, 1fr)' : 'repeat(2, 1fr)')
                  : (cat === 'Quick Actions' ? 'repeat(auto-fill, minmax(280px, 1fr))' : 'repeat(auto-fill, minmax(240px, 1fr))'),
                gap: isMobile ? 10 : 16
              }}>
                {OPTIONS.filter(o => o.category === cat).map(app => {
                  const isQuickAction = app.type === 'action';
                  return (
                    <AppCard key={app.id} app={app} isQuickAction={isQuickAction} onClick={() => handleAppClick(app)} isLight={isLight} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* File input moved to Room.jsx — modal just triggers onUpload() callback */}
    </div>
  );
}





