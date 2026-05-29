import React, { useState, useEffect, useRef, useCallback } from 'react';
import { clearUserSession } from './lib/authUtils.js';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Play, ArrowLeft, Camera, Check, X, Eye, EyeOff, Shield, User as UserIcon, Mail, Lock, Edit2, ChevronDown, Trash2, Settings, LogOut, HelpCircle, Search, MessageSquare, AlertCircle, UserPlus, UserCheck, UserX, Users, Bell, MoreVertical, Flag, Share2, Ban } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { FaLinkedin, FaTelegramPlane, FaWhatsapp, FaInstagram, FaSnapchatGhost, FaRedditAlien, FaDiscord, FaFacebookF, FaPinterestP, FaTwitch } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { SiGmail } from 'react-icons/si';
import GlobalChatWidget from './components/GlobalChatWidget';

const API = `http://${window.location.hostname}:3001`;

const Profile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { username: viewingUsername } = useParams(); // if set, we're viewing another user
  const { t } = useTranslation();
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const token = localStorage.getItem('watch_token');
  const myUsername = localStorage.getItem('watch_username');
  const isOwnProfile = !viewingUsername || viewingUsername.toLowerCase() === myUsername?.toLowerCase();

  const handleLogout = () => {
    clearUserSession();
    navigate('/login');
  };

  const copyProfileLink = () => {
    if (copied) return;
    navigator.clipboard.writeText(`${window.location.origin}/profile/${otherProfile?.username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied!');
  };

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

  // Other user profile state - initialize from cache for instant display
  const [otherProfile, setOtherProfile] = useState(() => {
    if (!viewingUsername) return null;
    try {
      const cached = localStorage.getItem(`profile_cache_${viewingUsername.toLowerCase()}`);
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
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
  const [unreadCounts, setUnreadCounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chat_unread_counts') || '{}'); } catch { return {}; }
  });
  const [totalUnread, setTotalUnread] = useState(() => {
    try {
      const counts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
      return Object.values(counts).reduce((a, b) => a + b, 0);
    } catch { return 0; }
  });
  const [followRequests, setFollowRequests] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
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
  const [followCache, setFollowCache] = useState({});

  useEffect(() => {
    const target = isOwnProfile ? myUsername : viewingUsername;
    if (target && token) {
      fetch(`${API}/api/follow/${target}/list`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          const newData = { followers: data.followers || [], following: data.following || [] };
          setFollowListData(newData);
          setFollowCache(prev => ({ ...prev, [target]: newData }));
        }).catch(() => {});
    }
  }, [isOwnProfile, myUsername, viewingUsername, token]);

  const openFollowModal = useCallback((tab, targetUsername) => {
    setFollowModalTab(tab);
    setShowFollowModal(true);
    
    if (followCache[targetUsername]) {
      setFollowListData(followCache[targetUsername]);
      setFollowListLoading(false);
    } else {
      setFollowListLoading(true);
    }
    
    fetch(`${API}/api/follow/${targetUsername}/list`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        const newData = { followers: data.followers || [], following: data.following || [] };
        setFollowListData(newData);
        setFollowCache(prev => ({ ...prev, [targetUsername]: newData }));
        setFollowListLoading(false);
      })
      .catch(() => {
        if (!followCache[targetUsername]) setFollowListData({ followers: [], following: [] });
        setFollowListLoading(false);
      });
  }, [token, followCache]);

  const ReactIsAwesome = React; // just dummy not to conflict
  const navIconsRef = ReactIsAwesome.useRef(null);
  const chatWidgetRef = ReactIsAwesome.useRef(null);

  useEffect(() => {
    toast.remove(); // Fully purge all toasts from the global store (prevents replay by this page's Toaster)
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
    const handleUpdate = () => {
      fetchRequests();
      if (typeof fetchProfile === 'function') fetchProfile();
      if (typeof fetchOtherProfile === 'function') fetchOtherProfile();
    };
    handleUpdate();
    const interval = setInterval(handleUpdate, 3000);
    window.addEventListener('follow_status_updated', handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('follow_status_updated', handleUpdate);
    };
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
    
    // Check if muted before updating counts (consistent with other views)
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

  // Image crop state
  const [selectedImage, setSelectedImage] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const cropCanvasRef = useRef(null);
  const imgRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Lock body scroll when modals are open
  useEffect(() => {
    if (showFollowModal || showCropModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showFollowModal, showCropModal]);

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
        // Cache for instant load next time
        try { localStorage.setItem(`profile_cache_${viewingUsername.toLowerCase()}`, JSON.stringify(data)); } catch {}
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
    if (newPassword && !errs.newPassword && newPassword === currentPassword) {
      errs.newPassword = 'New password should be different than current one';
    }
    if (newPassword && !errs.newPassword && newPassword !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }
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
          clearUserSession();
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
  const followBtnLabel = followStatus === 'accepted' ? t('followingStatus', 'Following') : followStatus === 'pending' ? t('requestSent', 'Requested') : t('follow', 'Follow');
  const followBtnIcon = followStatus === 'accepted' ? <UserCheck size={16} /> : followStatus === 'pending' ? <UserX size={16} /> : <UserPlus size={16} />;
  const followBtnColor = followStatus ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#6366f1,#a855f7)';
  const followBtnTextColor = followStatus ? (isLight ? '#444' : '#aaa') : '#fff';

  return (
    <div style={{ minHeight: '100vh', overflowX: 'hidden' }}>
      <Toaster position="top-center" containerStyle={{ zIndex: 100001 }} />
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
        @keyframes slideInRight { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        .save-btn { background: linear-gradient(135deg, #6366f1, #a855f7); border: none; color: #fff; padding: 10px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: transform 0.2s, opacity 0.2s; }
        .save-btn:hover { opacity: 0.8; }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .field-label { font-size: 13px; color: #888; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .pw-wrapper { position: relative; }
        .pw-toggle { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #888; cursor: pointer; }
        .stat-box { text-align: center; }
        .stat-num { font-size: 22px; font-weight: 800; color: #fff; }
         .stat-lbl { font-size: 12px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }

        /* ── Light Mode Overrides ── */
        html[data-theme='light'] body { background: #f7fafc !important; color: #111 !important; }
        html[data-theme='light'] nav { background: #fff !important; border-bottom: 1px solid rgba(0,0,0,0.08) !important; }
        
        html[data-theme='light'] .section-heading { color: #000 !important; }
        html[data-theme='light'] .section-desc { color: #4a5568 !important; }
        
        html[data-theme='light'] .section-heading { color: #000 !important; }
        html[data-theme='light'] .section-desc { color: #4a5568 !important; }

        html[data-theme='light'] .profile-card { background: #ffffff !important; border-color: rgba(0,0,0,0.08) !important; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
        html[data-theme='light'] .profile-card:hover { border-color: rgba(99,102,241,0.3) !important; }
        html[data-theme='light'] .acc-header h3 { color: #111 !important; }
        html[data-theme='light'] .field-label { color: #64748b !important; }
        html[data-theme='light'] .profile-input { background: #f8fafc !important; border-color: rgba(0,0,0,0.08) !important; color: #111 !important; }
        html[data-theme='light'] .profile-input:focus { border-color: #6366f1 !important; background: #fff !important; }

        html[data-theme='light'] h2, html[data-theme='light'] h3 { color: #000 !important; }
        html[data-theme='light'] .stat-num { color: #111 !important; }
        html[data-theme='light'] .stat-lbl { color: #64748b !important; }
        html[data-theme='light'] .save-btn { color: #ffffff !important; }
        html[data-theme='light'] .profile-input::placeholder { color: #64748b !important; }
        html[data-theme='light'] .profile-input { color: #1e293b !important; }
        
        .delete-btn { background: rgba(239,68,68,0.15); border: none; color: #ef4444; padding: 10px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: transform 0.2s, background 0.2s; }
        .delete-btn:hover { background: rgba(239,68,68,0.25); }
        html[data-theme='light'] .delete-btn { background: #fee2e2 !important; color: #ef4444 !important; }
        html[data-theme='light'] .delete-btn:hover { background: #fecaca !important; }
        html[data-theme='light'] .danger-desc { color: #475569 !important; }
        
        /* Crop Modal */
        .crop-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); z-index: 99999; display: flex; align-items: center; justify-content: center; }
        .crop-modal-content { background: #1a1a2e; border-radius: 24px; padding: 32px; border: 1px solid rgba(255,255,255,0.08); max-width: 360px; width: 90vw; text-align: center; }
        .crop-btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #ccc; padding: 10px 20px; border-radius: 12px; cursor: pointer; font-size: 14px; transition: background 0.2s; }
        .crop-btn:hover { background: rgba(255,255,255,0.1); }
        
        html[data-theme='light'] .crop-modal-overlay { background: rgba(255,255,255,0.4) !important; }
        html[data-theme='light'] .crop-modal-content { background: rgba(255,255,255,0.85) !important; backdrop-filter: blur(24px) !important; -webkit-backdrop-filter: blur(24px) !important; border: 1px solid rgba(0,0,0,0.1) !important; box-shadow: 0 16px 40px rgba(0,0,0,0.1) !important; }
        html[data-theme='light'] .crop-title { color: #111 !important; }
        html[data-theme='light'] .crop-btn { background: #f1f5f9 !important; border-color: #e2e8f0 !important; color: #334155 !important; }
        html[data-theme='light'] .crop-btn:hover { background: #e2e8f0 !important; }
        html[data-theme='light'] .crop-zoom-label { color: #64748b !important; }
        
        /* Followers / Following Modal */
        .follow-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 20000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .follow-modal-content { background: #111217; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; width: 380px; max-height: 72vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 80px rgba(0,0,0,0.9); animation: slideDown 0.25s cubic-bezier(0.16,1,0.3,1); }
        .follow-modal-close { position: absolute; top: -2px; right: -48px; width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.15); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 1; transition: background 0.2s; }
        .follow-modal-close:hover { background: rgba(255,255,255,0.22); }
        .follow-tab-btn { flex: 1; padding-bottom: 14px; border: none; background: transparent; cursor: pointer; font-size: 14px; font-weight: 700; color: #555; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .follow-tab-btn.active { color: #fff; border-bottom: 2px solid #a855f7; }
        .follow-user-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 12px; cursor: pointer; transition: background 0.15s; }
        .follow-user-item:hover { background: rgba(255,255,255,0.05); }
        .follow-user-name { color: #fff; font-weight: 700; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        html[data-theme='light'] .follow-modal-overlay { background: rgba(255,255,255,0.7) !important; }
        html[data-theme='light'] .follow-modal-content { background: #ffffff !important; border: 1px solid rgba(0,0,0,0.1) !important; box-shadow: 0 16px 40px rgba(0,0,0,0.1) !important; }
        html[data-theme='light'] .follow-modal-close { background: #f1f5f9 !important; border: 1px solid #e2e8f0 !important; color: #475569 !important; }
        html[data-theme='light'] .follow-modal-close:hover { background: #e2e8f0 !important; color: #0f172a !important; }
        html[data-theme='light'] .follow-tab-btn { color: #64748b !important; }
        html[data-theme='light'] .follow-tab-btn.active { color: #111 !important; border-bottom: 2px solid #a855f7 !important; }
        html[data-theme='light'] .follow-user-item:hover { background: rgba(0,0,0,0.05) !important; }
        html[data-theme='light'] .follow-user-name { color: #111 !important; }
        
        /* Edit & Action Buttons */
        .profile-edit-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 10px 18px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 700; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .profile-edit-btn svg { color: #fff; transition: color 0.25s; }
        .profile-edit-btn:hover { background: #6366f1 !important; border-color: #4f46e5 !important; color: #ffffff !important; box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
        .profile-edit-btn:hover svg { color: #ffffff !important; }
        
        html[data-theme='light'] .profile-edit-btn { background: #f1f5f9; border-color: #e2e8f0; color: #000 !important; }
        html[data-theme='light'] .profile-edit-btn svg { color: #000 !important; }
        html[data-theme='light'] .profile-edit-btn:hover { background: #6366f1 !important; border-color: #4f46e5 !important; color: #ffffff !important; }
        html[data-theme='light'] .profile-edit-btn:hover svg { color: #ffffff !important; }
        
        .profile-save-box { width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: linear-gradient(135deg, #6366f1, #a855f7); border: none; color: #ffffff !important; cursor: pointer; transition: all 0.2s; }
        .profile-save-box svg { color: #ffffff !important; }
        .profile-save-box:hover { box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
        
        .profile-cancel-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #aaa; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
        .profile-cancel-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        
        html[data-theme='light'] .profile-cancel-btn { background: #ffffff !important; border: 1px solid rgba(0,0,0,0.12) !important; color: #64748b !important; }
        html[data-theme='light'] .profile-cancel-btn:hover { background: #f1f5f9 !important; color: #ef4444 !important; border-color: #ef4444 !important; }
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
              className={`nav-icon-btn${showSearch ? ' active' : ''}`}
              title="Search"
              onClick={() => { setShowSearch(!showSearch); setShowRecentChats(false); setShowNotifications(false); setShowUserMenu(false); }}
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
              className={`nav-icon-btn${showRecentChats ? ' active' : ''}`}
              title="Chats"
              onClick={() => { setShowRecentChats(!showRecentChats); setShowNotifications(false); setShowSearch(false); setShowUserMenu(false); }}
            >
              <MessageSquare size={18} />
              {totalUnread > 0 && (
                <div className="unread-badge stay-white" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {totalUnread > 9 ? '9+' : totalUnread}
                </div>
              )}
            </button>
          </div>

          {/* Notifications */}
          <div style={{ position: 'relative' }}>
            <button title="Notifications" onClick={() => { setShowNotifications(!showNotifications); setShowRecentChats(false); setShowSearch(false); setShowUserMenu(false); }} className={`nav-icon-btn${showNotifications ? ' active' : ''}`}>
              <Bell size={18} />
              {followRequests.filter(r => r.status === 'pending').length > 0 && (
                <div className="unread-badge stay-white" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {followRequests.filter(r => r.status === 'pending').length}
                </div>
              )}
            </button>
            {showNotifications && (
              <div className="nav-dropdown" style={{ position: 'absolute', top: 'calc(100% + 12px)', right: 0, width: 340, background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '12px 6px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)', zIndex: 10000 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#555', padding: '0 12px 8px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>{t('followNotifications', 'Follow Notifications')}</div>
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
                            {u.status === 'pending' ? t('wantsToFollow', { username: `@${u.username}`, defaultValue: `@${u.username} wants to follow you` }) : t('startedFollowing', { username: `@${u.username}`, defaultValue: `@${u.username} started following you` })}
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            {u.status === 'pending' ? (
                              <button onClick={(e) => handleAllowRequest(u.username, e)} style={{ padding: '6px 12px', background: 'rgba(99,102,241,0.15)', border: 'none', color: '#818cf8', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t('allow', 'Allow')}</button>
                            ) : (
                              <button disabled style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#6b7280', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{t('followerStatus', 'Follower')}</button>
                            )}
                            
                            {u.myFollowStatus === 'accepted' ? (
                              <button disabled style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.15)', border: 'none', color: '#10b981', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{t('followingStatus', 'Following')}</button>
                            ) : (
                              <button onClick={(e) => {
                                e.stopPropagation();
                                if (u.myFollowStatus === 'pending') return;
                                handleFollowBack(u.username, e);
                              }} style={{ padding: '6px 12px', background: u.myFollowStatus === 'pending' ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', color: u.myFollowStatus === 'pending' ? '#6b7280' : '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: u.myFollowStatus === 'pending' ? 'default' : 'pointer' }}>
                                {u.myFollowStatus === 'pending' ? t('requestSent', 'Request Sent') : t('followBack', 'Follow Back')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', color: '#444', fontSize: 12, padding: 24 }}>{t('noNewNotifications', 'No new notifications')}</div>
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
                      <LogOut size={16} color="#f87171" />
                    </div>
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
                  // Update local storage so widgets reflect immediately
                  try {
                    const myU = localStorage.getItem('watch_username');
                    const localBlocks = JSON.parse(localStorage.getItem(`blocked_chats_${myU}`) || '[]');
                    const nextBlocks = localBlocks.filter(k => k.toLowerCase() !== otherProfile.username.toLowerCase());
                    localStorage.setItem(`blocked_chats_${myU}`, JSON.stringify(nextBlocks));
                    window.dispatchEvent(new Event('blocked_chats_updated'));
                  } catch (e) {}
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
                      <div className="stat-lbl">{t('followersTabTitle', 'Followers')}</div>
                    </button>
                    <button onClick={() => openFollowModal('following', otherProfile.username)} className="stat-box" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'center' }}>
                      <div className="stat-num">{otherProfile.followingCount ?? 0}</div>
                      <div className="stat-lbl">{t('followingTabTitle', 'Following')}</div>
                    </button>
                  </div>

                  {/* 3 dots options menu */}
                  <div style={{ marginLeft: 'auto', position: 'relative', alignSelf: 'flex-start', marginTop: 12 }}>
                    {showOptionsDropdown && (
                      <div onClick={() => setShowOptionsDropdown(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
                    )}
                    <button className="options-three-dot-btn" onClick={() => {
                      setShowOptionsDropdown(!showOptionsDropdown);
                      setShowRecentChats(false);
                      setShowNotifications(false);
                      setShowSearch(false);
                      setShowUserMenu(false);
                    }} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: 8, display: 'flex', borderRadius: '50%', position: 'relative', zIndex: 91 }} onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <MoreVertical size={20} />
                    </button>
                    {showOptionsDropdown && (
                      <div className="options-dropdown" style={{ position: 'absolute', top: '100%', right: 0, background: isLight ? '#fff' : '#111', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 8, minWidth: 200, boxShadow: isLight ? '0 10px 40px rgba(0,0,0,0.1)' : '0 10px 40px rgba(0,0,0,0.8)', zIndex: 100 }}>
                        {otherProfile.country && (
                          <div className="options-dropdown-country" style={{ padding: '10px 12px', color: isLight ? '#64748b' : '#bbb', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.05)', marginBottom: 4 }}>
                            {flagUrl ? <img src={flagUrl} alt="flag" style={{ width: 16, height: 12, objectFit: 'cover', borderRadius: 2 }} /> : <Flag size={14} color="#a855f7" />} {t('country', 'Country')}: {t(otherProfile.country.toLowerCase().replace(/\s+/g, ''), otherProfile.country)}
                          </div>
                        )}
                        <button onClick={() => {
                          setShowOptionsDropdown(false);
                          setShowShareModal(true);
                          setShowRecentChats(false);
                          setShowNotifications(false);
                          setShowSearch(false);
                        }} className="options-dropdown-btn" style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: isLight ? '#1e293b' : '#fff', padding: '10px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <Share2 size={14} /> {t('shareProfileUrl', 'Share Profile URL')}
                        </button>
                        <button onClick={async () => {
                          const r = await fetch(`${API}/api/block/${otherProfile.username}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
                          if (r.ok) {
                            toast.success(t('blockUserSuccess', 'You have blocked {{username}}', { username: otherProfile.username }));
                            // Update local storage so widgets reflect immediately
                            try {
                              const myU = localStorage.getItem('watch_username');
                              const localBlocks = JSON.parse(localStorage.getItem(`blocked_chats_${myU}`) || '[]');
                              if (!localBlocks.includes(otherProfile.username)) {
                                localBlocks.push(otherProfile.username);
                                localStorage.setItem(`blocked_chats_${myU}`, JSON.stringify(localBlocks));
                                window.dispatchEvent(new Event('blocked_chats_updated'));
                              }
                            } catch (e) {}
                            setShowOptionsDropdown(false);
                            fetchOtherProfile();
                          }
                        }} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#ef4444', padding: '10px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <Ban size={14} /> {t('blockUser', 'Block User')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info block */}
                <div style={{ marginBottom: 20 }}>
                  <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: isLight ? '#1e293b' : '#fff' }}>{otherProfile.displayName || otherProfile.username}</h2>
                  <div style={{ color: '#6b7280', fontSize: 14, marginBottom: 12 }}>@{otherProfile.username}</div>
                  {otherProfile.bio && <p className="profile-bio-text" style={{ color: '#ccc', fontSize: 14, lineHeight: 1.6, margin: '0' }}>{otherProfile.bio}</p>}
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '20px 0' }} />

                {/* Action Buttons under divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button className={!followStatus ? "stay-white" : ""} onClick={handleFollow} disabled={followLoading}
                    style={{ flex: 1, minWidth: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 12, border: followStatus ? '1px solid rgba(255,255,255,0.15)' : 'none', background: followBtnColor, color: followBtnTextColor, fontWeight: 700, fontSize: 14, cursor: followLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: followLoading ? 0.7 : 1 }}>
                    {followBtnIcon} {followLoading ? '...' : followBtnLabel}
                  </button>
                  {(() => {
                    // Mutual follow = I am following them (accepted) AND they are following me back (accepted)
                    const iMutuallyFollow = followStatus === 'accepted' && otherProfile.isFollowingMe;
                    return (
                      <button
                        title={iMutuallyFollow ? t('sendMessageToUser', { username: otherProfile.displayName || otherProfile.username, defaultValue: `Send a message to ${otherProfile.displayName || otherProfile.username}` }) : t('mutualFollowOnlyMsg', 'You can only message users you mutually follow')}
                        onClick={() => {
                          if (!iMutuallyFollow) {
                            if (!otherProfile.isFollowingMe && followStatus !== 'accepted') {
                              toast.error(t('needToFollowEachOther', 'You need to follow each other to send messages'), { icon: '🔒' });
                            } else if (!otherProfile.isFollowingMe) {
                              toast.error(t('userNotFollowingBack', { username: otherProfile.displayName || otherProfile.username, defaultValue: `${otherProfile.displayName || otherProfile.username} is not following you back yet` }), { icon: '🔒' });
                            } else {
                              toast.error(t('youAreNotFollowingUser', { username: otherProfile.displayName || otherProfile.username, defaultValue: `You are not following ${otherProfile.displayName || otherProfile.username} yet` }), { icon: '🔒' });
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
                        {t('message', 'Message')}
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
                      <Mail size={16} /> {t('email', 'Email')}
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
            <div style={{ padding: '40px 20px' }}>
              {/* Skeleton loader — shows instantly while fresh data loads */}
              <style>{`
                @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
                .sk { border-radius: 8px; animation: shimmer 1.4s ease infinite; background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 75%); background-size: 600px 100%; }
                html[data-theme='light'] .sk { background: linear-gradient(90deg, #e8eaed 25%, #f4f5f7 50%, #e8eaed 75%); background-size: 600px 100%; }
              `}</style>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 28 }}>
                <div className="sk" style={{ width: 100, height: 100, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="sk" style={{ height: 24, width: '55%', marginBottom: 10 }} />
                  <div className="sk" style={{ height: 14, width: '30%', marginBottom: 10 }} />
                  <div className="sk" style={{ height: 14, width: '80%' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                <div className="sk" style={{ height: 40, flex: 1, borderRadius: 12 }} />
                <div className="sk" style={{ height: 40, flex: 1, borderRadius: 12 }} />
              </div>
              <div className="sk" style={{ height: 14, width: '90%', marginBottom: 10 }} />
              <div className="sk" style={{ height: 14, width: '70%', marginBottom: 10 }} />
              <div className="sk" style={{ height: 14, width: '80%' }} />
            </div>
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
                    <div style={{ fontSize: 10, color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 3 }}>{t('followersLabel', 'followers')}</div>
                  </button>
                  <button onClick={() => openFollowModal('following', profile.username)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{profile.followingCount ?? 0}</div>
                    <div style={{ fontSize: 10, color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 3 }}>{t('followingLabel', 'following')}</div>
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
                      <button className="profile-save-box" onClick={handleSaveProfile} title={t('saveChanges', 'Save Changes')}><Check size={18} /></button>
                      <button className="profile-cancel-btn" onClick={() => { setEditingName(false); setDisplayName(profile.displayName || profile.username); }} title={t('cancelBtn', 'Cancel')}><X size={18} /></button>
                    </div>
                  ) : (
                    <button className="profile-edit-btn" onClick={() => setEditingName(true)}>
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
              <h3><Edit2 size={18} color="#a855f7" /> {t('bioTab', 'Bio')}</h3>
              <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'bio' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {openSection === 'bio' && (
              <div className="acc-body">
                <div className="field-label">{t('tellOthersAboutYourself', 'Tell others about yourself')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <textarea className="profile-input" value={bio} onChange={e => { if (e.target.value.length <= 180) setBio(e.target.value); }} disabled={!editingBio}
                    placeholder={t('writeAShortBioPlaceholder', 'Write a short bio...')}
                    maxLength={180}
                    rows={4}
                    style={{ resize: 'none', height: '110px', overflowY: 'auto', fontFamily: 'inherit', lineHeight: 1.6 }} />
                  <div style={{ textAlign: 'right', fontSize: 12, color: bio.length >= 170 ? '#ef4444' : bio.length >= 140 ? '#f59e0b' : '#555', fontWeight: 500, marginTop: -4 }}>
                    {t('charactersRemaining', '{{count}} / 180 characters remaining', { count: 180 - bio.length })}
                  </div>
                  {editingBio ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="profile-save-box" onClick={handleSaveProfile} title={t('saveChanges', 'Save Changes')}><Check size={18} /></button>
                      <button className="profile-cancel-btn" onClick={() => { setEditingBio(false); setBio(profile.bio || ''); }} title={t('cancelBtn', 'Cancel')}><X size={18} /></button>
                    </div>
                  ) : (
                    <button className="profile-edit-btn" onClick={() => setEditingBio(true)} style={{ alignSelf: 'flex-start' }}>
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
                <input className="profile-input" value={profile.email || ''} disabled style={{ opacity: 0.6 }} onClick={() => alert(`Email: ${profile.email}`)} />
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
                            
                            // Update local storage so widgets reflect immediately
                            try {
                              const localBlocks = JSON.parse(localStorage.getItem(`blocked_chats_${profile.username}`) || '[]');
                              const nextBlocks = localBlocks.filter(k => k !== u.username);
                              localStorage.setItem(`blocked_chats_${profile.username}`, JSON.stringify(nextBlocks));
                              window.dispatchEvent(new Event('blocked_chats_updated'));
                            } catch (e) {}

                            fetchBlockedUsers();
                            if (isOwnProfile) fetchProfile(); // Update follower/following counts if changed
                          } else {
                            toast.error('Failed to unblock');
                          }
                        }} style={{ padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                           onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                           onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}>
                          {t('unblock', 'Unblock')}
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
                <div className="field-label" style={{ color: '#ef4444' }}>{t('dangerZone', 'Danger Zone')}</div>
                <p className="danger-desc" style={{ color: '#aaa', fontSize: 13, marginBottom: 16 }}>{t('deleteDesc', 'Once you delete your account, there is no going back. Please be certain.')}</p>
                <button className="delete-btn" onClick={() => { setShowDeleteModal(true); setDeleteChecked(false); setShowDeleteError(false); }}>
                  {t('deleteMyAccount', 'Delete My Account')}
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
            <h3 style={{ color: '#ef4444', fontSize: 20, fontWeight: 700, margin: '0 0 12px' }}>{t('deleteAccountConfirmTitle', 'Delete Account')}</h3>
            <p style={{ color: '#bbb', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>{t('deleteAccountConfirmDesc', 'Are you absolutely sure? Everything will be permanently deleted.')}</p>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={deleteChecked} onChange={e => { setDeleteChecked(e.target.checked); if (e.target.checked) setShowDeleteError(false); }} style={{ marginTop: 2 }} />
              <span style={{ color: '#fff', fontSize: 14 }}>{t('deleteAccountCheckboxLabel', 'I understand that my account and all associated data will be permanently deleted.')}</span>
            </label>
            {showDeleteError && !deleteChecked && (
              <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16, paddingLeft: 28 }}>⚠️ {t('deleteAccountError', 'Please select this checkbox to proceed')}</div>
            )}
            {!showDeleteError && <div style={{ height: 16 }} />}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteModal(false)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>{t('cancelBtn', 'Cancel')}</button>
              <button onClick={handleDeleteAccount} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>{t('deletePermanentlyBtn', 'Delete Permanently')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Crop Modal */}
      {showCropModal && (
        <div className="crop-modal-overlay">
          <div className="crop-modal-content">
            <h3 className="crop-title" style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Crop your photo</h3>
            <div style={{ position: 'relative', width: 240, height: 240, margin: '0 auto', borderRadius: '50%', overflow: 'hidden', cursor: 'grab', background: '#000' }}
              onMouseDown={handleCropMouseDown} onMouseMove={handleCropMouseMove} onMouseUp={handleCropMouseUp} onMouseLeave={handleCropMouseUp}>
              <canvas ref={cropCanvasRef} width={240} height={240} style={{ width: '100%', height: '100%' }} />
            </div>
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
              <span className="crop-zoom-label" style={{ fontSize: 12, color: '#888' }}>Zoom</span>
              <input type="range" min="0.5" max="3" step="0.05" value={cropZoom} onChange={e => setCropZoom(parseFloat(e.target.value))} style={{ flex: 1, maxWidth: 180, accentColor: '#6366f1' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
              <button className="crop-btn" onClick={() => fileInputRef.current.click()}>Reselect</button>
              <button className="crop-btn" onClick={() => setShowCropModal(false)}>Cancel</button>
              <button className="save-btn" onClick={handleCropConfirm}><Check size={16} style={{ marginRight: 4 }} /> Save</button>
            </div>
          </div>
        </div>
      )}
      {/* Share Modal */}
      {showShareModal && (
        <div className="share-modal-overlay" onClick={() => setShowShareModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: isLight ? 'rgba(15, 23, 42, 0.4)' : 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
            <button className="share-modal-close" onClick={() => setShowShareModal(false)} style={{ position: 'absolute', top: -2, right: -64, width: 44, height: 44, borderRadius: '50%', background: isLight ? '#fff' : '#2a2a3e', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', color: isLight ? '#1e293b' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.05)' : '0 4px 12px rgba(0,0,0,0.5)', transition: 'background 0.2s, transform 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = isLight ? '#f8fafc' : '#3a3a4e'; e.currentTarget.style.transform='scale(1.05)' }} onMouseLeave={e => { e.currentTarget.style.background = isLight ? '#fff' : '#2a2a3e'; e.currentTarget.style.transform='scale(1)' }}>
              <X size={20} />
            </button>
            <div className="share-modal-content" onClick={(e) => e.stopPropagation()} style={{ background: isLight ? '#fff' : '#141420', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', padding: 32, borderRadius: 24, width: '90vw', maxWidth: 480, animation: 'slideUp 0.3s ease-out', boxShadow: isLight ? '0 32px 80px rgba(0,0,0,0.15)' : '0 40px 100px rgba(0,0,0,0.9)' }}>
              <h3 className="share-modal-title" style={{ margin: '0 0 24px', color: isLight ? '#1e293b' : '#fff', fontSize: 20, fontWeight: 800, textAlign: 'center' }}>Share Profile</h3>
              
              <div className="share-modal-url-row" style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.05)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <span className="share-modal-url-display" style={{ flex: 1, fontSize: 13, color: isLight ? '#475569' : '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                  {`${window.location.origin}/profile/${otherProfile?.username}`}
                </span>
                <button className="share-modal-copy-btn" onClick={copyProfileLink} style={{ background: copied ? '#10b981' : 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', borderRadius: 8, padding: '6px 14px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '20px 8px', justifyContent: 'center' }}>
                {[
                  { label: 'WhatsApp', color: '#25D366', icon: <FaWhatsapp size={22} />, url: `https://api.whatsapp.com/send?text=${window.location.origin}/profile/${otherProfile?.username}` },
                  { label: 'Telegram', color: '#0088cc', icon: <FaTelegramPlane size={22} style={{ marginRight: 2 }} />, url: `https://t.me/share/url?url=${window.location.origin}/profile/${otherProfile?.username}` },
                  { label: 'Instagram', color: '#E1306C', icon: <FaInstagram size={22} />, url: 'https://instagram.com/' },
                  { label: 'Snapchat', color: '#eab308', icon: <FaSnapchatGhost size={22} />, url: 'https://snapchat.com/' },
                  { label: 'X', color: isLight ? '#000' : '#e5e5e5', icon: <FaXTwitter size={20} />, url: `https://twitter.com/intent/tweet?url=${window.location.origin}/profile/${otherProfile?.username}` },
                  { label: 'Email', color: '#EA4335', icon: <SiGmail size={20} />, url: `mailto:?body=${window.location.origin}/profile/${otherProfile?.username}` },
                  { label: 'Discord', color: '#5865F2', icon: <FaDiscord size={22} />, url: `https://discord.com/channels/@me` },
                  { label: 'Reddit', color: '#FF4500', icon: <FaRedditAlien size={22} />, url: `https://reddit.com/submit?url=${window.location.origin}/profile/${otherProfile?.username}` },
                  { label: 'Facebook', color: '#1877F2', icon: <FaFacebookF size={22} />, url: `https://www.facebook.com/sharer/sharer.php?u=${window.location.origin}/profile/${otherProfile?.username}` },
                  { label: 'LinkedIn', color: '#0A66C2', icon: <FaLinkedin size={22} />, url: `https://www.linkedin.com/shareArticle?mini=true&url=${window.location.origin}/profile/${otherProfile?.username}` },
                  { label: 'Pinterest', color: '#E60023', icon: <FaPinterestP size={22} />, url: `https://pinterest.com/pin/create/button/?url=${window.location.origin}/profile/${otherProfile?.username}` },
                  { label: 'Twitch', color: '#9146FF', icon: <FaTwitch size={22} />, url: 'https://twitch.tv/' }
                ].map(s => (
                  <button key={s.label} onClick={() => window.open(s.url, '_blank')} style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', transition: 'transform 0.2s', width: 64 }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                      {s.icon}
                    </div>
                    <span style={{ fontSize: 11, color: isLight ? '#64748b' : '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Followers / Following Modal ── */}
      {showFollowModal && (
        <div className="follow-modal-overlay" onClick={() => setShowFollowModal(false)}>
          {/* X button outside the box */}
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button className="follow-modal-close" onClick={() => setShowFollowModal(false)}>
              <X size={16} />
            </button>
            <div className="follow-modal-content">
              {/* Tab header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '18px 24px 0' }}>
                <button className={`follow-tab-btn ${followModalTab === 'followers' ? 'active' : ''}`} onClick={() => setFollowModalTab('followers')}>
                  {t('followersTabTitle', 'Followers')}
                </button>
                <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', marginBottom: 14, flexShrink: 0 }} />
                <button className={`follow-tab-btn ${followModalTab === 'following' ? 'active' : ''}`} onClick={() => setFollowModalTab('following')}>
                  {t('followingTabTitle', 'Following')}
                </button>
              </div>
              {/* User list */}
              <div style={{ overflowY: 'auto', padding: '8px 6px 16px', flex: 1 }}>
                {followListLoading ? (
                  <div style={{ textAlign: 'center', color: '#555', padding: 40, fontSize: 14 }}>{t('loading', 'Loading...')}</div>
                ) : (followListData[followModalTab] || []).length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#444', padding: 48, fontSize: 14 }}>
                    {followModalTab === 'followers' ? t('noFollowersYet', 'No followers yet') : t('notFollowingAnyoneYet', 'Not following anyone yet')}
                  </div>
                ) : (
                  (followListData[followModalTab] || []).map(u => (
                    <div key={u.username} className="follow-user-item" onClick={() => { setShowFollowModal(false); navigate(`/profile/${u.username}`); }}>
                      <div style={{ width: 42, height: 42, borderRadius: '50%', border: '2px solid rgba(99,102,241,0.3)', overflow: 'hidden', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {u.avatarPath ? <img src={`${API}${u.avatarPath}`} alt={u.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={18} color="#6366f1" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="follow-user-name">{u.displayName || u.username}</div>
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





