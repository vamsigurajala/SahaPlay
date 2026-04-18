import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Play, ArrowLeft, Camera, Check, X, Eye, EyeOff, Shield, User as UserIcon, Mail, Lock, Edit2, ChevronDown, Trash2, Settings, LogOut, HelpCircle, Search, MessageSquare, AlertCircle, UserPlus, UserCheck, UserX, Users, Bell, MoreVertical, Flag, Share2, Ban } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { FaLinkedinIn, FaTelegramPlane } from 'react-icons/fa';
import GlobalChatWidget from './components/GlobalChatWidget';

const API = 'http://127.0.0.1:3001';

const Profile = () => {
  const navigate = useNavigate();
  const { username: viewingUsername } = useParams(); // if set, we're viewing another user
  const { t } = useTranslation();
  const token = localStorage.getItem('watch_token');
  const myUsername = localStorage.getItem('watch_username');
  const isOwnProfile = !viewingUsername || viewingUsername.toLowerCase() === myUsername?.toLowerCase();

  const fileInputRef = useRef(null);
  const [openSection, setOpenSection] = useState(null);
  const toggleSection = (sec) => setOpenSection(p => p === sec ? null : sec);

  // Own profile state
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Other user profile state
  const [otherProfile, setOtherProfile] = useState(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [userNotFound, setUserNotFound] = useState(false);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteChecked, setDeleteChecked] = useState(false);
  const [showDeleteError, setShowDeleteError] = useState(false);

  // Navbar state
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showRecentChats, setShowRecentChats] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [totalUnread, setTotalUnread] = useState(0);
  const [followRequests, setFollowRequests] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [flagUrl, setFlagUrl] = useState('');

  // Fetch flag from restcountries if otherProfile has a country
  useEffect(() => {
    if (otherProfile?.country) {
      fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(otherProfile.country)}?fullText=true&fields=flags`)
        .then(res => res.json())
        .then(data => { if (data[0] && data[0].flags && data[0].flags.png) setFlagUrl(data[0].flags.png); })
        .catch(() => setFlagUrl(''));
    } else {
      setFlagUrl('');
    }
  }, [otherProfile?.country]);

  // Followers / Following modal
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [followModalTab, setFollowModalTab] = useState('followers'); // 'followers' | 'following'
  const [followListData, setFollowListData] = useState({ followers: [], following: [] });
  const [followListLoading, setFollowListLoading] = useState(false);

  const openFollowModal = useCallback(async (tab, targetUsername) => {
    setFollowModalTab(tab);
    setShowFollowModal(true);
    setFollowListLoading(true);
    try {
      const res = await fetch(`${API}/api/follow/${targetUsername}/list`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setFollowListData({ followers: data.followers || [], following: data.following || [] });
    } catch { setFollowListData({ followers: [], following: [] }); }
    setFollowListLoading(false);
  }, [token]);

  const ReactIsAwesome = React; // just dummy not to conflict
  const navIconsRef = ReactIsAwesome.useRef(null);
  const chatWidgetRef = ReactIsAwesome.useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (chatWidgetRef.current && chatWidgetRef.current.contains(e.target)) return;
      if (navIconsRef.current && !navIconsRef.current.contains(e.target)) {
        setShowSearch(false);
        setShowRecentChats(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchRequests = () => {
      if (token) {
        fetch(`${API}/api/follow/requests`, { headers: { 'Authorization': `Bearer ${token}` } })
          .then(r => r.json()).then(d => { if(Array.isArray(d)) setFollowRequests(d); }).catch(() => {});
      }
    };
    fetchRequests();
    const interval = setInterval(fetchRequests, 3000);
    return () => clearInterval(interval);
  }, [token]);

  // ── Unread message tracking ──
  useEffect(() => {
    if (!token) return;
    const getLastSeen = () => {
      try { return JSON.parse(localStorage.getItem('chat_last_seen') || '{}'); } catch { return {}; }
    };
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

  const handleAllowRequest = async (requestingUser, e) => {
    e.stopPropagation();
    try {
      const r = await fetch(`${API}/api/follow/${requestingUser}/accept`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const d = await r.json();
      if (!d.error) {
         toast.success(`Accepted ${requestingUser}'s follow request`);
         if (isOwnProfile && profile) setProfile(p => ({ ...p, followersCount: (p.followersCount || 0) + 1 }));
         setFollowRequests(prev => prev.map(u => u.username === requestingUser ? { ...u, status: 'accepted' } : u));
         if (isOwnProfile) fetchProfile();
      }
    } catch {}
  };

  const handleFollowBack = async (requestingUser, e) => {
    e.stopPropagation();
    try {
      // Allow first (safe if already allowed)
      await fetch(`${API}/api/follow/${requestingUser}/accept`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      // Then request back
      await fetch(`${API}/api/follow/${requestingUser}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      toast.success(`Follow request sent back to ${requestingUser}!`);
      if (isOwnProfile && profile) setProfile(p => ({ ...p, followersCount: (p.followersCount || 0) + 1 }));
      setFollowRequests(prev => prev.map(u => u.username === requestingUser ? { ...u, status: 'accepted', myFollowStatus: 'pending' } : u));
      if (isOwnProfile) fetchProfile();
    } catch {}
  };

  // Image crop state
  const [selectedImage, setSelectedImage] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const cropCanvasRef = useRef(null);
  const imgRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const fetchProfile = useCallback(() => {
    if (!token) return;
    fetch(`${API}/api/profile`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setProfile(data);
        setDisplayName(prev => (prev && prev !== data.displayName && prev !== data.username) ? prev : (data.displayName || data.username || ''));
        setBio(prev => (prev && prev !== data.bio) ? prev : (data.bio || ''));
      })
      .catch(() => {});
  }, [token]);
  
  const fetchBlockedUsers = useCallback(() => {
    if (!token) return;
    setLoadingBlocked(true);
    fetch(`${API}/api/blocks`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setBlockedUsers(data);
        setLoadingBlocked(false);
      })
      .catch(() => setLoadingBlocked(false));
  }, [token]);

  const fetchOtherProfile = useCallback(() => {
    if (!viewingUsername) return;
    fetch(`${API}/api/users/${viewingUsername}`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => {
        if (r.status === 404) { setUserNotFound(true); return null; }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        if (data.error) { setUserNotFound(true); return; }
        setOtherProfile(data);
      })
      .catch(() => toast.error('Network error loading profile'));
  }, [viewingUsername, token]);

  useEffect(() => {
    const loadData = () => {
      if (isOwnProfile) fetchProfile();
      else { fetchProfile(); fetchOtherProfile(); }
    };
    loadData();
    const intervalId = setInterval(loadData, 3000);
    return () => clearInterval(intervalId);
  }, [isOwnProfile, fetchProfile, fetchOtherProfile]);

  useEffect(() => {
    if (!searchQuery) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      fetch(`${API}/api/users/search?q=${searchQuery}`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json()).then(d => { if(Array.isArray(d)) setSearchResults(d); else setSearchResults([]); }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, token]);

  useEffect(() => {
    // Recent chats are managed by GlobalChatWidget directly
  }, [showRecentChats, token]);

  useEffect(() => {
    if (openSection === 'blockedUsers') {
      fetchBlockedUsers();
    }
  }, [openSection, fetchBlockedUsers]);

  const handleSaveProfile = () => {
    if (!displayName.trim()) return;
    fetch(`${API}/api/profile`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ displayName: displayName.trim(), bio: bio.trim() })
    }).then(r => r.json()).then(data => {
      if (data.error) return toast.error(data.error);
      toast.success('Profile updated!');
      setEditingName(false);
      setEditingBio(false);
      fetchProfile();
    }).catch(() => toast.error('Failed to update'));
  };

  const [pwErrors, setPwErrors] = useState({});

  const validateNewPassword = (pw) => {
    const errs = {};
    if (!pw) { errs.newPassword = 'New password is required'; return errs; }
    if (pw.length < 8) errs.newPassword = 'Must be at least 8 characters';
    else if (!/[A-Z]/.test(pw)) errs.newPassword = 'Must contain at least 1 uppercase letter';
    else if (!/[0-9]/.test(pw)) errs.newPassword = 'Must contain at least 1 number';
    else if (!/[^A-Za-z0-9]/.test(pw)) errs.newPassword = 'Must contain at least 1 special character (!@#$%…)';
    return errs;
  };

  const handleChangePassword = () => {
    const errs = {};
    if (!currentPassword) errs.currentPassword = 'Current password is required';
    const pwValidation = validateNewPassword(newPassword);
    Object.assign(errs, pwValidation);
    if (newPassword && !errs.newPassword && newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (!confirmPassword && !errs.confirmPassword) errs.confirmPassword = 'Please confirm your new password';
    setPwErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setChangingPassword(true);
    fetch(`${API}/api/profile/change-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword })
    }).then(r => r.json()).then(data => {
      setChangingPassword(false);
      if (data.error) return toast.error(data.error);
      toast.success(t('pwChangedToast', 'Password changed!'));
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPwErrors({});
    }).catch(() => { setChangingPassword(false); toast.error(t('failedToast', 'Failed')); });
  };

  const handleDeleteAccount = () => {
    if (!deleteChecked) { setShowDeleteError(true); return; }
    fetch(`${API}/api/profile`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(res => {
        if (res.error) toast.error(res.error);
        else {
          localStorage.removeItem('watch_token');
          localStorage.removeItem('watch_username');
          toast.success('Account permanently deleted');
          setTimeout(() => navigate('/login'), 1000);
        }
      }).catch(() => toast.error('Failed to delete account'));
  };

  const handleFollow = async () => {
    if (!otherProfile) return;
    setFollowLoading(true);
    try {
      const currentStatus = otherProfile.followStatus;
      if (currentStatus === null) {
        // Send follow request
        const r = await fetch(`${API}/api/follow/${otherProfile.username}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        const d = await r.json();
        if (d.error) toast.error(d.error);
        else { toast.success('Follow request sent!'); fetchOtherProfile(); }
      } else {
        // Unfollow / cancel request
        const r = await fetch(`${API}/api/follow/${otherProfile.username}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        const d = await r.json();
        if (d.error) toast.error(d.error);
        else { 
           toast.success(currentStatus === 'pending' ? 'Request cancelled' : 'Unfollowed'); 
           setOtherProfile(p => ({ 
              ...p, 
              followStatus: null,
              followersCount: currentStatus === 'accepted' ? Math.max(0, (p.followersCount || 0) - 1) : p.followersCount
           }));
           fetchOtherProfile(); 
        }
      }
    } catch { toast.error('Network error'); }
    setFollowLoading(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setSelectedImage(ev.target.result); setCropOffset({ x: 0, y: 0 }); setCropZoom(1); setShowCropModal(true); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  useEffect(() => {
    if (!showCropModal || !selectedImage || !cropCanvasRef.current) return;
    const canvas = cropCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const size = 240;
      canvas.width = size; canvas.height = size;
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
      const scale = cropZoom;
      const w = img.width * scale; const h = img.height * scale;
      const x = (size - w) / 2 + cropOffset.x; const y = (size - h) / 2 + cropOffset.y;
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();
      ctx.strokeStyle = 'rgba(168,85,247,0.6)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2); ctx.stroke();
    };
    img.src = selectedImage;
  }, [showCropModal, selectedImage, cropOffset, cropZoom]);

  const handleCropMouseDown = (e) => { isDragging.current = true; dragStart.current = { x: e.clientX - cropOffset.x, y: e.clientY - cropOffset.y }; };
  const handleCropMouseMove = (e) => { if (!isDragging.current) return; setCropOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }); };
  const handleCropMouseUp = () => { isDragging.current = false; };

  const handleCropConfirm = () => {
    if (!cropCanvasRef.current) return;
    cropCanvasRef.current.toBlob((blob) => {
      setShowCropModal(false);
      const formData = new FormData();
      formData.append('avatar', blob, 'avatar.png');
      fetch(`${API}/api/profile/avatar`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData })
        .then(r => r.json()).then(data => {
          if (data.error) return toast.error(data.error);
          toast.success('Avatar updated!');
          fetchProfile();
        }).catch(() => toast.error('Upload failed'));
    }, 'image/png');
  };

  if (!profile) return <div style={{ color: '#fff', textAlign: 'center', padding: 80 }}>Loading...</div>;
  const avatarUrl = profile.avatarPath ? `${API}${profile.avatarPath}` : null;
  const displayProfile = isOwnProfile ? profile : otherProfile;

  // Follow button state
  const followStatus = otherProfile?.followStatus;
  const followBtnLabel = followStatus === 'accepted' ? 'Following' : followStatus === 'pending' ? 'Requested' : 'Follow';
  const followBtnIcon = followStatus === 'accepted' ? <UserCheck size={16} /> : followStatus === 'pending' ? <UserX size={16} /> : <UserPlus size={16} />;
  const followBtnColor = followStatus ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#6366f1,#a855f7)';
  const followBtnTextColor = followStatus ? '#aaa' : '#fff';

  return (
    <div style={{ minHeight: '100vh', overflowX: 'hidden' }}>
      <Toaster position="top-center" />
      <style>{`
        .profile-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; padding: 24px 28px; margin-bottom: 24px; transition: all 0.2s; }
        .profile-card:hover { border-color: rgba(255,255,255,0.15); }
        .acc-header { display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; }
        .acc-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: #e2e8f0; display: flex; align-items: center; gap: 10px; }
        .acc-body { margin-top: 24px; animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .profile-input { width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #fff; font-size: 15px; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
        .profile-input:focus { border-color: rgba(99,102,241,0.5); }
        .profile-input:disabled { opacity: 0.5; cursor: not-allowed; }
        .back-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #ccc; padding: 8px 16px; border-radius: 12px; display: inline-flex; alignItems: center; gap: 8px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s; }
        .back-btn:hover { background: rgba(255,255,255,0.1); color: #fff; transform: translateX(-4px); }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        .save-btn { background: linear-gradient(135deg, #6366f1, #a855f7); border: none; color: #fff; padding: 10px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: transform 0.2s, opacity 0.2s; }
        .save-btn:hover { transform: translateY(-1px); }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .field-label { font-size: 13px; color: #888; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .pw-wrapper { position: relative; }
        .pw-toggle { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #888; cursor: pointer; }
        .stat-box { text-align: center; }
        .stat-num { font-size: 22px; font-weight: 800; color: #fff; }
        .stat-lbl { font-size: 12px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
      `}</style>

      {/* Navbar */}
      <nav style={{ padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <button className="back-btn" onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc', padding: '8px 16px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s', animation: 'slideInRight 0.3s ease-out' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#ccc'; }}>
            <ArrowLeft size={16} /> Back
          </button>
        </div>

        <div ref={navIconsRef} style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <button title="Search" onClick={() => { setShowSearch(!showSearch); setShowRecentChats(false); setShowNotifications(false); }} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: showSearch ? '#6366f1' : '#888', padding: '8px', borderRadius: '50%', cursor: 'pointer', transition: 'all 0.2s', display: 'flex' }}>
              <Search size={18} />
            </button>
            {showSearch && (
              <div style={{ position: 'absolute', top: 'calc(100% + 12px)', right: -60, width: 320, background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.8)', zIndex: 10000 }}>
                <input autoFocus placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {searchResults.length > 0 ? (
                    searchResults.map(u => (
                      <div key={u.username} onClick={() => { setShowSearch(false); setSearchQuery(''); navigate(`/profile/${u.username}`); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                          {u.avatarPath ? <img src={`${API}${u.avatarPath}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={16} color="#fff" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{u.displayName || u.username}</div>
                          <div style={{ color: '#6b7280', fontSize: 11 }}>@{u.username}</div>
                        </div>
                      </div>
                    ))
                  ) : (searchQuery ? <div style={{ textAlign: 'center', color: '#444', fontSize: 12, padding: 12 }}>No users found</div> : null)}
                </div>
              </div>
            )}
          </div>

          {/* Recent Chats */}
          <div style={{ position: 'relative' }}>
            <button title="Chats" onClick={() => { setShowRecentChats(!showRecentChats); setShowSearch(false); setShowNotifications(false); }} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: showRecentChats ? '#6366f1' : '#888', padding: '8px', borderRadius: '50%', cursor: 'pointer', transition: 'all 0.2s', display: 'flex' }}>
              <MessageSquare size={18} />
              {totalUnread > 0 && (
                <div style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {totalUnread > 9 ? '9+' : totalUnread}
                </div>
              )}
            </button>
          </div>

          {/* Notifications / Follow Requests */}
          <div style={{ position: 'relative' }}>
            <button title="Notifications" onClick={() => { setShowNotifications(!showNotifications); setShowSearch(false); setShowRecentChats(false); }} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: showNotifications ? '#6366f1' : '#888', padding: '8px', borderRadius: '50%', cursor: 'pointer', transition: 'all 0.2s', display: 'flex' }}>
              <Bell size={18} />
              {followRequests.filter(r => r.status === 'pending').length > 0 && (
                <div style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {followRequests.filter(r => r.status === 'pending').length}
                </div>
              )}
            </button>
            {showNotifications && (
              <div style={{ position: 'absolute', top: 'calc(100% + 12px)', right: -20, width: 340, background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '12px 6px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)', zIndex: 10000 }}>
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

          {/* Profile icon */}
          <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }} onMouseLeave={() => setShowUserMenu(false)}>
            <div onMouseEnter={() => setShowUserMenu(true)} style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}>
              {avatarUrl ? <img src={avatarUrl} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={20} style={{ color: '#6366f1' }} />}
            </div>
            {showUserMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: 8, zIndex: 9999 }}>
                <div style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 8, minWidth: 220, boxShadow: '0 16px 48px rgba(0,0,0,0.8)' }}>
                  <button onClick={() => { setShowUserMenu(false); navigate('/profile'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={16} color="#6366f1" /></div>
                    {t('account', 'Account')}
                  </button>
                  <button onClick={() => { setShowUserMenu(false); navigate('/app-settings'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Settings size={16} color="#10b981" /></div>
                    {t('app', 'App')}
                  </button>
                  <button onClick={() => { setShowUserMenu(false); toast.success('Support email: help@watchtogether.app'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><HelpCircle size={16} color="#f59e0b" /></div>
                    {t('contactSupport', 'Contact Support')}
                  </button>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />
                  <button onClick={() => { setShowUserMenu(false); localStorage.removeItem('watch_token'); localStorage.removeItem('watch_username'); navigate('/login'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LogOut size={16} color="#f87171" /></div>
                    {t('logOut', 'Log Out')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Global Chat Widget */}
      <GlobalChatWidget ref={chatWidgetRef} isOpen={showRecentChats} onClose={() => setShowRecentChats(false)} unreadCounts={unreadCounts} onMarkRead={handleMarkRead} onNewMessage={handleNewMessage} />

      {/* ── Other User's Profile ── */}
      {!isOwnProfile && (
        <section style={{ maxWidth: '800px', margin: '40px auto 80px', padding: '0 20px' }}>
          {otherProfile && otherProfile.isBlockedByMe ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Ban size={36} color="#ef4444" />
              </div>
              <h3 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>User Blocked</h3>
              <p style={{ color: '#555', fontSize: 14 }}>You have blocked this account. You will not see their profile or messages.</p>
              <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={() => navigate('/')} style={{ padding: '10px 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Go Home</button>
                <button onClick={async () => {
                  await fetch(`${API}/api/block/${otherProfile.username}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                  toast.success('User unblocked!');
                  fetchOtherProfile();
                }} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Unblock User</button>
              </div>
            </div>
          ) : otherProfile && !userNotFound ? (
            <div>
              {/* Profile Header Card */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 24, padding: 32, marginBottom: 24 }}>
                
                {/* Top Row: Avatar + Stats */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginBottom: 24 }}>
                  <div style={{ width: 96, height: 96, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.4)', overflow: 'hidden', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {otherProfile.avatarPath ? <img src={`${API}${otherProfile.avatarPath}`} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={44} color="#6366f1" />}
                  </div>
                  
                  {/* Stats beside Avatar */}
                  <div style={{ display: 'flex', gap: 32 }}>
                    <button onClick={() => openFollowModal('followers', otherProfile.username)} className="stat-box" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'center' }}>
                      <div className="stat-num">{otherProfile.followersCount ?? 0}</div>
                      <div className="stat-lbl">Followers</div>
                    </button>
                    <button onClick={() => openFollowModal('following', otherProfile.username)} className="stat-box" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'center' }}>
                      <div className="stat-num">{otherProfile.followingCount ?? 0}</div>
                      <div className="stat-lbl">Following</div>
                    </button>
                  </div>

                  {/* 3 dots options menu */}
                  <div style={{ marginLeft: 'auto', position: 'relative', alignSelf: 'flex-start', marginTop: 12 }}>
                    {showOptionsDropdown && (
                      <div onClick={() => setShowOptionsDropdown(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
                    )}
                    <button onClick={() => setShowOptionsDropdown(!showOptionsDropdown)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: 8, display: 'flex', borderRadius: '50%', position: 'relative', zIndex: 91 }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <MoreVertical size={20} />
                    </button>
                    {showOptionsDropdown && (
                      <div style={{ position: 'absolute', top: '100%', right: 0, background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 8, minWidth: 200, boxShadow: '0 10px 40px rgba(0,0,0,0.8)', zIndex: 100 }}>
                        {otherProfile.country && (
                          <div style={{ padding: '10px 12px', color: '#bbb', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 4 }}>
                            {flagUrl ? <img src={flagUrl} alt="flag" style={{ width: 16, height: 12, objectFit: 'cover', borderRadius: 2 }} /> : <Flag size={14} color="#a855f7" />} Country: {otherProfile.country}
                          </div>
                        )}
                        <button onClick={() => {
                          setShowOptionsDropdown(false);
                          setShowShareModal(true);
                        }} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#fff', padding: '10px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <Share2 size={14} /> Share Profile URL
                        </button>
                        <button onClick={async () => {
                          const r = await fetch(`${API}/api/block/${otherProfile.username}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
                          if (r.ok) {
                            toast.success(`You have blocked ${otherProfile.username}`);
                            setShowOptionsDropdown(false);
                            fetchOtherProfile();
                          }
                        }} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#ef4444', padding: '10px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <Ban size={14} /> Block User
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info block */}
                <div style={{ marginBottom: 20 }}>
                  <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: '#fff' }}>{otherProfile.displayName || otherProfile.username}</h2>
                  <div style={{ color: '#6b7280', fontSize: 14, marginBottom: 12 }}>@{otherProfile.username}</div>
                  {otherProfile.bio && <p style={{ color: '#ccc', fontSize: 14, lineHeight: 1.6, margin: '0' }}>{otherProfile.bio}</p>}
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '20px 0' }} />

                {/* Action Buttons under divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button onClick={handleFollow} disabled={followLoading}
                    style={{ flex: 1, minWidth: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 12, border: followStatus ? '1px solid rgba(255,255,255,0.15)' : 'none', background: followBtnColor, color: followBtnTextColor, fontWeight: 700, fontSize: 14, cursor: followLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: followLoading ? 0.7 : 1 }}>
                    {followBtnIcon} {followLoading ? '...' : followBtnLabel}
                  </button>
                  {(() => {
                    // Mutual follow = I am following them (accepted) AND they are following me back (accepted)
                    const iMutuallyFollow = followStatus === 'accepted' && otherProfile.isFollowingMe;
                    return (
                      <button
                        title={iMutuallyFollow ? `Send a message to ${otherProfile.displayName || otherProfile.username}` : 'You can only message users you mutually follow'}
                        onClick={() => {
                          if (!iMutuallyFollow) {
                            if (!otherProfile.isFollowingMe && followStatus !== 'accepted') {
                              toast.error('You need to follow each other to send messages', { icon: '🔒' });
                            } else if (!otherProfile.isFollowingMe) {
                              toast.error(`${otherProfile.displayName || otherProfile.username} is not following you back yet`, { icon: '🔒' });
                            } else {
                              toast.error(`You are not following ${otherProfile.displayName || otherProfile.username} yet`, { icon: '🔒' });
                            }
                            return;
                          }
                          setShowRecentChats(true);
                          if (chatWidgetRef.current) {
                            chatWidgetRef.current.openChatWith(otherProfile.username, otherProfile.displayName || otherProfile.username, otherProfile.avatarPath);
                          }
                        }}
                        style={{
                          flex: 1, minWidth: 100,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          padding: '10px 0', borderRadius: 12,
                          border: iMutuallyFollow ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.07)',
                          background: iMutuallyFollow ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                          color: iMutuallyFollow ? '#fff' : '#555',
                          fontWeight: 700, fontSize: 14,
                          cursor: iMutuallyFollow ? 'pointer' : 'not-allowed',
                          transition: 'all 0.2s',
                          opacity: iMutuallyFollow ? 1 : 0.6,
                        }}
                        onMouseEnter={e => { if (iMutuallyFollow) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                        onMouseLeave={e => { if (iMutuallyFollow) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                      >
                        <MessageSquare size={16} />
                        Message
                        {!iMutuallyFollow && (
                          <span style={{ fontSize: 12, marginLeft: 2 }}>🔒</span>
                        )}
                      </button>
                    );
                  })()}
                  {otherProfile.email && (
                    <button onClick={() => { window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${otherProfile.email}`, '_blank'); }} 
                      style={{ flex: 1, minWidth: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
                      <Mail size={16} /> Email
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : userNotFound ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <UserIcon size={36} color="#555" />
              </div>
              <h3 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>User Not Found</h3>
              <p style={{ color: '#555', fontSize: 14 }}>This account doesn't exist or has been deleted.</p>
              <button onClick={() => navigate('/')} style={{ marginTop: 20, padding: '10px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Go Home</button>
            </div>
          ) : (
            <div style={{ color: '#fff', textAlign: 'center', padding: 80 }}>Loading profile...</div>
          )}
        </section>
      )}

      {/* ── Own Profile ── */}
      {isOwnProfile && (
        <section style={{ maxWidth: '620px', margin: '40px auto 80px', padding: '0 20px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 40px', color: '#fff' }}>{t('accountSettings', 'Account Settings')}</h2>

          {/* Avatar + name header with stats on the right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '40px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '32px' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 100, height: 100, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.4)', overflow: 'hidden', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatarUrl ? <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={40} color="#6366f1" />}
              </div>
              <button onClick={() => fileInputRef.current.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', border: '2px solid #0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Camera size={14} color="#fff" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileSelect} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Name row: display name on left, followers/following on far right */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#fff', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.displayName || profile.username}</h3>
                {/* Stats: far right, same line as name — clickable */}
                <div style={{ display: 'flex', gap: 24, flexShrink: 0 }}>
                  <button onClick={() => openFollowModal('followers', profile.username)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{profile.followersCount ?? 0}</div>
                    <div style={{ fontSize: 10, color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 3 }}>followers</div>
                  </button>
                  <button onClick={() => openFollowModal('following', profile.username)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{profile.followingCount ?? 0}</div>
                    <div style={{ fontSize: 10, color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 3 }}>following</div>
                  </button>
                </div>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#888' }}>@{profile.username}</p>
              {profile.bio && <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#aaa' }}>{profile.bio}</p>}
            </div>
          </div>

          {/* Display Name */}
          <div className="profile-card">
            <div className="acc-header" onClick={() => toggleSection('displayName')}>
              <h3><UserIcon size={18} color="#6366f1" /> {t('displayName', 'Display Name')}</h3>
              <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'displayName' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {openSection === 'displayName' && (
              <div className="acc-body">
                <div className="field-label">{t('profileOthersSee', 'This is how others see you')}</div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input className="profile-input" value={displayName} onChange={e => setDisplayName(e.target.value)} disabled={!editingName} style={{ flex: 1 }} />
                  {editingName ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="save-btn" onClick={handleSaveProfile}><Check size={16} /></button>
                      <button onClick={() => { setEditingName(false); setDisplayName(profile.displayName || profile.username); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', padding: '10px', borderRadius: 12, cursor: 'pointer' }}><X size={16} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingName(true)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', padding: '10px 16px', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Edit2 size={14} /> {t('edit', 'Edit')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bio */}
          <div className="profile-card">
            <div className="acc-header" onClick={() => toggleSection('bio')}>
              <h3><Edit2 size={18} color="#a855f7" /> Bio</h3>
              <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'bio' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {openSection === 'bio' && (
              <div className="acc-body">
                <div className="field-label">Tell others about yourself</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <textarea className="profile-input" value={bio} onChange={e => { if (e.target.value.length <= 180) setBio(e.target.value); }} disabled={!editingBio}
                    placeholder="Write a short bio..."
                    maxLength={180}
                    rows={3}
                    style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
                  <div style={{ textAlign: 'right', fontSize: 12, color: bio.length >= 170 ? '#ef4444' : bio.length >= 140 ? '#f59e0b' : '#555', fontWeight: 500, marginTop: -4 }}>
                    {180 - bio.length} / 180 characters remaining
                  </div>
                  {editingBio ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="save-btn" onClick={handleSaveProfile}><Check size={16} style={{ marginRight: 4 }} /> Save</button>
                      <button onClick={() => { setEditingBio(false); setBio(profile.bio || ''); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', padding: '10px 16px', borderRadius: 12, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingBio(true)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', padding: '10px 16px', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
                      <Edit2 size={14} /> {t('edit', 'Edit')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="profile-card">
            <div className="acc-header" onClick={() => toggleSection('email')}>
              <h3><Mail size={18} color="#10b981" /> {t('email', 'Email')}</h3>
              <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'email' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {openSection === 'email' && (
              <div className="acc-body">
                <div className="field-label">{t('profileEmailText', 'Your registered email address')}</div>
                <input className="profile-input" value={profile.email || ''} disabled style={{ opacity: 0.6 }} />
              </div>
            )}
          </div>

          {/* Password */}
          <div className="profile-card">
            <div className="acc-header" onClick={() => toggleSection('password')}>
              <h3><Lock size={18} color="#f59e0b" /> {t('changePassword', 'Change Password')}</h3>
              <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'password' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {openSection === 'password' && (
              <div className="acc-body">
                <div className="field-label">{t('updatePwText', 'Update your account password')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div className="pw-wrapper">
                      <input className="profile-input" type={showCurrentPw ? 'text' : 'password'} placeholder={t('currentPassword', 'Current Password')} value={currentPassword}
                        onChange={e => { setCurrentPassword(e.target.value); if (pwErrors.currentPassword) setPwErrors(p => ({ ...p, currentPassword: null })); }}
                        style={{ borderColor: pwErrors.currentPassword ? '#ef4444' : undefined }} />
                      <button className="pw-toggle" onClick={() => setShowCurrentPw(p => !p)}>{showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    </div>
                    {pwErrors.currentPassword && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}><AlertCircle size={12} />{pwErrors.currentPassword}</div>}
                  </div>
                  <div>
                    <div className="pw-wrapper">
                      <input className="profile-input" type={showNewPw ? 'text' : 'password'} placeholder={t('newPassword', 'New Password')} value={newPassword}
                        onChange={e => { setNewPassword(e.target.value); if (pwErrors.newPassword) setPwErrors(p => ({ ...p, newPassword: null })); }}
                        style={{ borderColor: pwErrors.newPassword ? '#ef4444' : undefined }} />
                      <button className="pw-toggle" onClick={() => setShowNewPw(p => !p)}>{showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    </div>
                    {pwErrors.newPassword && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}><AlertCircle size={12} />{pwErrors.newPassword}</div>}
                  </div>
                  <div>
                    <div className="pw-wrapper">
                      <input className="profile-input" type={showConfirmPw ? 'text' : 'password'} placeholder={t('confirmNewPassword', 'Confirm New Password')} value={confirmPassword}
                        onChange={e => { setConfirmPassword(e.target.value); if (pwErrors.confirmPassword) setPwErrors(p => ({ ...p, confirmPassword: null })); }}
                        style={{ borderColor: pwErrors.confirmPassword ? '#ef4444' : undefined }} />
                      <button className="pw-toggle" onClick={() => setShowConfirmPw(p => !p)}>{showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    </div>
                    {pwErrors.confirmPassword && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}><AlertCircle size={12} />{pwErrors.confirmPassword}</div>}
                  </div>
                  <button className="save-btn" onClick={handleChangePassword} disabled={changingPassword} style={{ alignSelf: 'flex-start' }}>
                    {changingPassword ? 'Changing...' : t('updatePassword', 'Update Password')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Blocked Users */}
          <div className="profile-card">
            <div className="acc-header" onClick={() => toggleSection('blockedUsers')}>
              <h3><Shield size={18} color="#ef4444" /> {t('blockedUsers', 'Blocked Users')}</h3>
              <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'blockedUsers' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {openSection === 'blockedUsers' && (
              <div className="acc-body">
                <div className="field-label">{t('blockedUsersText', "Users you've blocked from rooms or profile")}</div>
                {loadingBlocked ? (
                  <div style={{ padding: '12px', textAlign: 'center', color: '#888', fontSize: 13 }}>Loading...</div>
                ) : blockedUsers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                    {blockedUsers.map(u => (
                      <div key={u.username} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                          {u.avatarPath ? <img src={`${API}${u.avatarPath}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={18} color="#fff" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{u.displayName || u.username}</div>
                          <div style={{ color: '#6b7280', fontSize: 12 }}>@{u.username}</div>
                        </div>
                        <button onClick={async (e) => {
                          e.stopPropagation();
                          const res = await fetch(`${API}/api/block/${u.username}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                          if (res.ok) {
                            toast.success(`Unblocked ${u.username}`);
                            fetchBlockedUsers();
                            if (isOwnProfile) fetchProfile(); // Update follower/following counts if changed
                          } else {
                            toast.error('Failed to unblock');
                          }
                        }} style={{ padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                           onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                           onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}>
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#555', fontSize: 14 }}>{t('noBlockedUsers', 'No blocked users yet')}</div>
                )}
              </div>
            )}
          </div>

          {/* Delete Account */}
          <div className="profile-card" style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.02)' }}>
            <div className="acc-header" onClick={() => toggleSection('deleteAccount')}>
              <h3><Trash2 size={18} color="#ef4444" /> {t('deleteAccount', 'Delete Account')}</h3>
              <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'deleteAccount' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {openSection === 'deleteAccount' && (
              <div className="acc-body">
                <div className="field-label" style={{ color: '#ef4444' }}>Danger Zone</div>
                <p style={{ color: '#aaa', fontSize: 13, marginBottom: 16 }}>Once you delete your account, there is no going back. Please be certain.</p>
                <button className="save-btn" onClick={() => { setShowDeleteModal(true); setDeleteChecked(false); setShowDeleteError(false); }} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                  Delete My Account
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1a1a2e', borderRadius: 24, padding: 32, border: '1px solid rgba(255,255,255,0.08)', maxWidth: 400, width: '90vw' }}>
            <h3 style={{ color: '#ef4444', fontSize: 20, fontWeight: 700, margin: '0 0 12px' }}>Delete Account</h3>
            <p style={{ color: '#bbb', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>Are you absolutely sure? Everything will be permanently deleted.</p>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={deleteChecked} onChange={e => { setDeleteChecked(e.target.checked); if (e.target.checked) setShowDeleteError(false); }} style={{ marginTop: 2 }} />
              <span style={{ color: '#fff', fontSize: 14 }}>I understand that my account and all associated data will be permanently deleted.</span>
            </label>
            {showDeleteError && !deleteChecked && (
              <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16, paddingLeft: 28 }}>⚠️ Please select this checkbox to proceed</div>
            )}
            {!showDeleteError && <div style={{ height: 16 }} />}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteModal(false)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDeleteAccount} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}

      {/* Crop Modal */}
      {showCropModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1a1a2e', borderRadius: 24, padding: 32, border: '1px solid rgba(255,255,255,0.08)', maxWidth: 360, width: '90vw', textAlign: 'center' }}>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Crop your photo</h3>
            <div style={{ position: 'relative', width: 240, height: 240, margin: '0 auto', borderRadius: '50%', overflow: 'hidden', cursor: 'grab', background: '#000' }}
              onMouseDown={handleCropMouseDown} onMouseMove={handleCropMouseMove} onMouseUp={handleCropMouseUp} onMouseLeave={handleCropMouseUp}>
              <canvas ref={cropCanvasRef} width={240} height={240} style={{ width: '100%', height: '100%' }} />
            </div>
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: '#888' }}>Zoom</span>
              <input type="range" min="0.5" max="3" step="0.05" value={cropZoom} onChange={e => setCropZoom(parseFloat(e.target.value))} style={{ flex: 1, maxWidth: 180, accentColor: '#6366f1' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
              <button onClick={() => fileInputRef.current.click()} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc', padding: '10px 20px', borderRadius: 12, cursor: 'pointer', fontSize: 14 }}>Reselect</button>
              <button onClick={() => setShowCropModal(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc', padding: '10px 20px', borderRadius: 12, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button className="save-btn" onClick={handleCropConfirm}><Check size={16} style={{ marginRight: 4 }} /> Save</button>
            </div>
          </div>
        </div>
      )}
      {/* Share Modal */}
      {showShareModal && (
        <div onClick={() => setShowShareModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9990 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', padding: 32, borderRadius: 24, width: '90%', maxWidth: 480, animation: 'slideUp 0.3s ease-out', position: 'relative' }}>
            
            <button onClick={() => setShowShareModal(false)} style={{ position: 'absolute', top: -2, right: -64, width: 44, height: 44, borderRadius: '50%', background: '#2a2a3e', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', transition: 'background 0.2s, transform 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background='#3a3a4e'; e.currentTarget.style.transform='scale(1.05)' }} onMouseLeave={e => { e.currentTarget.style.background='#2a2a3e'; e.currentTarget.style.transform='scale(1)' }}>
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 24px', color: '#fff', fontSize: 20, fontWeight: 800, textAlign: 'center' }}>Share Profile</h3>
            
            <div style={{ display: 'flex', gap: 10, background: 'rgba(255,255,255,0.04)', padding: '12px 14px', borderRadius: 16, marginBottom: 32, border: '1px solid rgba(255,255,255,0.08)' }}>
              <input type="text" readOnly value={`${window.location.origin}/profile/${otherProfile?.username}`} style={{ background: 'transparent', border: 'none', color: '#ccc', width: '100%', outline: 'none', fontSize: 13, fontWeight: 500 }} />
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/profile/${otherProfile?.username}`); toast.success('Copied!'); }} style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>Copy</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, max-content)', gap: '20px 16px', justifyContent: 'center' }}>
              {[
                { label: 'WhatsApp', color: '#25D366', icon: 'whatsapp/white', url: `https://api.whatsapp.com/send?text=${window.location.origin}/profile/${otherProfile?.username}` },
                { label: 'Instagram', color: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', icon: 'instagram/white', url: 'https://instagram.com/' },
                { label: 'Snapchat', color: '#FFFC00', icon: 'snapchat/black', url: 'https://snapchat.com/' },
                { label: 'Reddit', color: '#FF4500', icon: 'reddit/white', url: `https://reddit.com/submit?url=${window.location.origin}/profile/${otherProfile?.username}` },
                { label: 'Discord', color: '#5865F2', icon: 'discord/white', url: `https://discord.com/channels/@me` },
                { label: 'Telegram', color: '#2AABEE', Icon: FaTelegramPlane, url: `https://t.me/share/url?url=${window.location.origin}/profile/${otherProfile?.username}`, iconSize: 26, iconStyle: { position: 'relative', right: 2 } },
                { label: 'X', color: '#000000', icon: 'x/white', url: `https://twitter.com/intent/tweet?url=${window.location.origin}/profile/${otherProfile?.username}` },
                { label: 'Email', color: '#EA4335', icon: 'gmail/white', url: `mailto:?body=${window.location.origin}/profile/${otherProfile?.username}` },
                { label: 'Facebook', color: '#1877F2', icon: 'facebook/white', url: `https://www.facebook.com/sharer/sharer.php?u=${window.location.origin}/profile/${otherProfile?.username}` },
                { label: 'LinkedIn', color: '#0A66C2', Icon: FaLinkedinIn, url: `https://www.linkedin.com/shareArticle?mini=true&url=${window.location.origin}/profile/${otherProfile?.username}`, iconSize: 22 },
                { label: 'Pinterest', color: '#E60023', icon: 'pinterest/white', url: `https://pinterest.com/pin/create/button/?url=${window.location.origin}/profile/${otherProfile?.username}` },
                { label: 'Twitch', color: '#9146FF', icon: 'twitch/white', url: 'https://twitch.tv/' }
              ].map(s => (
                <button key={s.label} onClick={() => window.open(s.url, '_blank')} style={{ width: 48, height: 48, borderRadius: '50%', background: s.color, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} title={s.label} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                  {s.Icon ? <s.Icon size={s.iconSize} color="#fff" style={s.iconStyle || {}} /> : <img src={`https://cdn.simpleicons.org/${s.icon}`} width="24" alt={s.label} style={s.imgStyle || {}} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* ── Followers / Following Modal ── */}
      {showFollowModal && (
        <div onClick={() => setShowFollowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          {/* X button outside the box */}
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowFollowModal(false)}
              style={{ position: 'absolute', top: -2, right: -48, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}>
              <X size={16} />
            </button>
            <div style={{ background: '#111217', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: 380, maxHeight: '72vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.9)', animation: 'slideDown 0.25s cubic-bezier(0.16,1,0.3,1)' }}>
              {/* Tab header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '18px 24px 0' }}>
                <button onClick={() => setFollowModalTab('followers')}
                  style={{ flex: 1, paddingBottom: 14, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: followModalTab === 'followers' ? '#fff' : '#555', borderBottom: followModalTab === 'followers' ? '2px solid #a855f7' : '2px solid transparent', transition: 'all 0.2s' }}>
                  Followers
                </button>
                <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', marginBottom: 14, flexShrink: 0 }} />
                <button onClick={() => setFollowModalTab('following')}
                  style={{ flex: 1, paddingBottom: 14, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: followModalTab === 'following' ? '#fff' : '#555', borderBottom: followModalTab === 'following' ? '2px solid #a855f7' : '2px solid transparent', transition: 'all 0.2s' }}>
                  Following
                </button>
              </div>
              {/* User list */}
              <div style={{ overflowY: 'auto', padding: '8px 6px 16px', flex: 1 }}>
                {followListLoading ? (
                  <div style={{ textAlign: 'center', color: '#555', padding: 40, fontSize: 14 }}>Loading...</div>
                ) : (followListData[followModalTab] || []).length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#444', padding: 48, fontSize: 14 }}>
                    {followModalTab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                  </div>
                ) : (
                  (followListData[followModalTab] || []).map(u => (
                    <div key={u.username} onClick={() => { setShowFollowModal(false); navigate(`/profile/${u.username}`); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ width: 42, height: 42, borderRadius: '50%', border: '2px solid rgba(99,102,241,0.3)', overflow: 'hidden', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {u.avatarPath ? <img src={`${API}${u.avatarPath}`} alt={u.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={18} color="#6366f1" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.displayName || u.username}</div>
                        <div style={{ color: '#6b7280', fontSize: 12, marginTop: 1 }}>@{u.username}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Global Chat Widget */}
      <GlobalChatWidget ref={chatWidgetRef} isOpen={showRecentChats} onClose={() => setShowRecentChats(false)} unreadCounts={unreadCounts} onMarkRead={handleMarkRead} onNewMessage={handleNewMessage} />

    </div>
  );
};

export default Profile;
