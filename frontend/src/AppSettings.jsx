import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Play, ArrowLeft, Globe2, Mic, Video, Bell, BellOff, ChevronDown, Eye, EyeOff, MessageSquare, UserPlus, LogIn, LogOut as LogOutIcon, Volume2, VolumeX, Languages, MapPin, User as UserIcon, HelpCircle, Search, Settings, Lock, ShieldCheck } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import GlobalChatWidget from './components/GlobalChatWidget';

const API = 'http://localhost:3001';

// ─── Isolated camera preview ─────────────────────────────────────────────────
// Owns its own stream + video ref so parent re-renders never blank the preview.
function CameraPreview({ selectedCam, t, isLight, micDevices = [] }) {
  const [active, setActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [camInfo, setCamInfo] = useState(null);
  const [measuredFps, setMeasuredFps] = useState(0);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(tr => tr.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Measure real-time FPS
  useEffect(() => {
    if (!active || !videoRef.current) return;
    
    let frameCount = 0;
    let lastTime = performance.now();
    let rVFCId;
    
    const measure = (now) => {
      frameCount++;
      const elapsed = now - lastTime;
      if (elapsed >= 1000) {
        setMeasuredFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        lastTime = now;
      }
      if (videoRef.current && videoRef.current.requestVideoFrameCallback) {
        rVFCId = videoRef.current.requestVideoFrameCallback(measure);
      }
    };
    
    if (videoRef.current && videoRef.current.requestVideoFrameCallback) {
      rVFCId = videoRef.current.requestVideoFrameCallback(measure);
    }
    
    return () => {
      if (rVFCId && videoRef.current && videoRef.current.cancelVideoFrameCallback) {
        videoRef.current.cancelVideoFrameCallback(rVFCId);
      }
    };
  }, [active]);

  const start = async () => {
    if (isStarting || active) return;
    setIsStarting(true);
    try {
      const constraints = { video: selectedCam ? { deviceId: { exact: selectedCam } } : true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Stop any existing stream just in case
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(tr => tr.stop());
      }
      
      streamRef.current = stream;
      // Assign srcObject BEFORE setting state so the element already has a stream
      // when React re-renders and shows the video.
      const vid = videoRef.current;
      if (vid) {
        vid.srcObject = stream;
        vid.play().catch(() => {});
      }
      
      try {
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        const w = settings.width || 0;
        const h = settings.height || 0;
        const fps = settings.frameRate || 0;
        const aspect = settings.aspectRatio || (h ? w / h : 0);
        
        let builtInMic = 'None';
        if (settings.groupId && micDevices.length > 0) {
          const mic = micDevices.find(m => m.groupId === settings.groupId);
          if (mic) builtInMic = mic.label || 'Yes';
        }
        
        let standard = 'Unknown';
        if (h >= 2160) standard = '4K UHD';
        else if (h >= 1440) standard = 'QHD 1440p';
        else if (h >= 1080) standard = 'FHD 1080p';
        else if (h >= 720) standard = 'HD 720p';
        else if (h >= 480) standard = 'SD 480p';
        else if (h > 0) standard = 'Low Res';

        setCamInfo({
          name: track.label || 'Unknown Camera',
          builtInMic,
          resolution: w && h ? `${w}×${h}` : 'Unknown',
          standard: standard,
          megaPixels: w && h ? ((w * h) / 1000000).toFixed(2) + ' MP' : 'Unknown',
          targetFps: fps,
          aspectRatio: aspect ? aspect.toFixed(2) : 'Unknown',
          streamType: 'video'
        });
      } catch (err) {
        console.error('Error reading camera info:', err);
      }

      setActive(true);
    } catch {
      toast.error('Camera access denied');
    } finally {
      setIsStarting(false);
    }
  };

  const stop = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(tr => tr.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setIsStarting(false);
    setCamInfo(null);
    setMeasuredFps(0);
  };

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        {active ? (
          <button className="test-btn" onClick={stop} style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
            <Video size={15} /> {t ? t('stopCamera', 'Stop Camera') : 'Stop Camera'}
          </button>
        ) : (
          <button className="test-btn" onClick={start} disabled={isStarting} style={{ background: isStarting ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.15)', color: isStarting ? '#059669' : '#10b981', cursor: isStarting ? 'wait' : 'pointer' }}>
            <Video size={15} /> {isStarting ? (t ? t('starting', 'Starting...') : 'Starting...') : (t ? t('startCamera', 'Start Camera') : 'Start Camera')}
          </button>
        )}
      </div>

      {/* Container with fixed size — video is ALWAYS display:block so browser never suspends tracks */}
      <div style={{ width: '100%', maxWidth: 380, aspectRatio: '16/9', background: '#000', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }}
        />
        {/* Placeholder overlaid on top — does NOT hide the video element */}
        {!active && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#555', fontSize: 13, background: 'rgba(0,0,0,0.6)' }}>
            <Video size={32} color="#333" />
            <span>{t ? t('camPreviewText', 'Camera preview will appear here') : 'Camera preview will appear here'}</span>
          </div>
        )}
      </div>

      {active && camInfo && (
        <div style={{ marginTop: 16, maxWidth: 380, background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)', borderRadius: 12, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.02)', borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)', fontWeight: 600, fontSize: 13, color: isLight ? '#334155' : '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={14} color={isLight ? '#64748b' : '#aaa'} />
            {t ? t('webcamInfo', 'Webcam Information') : 'Webcam Information'}
          </div>
          <div style={{ padding: '8px 16px' }}>
            {[
              { label: 'Webcam Name', value: camInfo.name },
              { label: 'Built-in Microphone', value: camInfo.builtInMic },
              { label: 'Webcam Resolution', value: camInfo.resolution },
              { label: 'Video Standard', value: camInfo.standard },
              { label: 'Webcam MegaPixels', value: camInfo.megaPixels },
              { label: 'Frame rate', value: (measuredFps > 0 ? measuredFps : (camInfo.targetFps ? Math.round(camInfo.targetFps) : '--')) + ' FPS' },
              { label: 'Aspect Ratio', value: camInfo.aspectRatio },
              { label: 'Stream Type', value: camInfo.streamType }
            ].map((row, idx) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: idx < 7 ? (isLight ? '1px dashed #e2e8f0' : '1px dashed rgba(255,255,255,0.05)') : 'none', fontSize: 13 }}>
                <span style={{ color: isLight ? '#64748b' : '#94a3b8' }}>{row.label}:</span>
                <span style={{ color: isLight ? '#0f172a' : '#f8fafc', fontWeight: 600, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'te', name: 'తెలుగు', flag: '🇮🇳' },
  { code: 'ta', name: 'தமிழ்', flag: '🇮🇳' },
];

const AppSettings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const token = localStorage.getItem('watch_token');
  const myUsername = localStorage.getItem('watch_username');

  // Settings state
  const [settings, setSettings] = useState(null);
  const [language, setLanguage] = useState('en');
  const [country, setCountry] = useState('');
  const [showCountry, setShowCountry] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('watch_theme') || 'dark');
  const [notifyApp, setNotifyApp] = useState(true);
  const [notifyJoin, setNotifyJoin] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifyFriendRequests, setNotifyFriendRequests] = useState(true);
  const [notifyLeave, setNotifyLeave] = useState(true);
  const [notifyJoinRequests, setNotifyJoinRequests] = useState(true);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [openSection, setOpenSection] = useState('general');
  const [profile, setProfile] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showRecentChats, setShowRecentChats] = useState(false);
  const [recentChats, setRecentChats] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [followRequests, setFollowRequests] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chat_unread_counts') || '{}'); } catch { return {}; }
  });
  const [totalUnread, setTotalUnread] = useState(() => {
    try {
      const counts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
      return Object.values(counts).reduce((a, b) => a + b, 0);
    } catch { return 0; }
  });

  const ReactIsAwesome = React; // just dummy not to conflict
  const navIconsRef = ReactIsAwesome.useRef(null);
  const chatWidgetRef = ReactIsAwesome.useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      // Don't close if clicking inside the nav icons area OR inside the chat widget itself
      const inNavArea = navIconsRef.current && navIconsRef.current.contains(e.target);
      const inChatWidget = chatWidgetRef.current && chatWidgetRef.current.contains(e.target);
      if (!inNavArea && !inChatWidget) {
        setShowSearch(false);
        setShowNotifications(false);
        // Only close showRecentChats (which drives isOpen on widget) if the click is outside the widget
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Unread message tracking ──
  useEffect(() => {
    if (!token) return;
    const getLastSeen = () => { try { return JSON.parse(localStorage.getItem('chat_last_seen') || '{}'); } catch { return {}; } };
    const checkUnread = async () => {
      try {
        const lastSeen = getLastSeen();
        const param = encodeURIComponent(JSON.stringify(lastSeen));
        const res = await fetch(`${API}/api/chats/recent?lastSeen=${param}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
        const counts = {};
        let total = 0;
        data.forEach(chat => {
          const chatKey = chat.id || chat.partner;
          if (chat.unread && chat.unread > 0) {
            counts[chatKey] = chat.unread;
            total += chat.unread;
            localCounts[chatKey] = chat.unread;
          } else {
            delete localCounts[chatKey];
          }
        });
        localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
        setUnreadCounts(counts);
        setTotalUnread(total);
      } catch {}
    };
    checkUnread();
    const inv = setInterval(checkUnread, 5000);
    return () => clearInterval(inv);
  }, [token]);

  const handleNewMessage = useCallback((partner, msg) => {
    const chatKey = partner;

    // Check if muted
    const myUsername = localStorage.getItem('watch_username') || '';
    let isMuted = false;
    try {
      const m = JSON.parse(localStorage.getItem(`muted_chats_${myUsername}`) || '[]');
      if (m.some(u => u.toLowerCase() === partner.toLowerCase())) isMuted = true;
    } catch {}
    
    if (isMuted) return;

    const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
    localCounts[chatKey] = (localCounts[chatKey] || 0) + 1;
    localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
    setUnreadCounts(prev => ({ ...prev, [chatKey]: (prev[chatKey] || 0) + 1 }));
    setTotalUnread(prev => prev + 1);
  }, []);

  const handleMarkRead = useCallback((chatId) => {
    const lastSeen = (() => { try { return JSON.parse(localStorage.getItem('chat_last_seen') || '{}'); } catch { return {}; } })();
    lastSeen[chatId] = Date.now();
    localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));
    const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
    delete localCounts[chatId];
    localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
    setUnreadCounts(prev => {
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
    setTotalUnread(prev => Math.max(0, prev - (unreadCounts[chatId] || 1)));
  }, [unreadCounts]);

  useEffect(() => {
    const fetchRequests = () => {
      if (token) {
        fetch(`${API}/api/follow/requests`, { headers: { 'Authorization': `Bearer ${token}` } })
          .then(r => r.json()).then(d => { if(Array.isArray(d)) setFollowRequests(d); }).catch(() => {});
      }
    };
    fetchRequests();
    const inv = setInterval(fetchRequests, 3000);
    window.addEventListener('follow_status_updated', fetchRequests);
    return () => {
      clearInterval(inv);
      window.removeEventListener('follow_status_updated', fetchRequests);
    };
  }, [token]);

  const handleAllowRequest = async (requestingUser, e) => {
    e.stopPropagation();
    try {
      const r = await fetch(`${API}/api/follow/${requestingUser}/accept`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const d = await r.json();
      if (!d.error) {
         toast.success(`Accepted ${requestingUser}'s follow request`);
         setFollowRequests(prev => prev.map(u => u.username === requestingUser ? { ...u, status: 'accepted' } : u));
      }
    } catch {}
  };

  const handleFollowBack = async (requestingUser, e) => {
    e.stopPropagation();
    // Optimistically update UI immediately so button changes to "Request Sent"
    setFollowRequests(prev => prev.map(u => u.username === requestingUser ? { ...u, myFollowStatus: 'pending' } : u));
    try {
      const r = await fetch(`${API}/api/follow/${requestingUser}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const d = await r.json();
      if (d.error) {
        toast.error(d.error);
        // Revert optimistic update on error
        setFollowRequests(prev => prev.map(u => u.username === requestingUser ? { ...u, myFollowStatus: null } : u));
      } else {
        toast.success(`Follow request sent to ${requestingUser}!`);
        window.dispatchEvent(new Event('follow_status_updated'));
      }
    } catch {
      // Revert on network error
      setFollowRequests(prev => prev.map(u => u.username === requestingUser ? { ...u, myFollowStatus: null } : u));
    }
  };


  // Camera / Mic test
  const [micStream, setMicStream] = useState(null);
  const [micLevel, setMicLevel] = useState(0);
  const [micTesting, setMicTesting] = useState(false);
  const [micDevices, setMicDevices] = useState([]);
  const [camDevices, setCamDevices] = useState([]);
  const [selectedMic, setSelectedMic] = useState(() => localStorage.getItem('watch_selected_mic') || '');
  const [selectedCam, setSelectedCam] = useState(() => localStorage.getItem('watch_selected_cam') || '');
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const micCanvasRef = useRef(null);

  const fetchSettings = useCallback(() => {
    fetch(`${API}/api/settings`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.error) return;
        setSettings(data);
        setLanguage(data.language || 'en');
        setCountry(data.country || '');
        setShowCountry(data.showCountry === 1 || data.showCountry === true);
        setNotifyApp(data.notifyApp === 1 || data.notifyApp === true);
        setNotifyJoin(data.notifyJoin === 1 || data.notifyJoin === true);
        setNotifyMessages(data.notifyMessages === 1 || data.notifyMessages === true);
        setNotifyFriendRequests(data.notifyFriendRequests === 1 || data.notifyFriendRequests === true);
        setNotifyLeave(data.notifyLeave === 1 || data.notifyLeave === true);
        setNotifyJoinRequests(data.notifyJoinRequests === 1 || data.notifyJoinRequests === true);
      })
      .catch(() => toast.error('Failed to load settings'));

    fetch(`${API}/api/profile`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setProfile(data))
      .catch(() => {});
  }, [token]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  useEffect(() => {
    if (!searchQuery) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      fetch(`${API}/api/users/search?q=${searchQuery}`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json()).then(setSearchResults).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, token]);

  useEffect(() => {
    if (showRecentChats) {
      fetch(`${API}/api/chats/recent`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json()).then(d => { if(Array.isArray(d)) setRecentChats(d); else setRecentChats([]); }).catch(() => {});
    }
  }, [showRecentChats, token]);

  const [flagUrl, setFlagUrl] = useState('');
  useEffect(() => {
    if (country) {
      fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fullText=true&fields=flags`)
        .then(res => res.json())
        .then(data => { if (data[0] && data[0].flags && data[0].flags.png) setFlagUrl(data[0].flags.png); })
        .catch(() => setFlagUrl(''));
    } else {
      setFlagUrl('');
    }
  }, [country]);

  // Enumerate devices
  const updateDevices = useCallback(async (forceRequest = false, type = 'both') => {
    try {
      if (forceRequest) {
        const constraints = {};
        if (type === 'audio' || type === 'both') constraints.audio = true;
        if (type === 'video' || type === 'both') constraints.video = true;
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        stream.getTracks().forEach(t => t.stop());
      }
      
      const devices = await navigator.mediaDevices?.enumerateDevices();
      const mics = devices.filter(d => d.kind === 'audioinput');
      const cams = devices.filter(d => d.kind === 'videoinput');
      
      setMicDevices(mics);
      setCamDevices(cams);
      
      // Auto-select first device if none selected
      if (mics.length > 0 && !selectedMic) {
        const d = mics[0].deviceId;
        setSelectedMic(d);
        localStorage.setItem('watch_selected_mic', d);
      }
      if (cams.length > 0 && !selectedCam) {
        const d = cams[0].deviceId;
        setSelectedCam(d);
        localStorage.setItem('watch_selected_cam', d);
      }
    } catch (err) {
      console.error('Error updating devices:', err);
    }
  }, [selectedMic, selectedCam]);

  useEffect(() => {
    // We only fetch devices initially WITHOUT triggering a prompt.
    // This avoids accessing camera/mic immediately on page load.
    updateDevices(false);
  }, [updateDevices]);

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const saveSetting = (key, value) => {
    fetch(`${API}/api/settings`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ [key]: value })
    }).then(r => r.json()).then(data => {
      if (data.error) toast.error(data.error);
    }).catch(() => toast.error('Failed to save'));
  };

  // Language change
  const handleLangChange = (code) => {
    setLanguage(code);
    setShowLangDropdown(false);
    i18n.changeLanguage(code);
    saveSetting('language', code);
    toast.success('Language updated!');
  };

  const handleLogout = () => {
    localStorage.removeItem('watch_token');
    localStorage.removeItem('watch_username');
    window.location.reload();
  };

  // Country toggle
  const handleShowCountryToggle = () => {
    const next = !showCountry;
    setShowCountry(next);
    saveSetting('showCountry', next ? 1 : 0);
    toast.success(next ? 'Country visible' : 'Country hidden');
  };

  // Theme toggle
  const handleThemeToggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('watch_theme', next);
    window.dispatchEvent(new Event('theme_changed'));
    toast.success(next === 'light' ? 'Light mode activated' : 'Dark mode activated');
  };

  // Notification toggles
  const toggleNotifSetting = (key, current, setter) => {
    const next = !current;
    setter(next);
    saveSetting(key, next ? 1 : 0);
  };

  // Mic test
  const startMicTest = async () => {
    try {
      const constraints = { audio: selectedMic ? { deviceId: { exact: selectedMic } } : true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setMicStream(stream);
      setMicTesting(true);
      
      // If we didn't have labels before, we have them now. Refresh the list.
      if (!micDevices.some(d => d.label)) {
        updateDevices(false);
      }
      
      const audioCtx = new AudioContext();
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        
        let peak = 0;
        for (let i = 0; i < dataArray.length; i++) {
          if (dataArray[i] > peak) peak = dataArray[i];
        }
        
        const vol = Math.min(100, (peak / 255) * 100);
        setMicLevel(vol);

        if (micCanvasRef.current) {
          const canvas = micCanvasRef.current;
          const ctx = canvas.getContext('2d');
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);
          
          const barWidth = (w / 40); // focus on vocal freq
          let x = 0;
          
          for(let i = 0; i < 40; i++) {
            const barHeight = (dataArray[i] / 255) * h;
            
            // Dynamic color based on loudness
            if (vol > 70) ctx.fillStyle = '#10b981';
            else if (vol > 30) ctx.fillStyle = '#f59e0b';
            else ctx.fillStyle = '#6366f1';

            // Draw wave centered vertically
            const y = (h - barHeight) / 2;
            
            // Draw rounded bar
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth - 2, barHeight || 2, 2);
            ctx.fill();
            
            x += barWidth;
          }
        }
        
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { toast.error('Microphone access denied'); }
  };

  const stopMicTest = () => {
    if (micStream) micStream.getTracks().forEach(t => t.stop());
    setMicStream(null);
    setMicTesting(false);
    setMicLevel(0);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  };


  const selectedLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  const Toggle = ({ on, onToggle, disabled }) => (
    <button className={`custom-toggle ${on ? 'toggle-on' : 'toggle-off'}`} onClick={onToggle} disabled={disabled} style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', background: on ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.25s', opacity: disabled ? 0.4 : 1, flexShrink: 0 }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: on ? 25 : 3, transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
    </button>
  );

  const toggleSection = (sec) => setOpenSection(p => p === sec ? null : sec);

  if (!settings) return <div style={{ color: '#fff', textAlign: 'center', padding: 80 }}>Loading...</div>;

  return (
    <div style={{ minHeight: '100vh', overflowX: 'hidden' }}>
      <Toaster position="top-center" />
      <style>{`
        .settings-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; padding: 24px 28px; margin-bottom: 24px; transition: all 0.2s; }
        .settings-card:hover { border-color: rgba(255,255,255,0.15); }
        html[data-theme='light'] .custom-toggle.toggle-off { background: rgba(0,0,0,0.15) !important; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1) !important; }
        .acc-header { display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; }
        .acc-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: #e2e8f0; display: flex; align-items: center; gap: 10px; }
        .acc-body { margin-top: 24px; animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .notif-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .notif-row:last-child { border-bottom: none; }
        .notif-label { display: flex; align-items: center; gap: 12px; }
        .notif-icon { width: 36; height: 36; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .device-select { 
          width: 100%; 
          padding: 12px 16px; 
          background: rgba(255,255,255,0.05); 
          border: 1px solid rgba(255,255,255,0.1); 
          border-radius: 12px; 
          color: #fff; 
          font-size: 14px; 
          outline: none; 
          appearance: none; 
          cursor: pointer; 
          transition: all 0.2s;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
        }
        .device-select:focus { border-color: #6366f1; background-color: rgba(255,255,255,0.08); }
        .device-select option { background: #1a1a2e; color: #fff; }
        
        html[data-theme='light'] .device-select { 
          background-color: #fff; 
          border-color: #e2e8f0; 
          color: #1a202c; 
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        html[data-theme='light'] .device-select option { background: #fff; color: #1a202c; }
        .test-btn { padding: 8px 20px; border-radius: 10px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
        .back-btn { 
          display: flex; 
          align-items: center; 
          gap: 10px; 
          background: rgba(255,255,255,0.05); 
          border: 1px solid rgba(255,255,255,0.1); 
          color: #fff; 
          padding: 10px 20px; 
          border-radius: 16px; 
          cursor: pointer; 
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); 
          font-size: 14px; 
          font-weight: 700; 
          backdrop-filter: blur(12px); 
        }
        .back-btn:hover { 
          background: rgba(255,255,255,0.1); 
          border-color: rgba(255,255,255,0.2); 
        }
        .nav-icon-btn { 
          position: relative; 
          background: rgba(255,255,255,0.05); 
          border: none; 
          padding: 8px;
          border-radius: 50%; 
          color: #94a3b8; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          cursor: pointer; 
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); 
        }
        .nav-icon-btn:hover { 
          background: rgba(255,255,255,0.1); 
          border-color: rgba(255,255,255,0.2); 
          color: #fff; 
        }
        .nav-icon-btn.active { 
          background: rgba(99,102,241,0.12); 
          color: #818cf8; 
          border-radius: 12px;
        }
        .profile-pill {
          display: flex; 
          align-items: center; 
          gap: 10px; 
          background: rgba(255,255,255,0.05); 
          border: 1px solid rgba(255,255,255,0.1); 
          border-radius: 16px; 
          padding: 8px 18px; 
          font-size: 14px; 
          color: #eee; 
          cursor: pointer; 
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); 
        }
        .profile-pill:hover { 
          background: rgba(255,255,255,0.1) !important; 
          border-color: rgba(255,255,255,0.2) !important; 
        }

        /* ── Light Mode Overrides ── */
        html[data-theme='light'] body { background: #f7fafc !important; color: #111 !important; }
        html[data-theme='light'] nav { background: #fff !important; border-bottom: 1px solid rgba(0,0,0,0.08) !important; }
        
        html[data-theme='light'] .section-heading { color: #000 !important; }
        html[data-theme='light'] .section-desc { color: #4a5568 !important; }

        html[data-theme='light'] h2 { color: #000 !important; }
      `}</style>

      {/* Navbar */}
      <nav style={{ padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative', zIndex: 1000 }}>
        {/* Left: Back Button */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <button className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={18} />
            <span>{t('back', 'Back')}</span>
          </button>
        </div>

        {/* Center: Empty (identity moved to right) */}
        <div style={{ flex: 1 }}></div>

        {/* Right: Actions */}
        <div ref={navIconsRef} style={{ flex: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <button 
              title="Search"
              onClick={() => { setShowSearch(!showSearch); setShowRecentChats(false); setShowNotifications(false); setShowUserMenu(false); }}
              className={`nav-icon-btn${showSearch ? ' active' : ''}`}
            >
              <Search size={18} />
            </button>
            {showSearch && (
              <div className="nav-dropdown" style={{ position: 'absolute', top: 'calc(100% + 12px)', right: -60, width: 320, background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.8)', zIndex: 10000 }}>
                <input 
                  autoFocus
                  placeholder="Search users..."
                  className="nav-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', marginBottom: 8 }}
                />
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {searchResults.length > 0 ? (
                    searchResults.map(u => (
                      <div key={u.username} onClick={() => { setShowSearch(false); navigate(`/profile/${u.username}`); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s' }}
                           onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                           onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {u.avatarPath ? <img src={`${API}${u.avatarPath}`} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : <UserIcon size={14} color="#fff" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{u.displayName || u.username}</div>
                          <div style={{ color: '#6b7280', fontSize: 11 }}>@{u.username}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    searchQuery ? <div style={{ textAlign: 'center', color: '#444', fontSize: 12, padding: 12 }}>No users found</div> : null
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Global Chat */}
          <div style={{ position: 'relative' }}>
            <button 
              title="Chats"
              onClick={() => { setShowRecentChats(!showRecentChats); setShowNotifications(false); setShowSearch(false); setShowUserMenu(false); }}
              className={`nav-icon-btn${showRecentChats ? ' active' : ''}`}
            >
              <MessageSquare size={18} />
              {totalUnread > 0 && (
                <div className="unread-badge" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {totalUnread > 9 ? '9+' : totalUnread}
                </div>
              )}
            </button>
          </div>

          {/* Notifications */}
          <div style={{ position: 'relative' }}>
            <button title="Notifications" onClick={() => { setShowNotifications(!showNotifications); setShowSearch(false); setShowRecentChats(false); setShowUserMenu(false); }} className={`nav-icon-btn${showNotifications ? ' active' : ''}`}>
              <Bell size={18} />
              {followRequests.filter(r => r.status === 'pending').length > 0 && (
                <div className="unread-badge" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {followRequests.filter(r => r.status === 'pending').length}
                </div>
              )}
            </button>
            {showNotifications && (
              <div className="nav-dropdown" style={{ position: 'absolute', top: 'calc(100% + 12px)', right: 0, width: 340, background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '12px 6px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)', zIndex: 10000 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#555', padding: '0 12px 8px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Follow Notifications</div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {followRequests.length > 0 ? (
                    followRequests.map(u => (
                      <div key={u.username} onClick={() => { setShowNotifications(false); navigate(`/profile/${u.username}`); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s', background: u.status === 'pending' ? 'rgba(99,102,241,0.05)' : 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = u.status === 'pending' ? 'rgba(99,102,241,0.05)' : 'transparent'}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                          {u.avatarPath ? <img src={`${API}${u.avatarPath}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={18} color="#888" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{u.displayName || u.username}</div>
                          <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>
                            {u.status === 'pending' ? `@${u.username} wants to follow you` : `@${u.username} started following you`}
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            {u.status === 'pending' ? (
                              <button onClick={(e) => handleAllowRequest(u.username, e)} style={{ padding: '6px 12px', background: 'rgba(99,102,241,0.15)', border: 'none', color: '#818cf8', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Allow</button>
                            ) : (
                              <button disabled style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#6b7280', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Follower</button>
                            )}
                            
                            {u.myFollowStatus === 'accepted' ? (
                              <button disabled style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.15)', border: 'none', color: '#10b981', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Following</button>
                            ) : (
                              <button onClick={(e) => {
                                e.stopPropagation();
                                if (u.myFollowStatus === 'pending') return;
                                handleFollowBack(u.username, e);
                              }} style={{ padding: '6px 12px', background: u.myFollowStatus === 'pending' ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', color: u.myFollowStatus === 'pending' ? '#6b7280' : '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: u.myFollowStatus === 'pending' ? 'default' : 'pointer' }}>
                                {u.myFollowStatus === 'pending' ? 'Request Sent' : 'Follow Back'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', color: '#444', fontSize: 12, padding: 24 }}>No new notifications</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }} onMouseLeave={() => setShowUserMenu(false)}>
            <div className="profile-pill"
              onMouseEnter={() => { setShowUserMenu(true); setShowSearch(false); setShowRecentChats(false); setShowNotifications(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '6px 14px', fontSize: '14px', color: '#ddd', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {profile?.avatarPath ? (
                  <img src={`${API}${profile.avatarPath}`} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <UserIcon size={14} style={{ color: '#6366f1' }} />
                )}
              </div>
              <span style={{ fontWeight: 600 }}>{myUsername}</span>
            </div>
            {showUserMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: 8, zIndex: 9999 }}>
                <div className="nav-dropdown" style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 8, minWidth: 220, boxShadow: '0 16px 48px rgba(0,0,0,0.8)' }}>
                  <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); navigate('/profile'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserIcon size={16} color="#6366f1" />
                    </div>
                    {t('account', 'Account')}
                  </button>
                  <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); navigate('/app-settings'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Settings size={16} color="#10b981" />
                    </div>
                    {t('app', 'App')}
                  </button>
                  <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); toast.success('Support email: help@watchtogether.app'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <HelpCircle size={16} color="#f59e0b" />
                    </div>
                    {t('contactSupport', 'Contact Support')}
                  </button>
                  <div className="profile-divider" />
                  <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); handleLogout(); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LogOutIcon size={16} color="#f87171" />
                    </div>
                    {t('logOut', 'Log Out')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>


      <section style={{ maxWidth: '620px', margin: '40px auto 80px', padding: '0 20px' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 40px', color: '#fff' }}>{t('appSettings', 'App Settings')}</h2>

        {/* Language */}
        <div className="settings-card">
          <div className="acc-header" onClick={() => toggleSection('language')}>
            <h3><Languages size={18} color="#6366f1" /> {t('language', 'Language')}</h3>
            <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'language' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {openSection === 'language' && (
            <div className="acc-body">
              <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>{t('languageDesc', 'Select your preferred language for the app interface')}</p>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowLangDropdown(p => !p)} style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{selectedLang.flag} {selectedLang.name}</span>
                  <ChevronDown size={16} color="#888" style={{ transform: showLangDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {showLangDropdown && (
                  <div className="nav-dropdown" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 6, maxHeight: 260, overflowY: 'auto', zIndex: 50, boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
                    {LANGUAGES.map(lang => (
                      <button key={lang.code} onClick={() => handleLangChange(lang.code)} style={{ width: '100%', padding: '10px 14px', background: language === lang.code ? 'rgba(99,102,241,0.15)' : 'transparent', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.15s' }}
                        onMouseEnter={e => { if (language !== lang.code) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                        onMouseLeave={e => { if (language !== lang.code) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: 18 }}>{lang.flag}</span> {lang.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Country */}
        <div className="settings-card">
          <div className="acc-header" onClick={() => toggleSection('country')}>
            <h3><MapPin size={18} color="#10b981" /> {t('countryLabel', 'Country Label')}</h3>
            <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'country' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {openSection === 'country' && (
            <div className="acc-body">
              <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>{t('countryDesc', 'Your country is auto-detected when you sign up. You can choose to hide it from your profile.')}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.03)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {flagUrl ? <img src={flagUrl} alt="flag" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <MapPin size={20} color="#10b981" />}
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{country || 'Not detected'}</div>
                    <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{t('autoDetected', 'Auto-detected from your IP at signup')}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#888' }}>{showCountry ? t('visible', 'Visible') : t('hidden', 'Hidden')}</span>
                  <Toggle on={showCountry} onToggle={handleShowCountryToggle} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Appearance */}
        <div className="settings-card">
          <div className="acc-header" onClick={() => toggleSection('appearance')}>
            <h3><Eye size={18} color="#0ea5e9" /> {t('appearance', 'Appearance')}</h3>
            <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'appearance' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {openSection === 'appearance' && (
            <div className="acc-body">
              <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>{t('appearanceDesc', 'Choose how the app looks to you.')}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.03)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {theme === 'light' ? <Eye size={20} color="#0ea5e9" /> : <EyeOff size={20} color="#0ea5e9" />}
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</div>
                    <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{theme === 'light' ? 'Bright and clean' : 'Easy on the eyes'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#888' }}>{theme === 'light' ? 'Light' : 'Dark'}</span>
                  <Toggle on={theme === 'light'} onToggle={handleThemeToggle} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mic / Webcam */}
        <div className="settings-card">
          <div className="acc-header" onClick={() => toggleSection('mic')}>
            <h3><Mic size={18} color="#f59e0b" /> {t('microphone', 'Microphone')}</h3>
            <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'mic' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {openSection === 'mic' && (
            <div className="acc-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ color: '#888', fontSize: 13, margin: 0 }}>{t('micDesc', 'Test your microphone before joining a room')}</p>
                {micDevices.some(d => !d.label) && (
                  <button onClick={() => updateDevices(true, 'audio')} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                    {t('refreshLabels', 'Refresh Labels')}
                  </button>
                )}
              </div>
              
              <select className="device-select" value={selectedMic} onChange={e => {
                setSelectedMic(e.target.value);
                localStorage.setItem('watch_selected_mic', e.target.value);
              }} style={{ marginBottom: 14 }}>
                <option value="">{t('defaultMic', 'Default Microphone')}</option>
                {micDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `${t('mic', 'Microphone')} ${i + 1}`}
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {micTesting ? (
                  <button className="test-btn" onClick={stopMicTest} style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                    <VolumeX size={15} /> {t('stopTest', 'Stop Test')}
                  </button>
                ) : (
                  <button className="test-btn" onClick={startMicTest} style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                    <Volume2 size={15} /> {t('testMic', 'Test Mic')}
                  </button>
                )}
                <div style={{ flex: 1, height: 24, background: 'rgba(255,255,255,0.02)', borderRadius: 6, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                  {micTesting ? (
                    <canvas ref={micCanvasRef} width={240} height={24} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <div style={{ width: '100%', textAlign: 'center', color: '#555', fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>{t('clickToTest', 'CLICK TO TEST')}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="settings-card">
          <div className="acc-header" onClick={() => toggleSection('camera')}>
            <h3><Video size={18} color="#ef4444" /> {t('camera', 'Camera')}</h3>
            <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'camera' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {openSection === 'camera' && (
            <div className="acc-body">
              <p style={{ color: '#888', fontSize: 13, margin: '0 0 12px' }}>
                {t('camDesc', 'Test your camera preview before entering a room')}
              </p>

              {/* Device selector — changes selectedCam prop which CameraPreview uses on next Start */}
              <select className="device-select" value={selectedCam} onChange={e => {
                setSelectedCam(e.target.value);
                localStorage.setItem('watch_selected_cam', e.target.value);
              }} style={{ marginBottom: 16 }}>
                <option value="">{t('defaultCam', 'Default Camera')}</option>
                {camDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `${t('camera', 'Camera')} ${i + 1}`}
                  </option>
                ))}
              </select>

              {/* Fully isolated — parent re-renders never affect this component */}
              <CameraPreview selectedCam={selectedCam} t={t} isLight={theme === 'light'} micDevices={micDevices} />
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="settings-card">
          <div className="acc-header" onClick={() => toggleSection('notifications')}>
            <h3><Bell size={18} color="#a855f7" /> {t('notifications', 'Notifications')}</h3>
            <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'notifications' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {openSection === 'notifications' && (
            <div className="acc-body">
              <p style={{ color: '#888', fontSize: 13, margin: '0 0 8px' }}>{t('notifDesc', 'Control which notifications you receive across the app')}</p>

              {/* Master toggle */}
              <div className="notif-row" style={{ paddingBottom: 18, marginBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="notif-label">
                  <div className="notif-icon" style={{ background: 'rgba(168,85,247,0.15)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {notifyApp ? <Bell size={16} color="#a855f7" /> : <BellOff size={16} color="#666" />}
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{t('appNotifications', 'App Notifications')}</div>
                    <div style={{ color: '#888', fontSize: 12 }}>{t('masterNotifToggle', 'Master toggle for all notifications')}</div>
                  </div>
                </div>
                <Toggle on={notifyApp} onToggle={() => toggleNotifSetting('notifyApp', notifyApp, setNotifyApp)} />
              </div>

              {/* Individual toggles */}
              <div className="notif-row">
                <div className="notif-label">
                  <div className="notif-icon" style={{ background: 'rgba(16,185,129,0.15)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LogIn size={16} color="#10b981" />
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 500, fontSize: 14 }}>{t('joinNotifications', 'Join Notifications')}</div>
                    <div style={{ color: '#666', fontSize: 12 }}>{t('whenSomeoneJoins', 'When someone joins your room')}</div>
                  </div>
                </div>
                <Toggle on={notifyJoin} onToggle={() => toggleNotifSetting('notifyJoin', notifyJoin, setNotifyJoin)} disabled={!notifyApp} />
              </div>

              <div className="notif-row">
                <div className="notif-label">
                  <div className="notif-icon" style={{ background: 'rgba(168,85,247,0.15)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldCheck size={16} color="#a855f7" />
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 500, fontSize: 14 }}>{t('joinReqNotifications', 'Join Request Result Toasts')}</div>
                    <div style={{ color: '#666', fontSize: 12 }}>{t('whenSomeoneAsksJoin', 'Show toast after approving or denying a join request')}</div>
                  </div>
                </div>
                <Toggle on={notifyJoinRequests} onToggle={() => toggleNotifSetting('notifyJoinRequests', notifyJoinRequests, setNotifyJoinRequests)} disabled={!notifyApp} />
              </div>

              <div className="notif-row">
                <div className="notif-label">
                  <div className="notif-icon" style={{ background: 'rgba(99,102,241,0.15)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageSquare size={16} color="#6366f1" />
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 500, fontSize: 14 }}>{t('msgNotifications', 'Message Notifications')}</div>
                    <div style={{ color: '#666', fontSize: 12 }}>{t('whenSomeoneSendsChat', 'When someone sends a chat message')}</div>
                  </div>
                </div>
                <Toggle on={notifyMessages} onToggle={() => toggleNotifSetting('notifyMessages', notifyMessages, setNotifyMessages)} disabled={!notifyApp} />
              </div>

              <div className="notif-row">
                <div className="notif-label">
                  <div className="notif-icon" style={{ background: 'rgba(245,158,11,0.15)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserPlus size={16} color="#f59e0b" />
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 500, fontSize: 14 }}>{t('friendRequestNotifications', 'Friend Request Notifications')}</div>
                    <div style={{ color: '#666', fontSize: 12 }}>{t('whenFriendRequest', 'When you receive a friend request')}</div>
                  </div>
                </div>
                <Toggle on={notifyFriendRequests} onToggle={() => toggleNotifSetting('notifyFriendRequests', notifyFriendRequests, setNotifyFriendRequests)} disabled={!notifyApp} />
              </div>

              <div className="notif-row">
                <div className="notif-label">
                  <div className="notif-icon" style={{ background: 'rgba(239,68,68,0.15)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LogOutIcon size={16} color="#ef4444" />
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 500, fontSize: 14 }}>{t('leaveNotifications', 'Leave Notifications')}</div>
                    <div style={{ color: '#666', fontSize: 12 }}>{t('whenSomeoneLeaves', 'When someone leaves your room')}</div>
                  </div>
                </div>
                <Toggle on={notifyLeave} onToggle={() => toggleNotifSetting('notifyLeave', notifyLeave, setNotifyLeave)} disabled={!notifyApp} />
              </div>
            </div>
          )}
        </div>
      </section>
      <GlobalChatWidget 
        ref={chatWidgetRef}
        isOpen={showRecentChats} 
        onClose={() => setShowRecentChats(false)} 
        unreadCounts={unreadCounts}
        onMarkRead={handleMarkRead}
        onNewMessage={handleNewMessage}
      />
    </div>
  );
};

export default AppSettings;





