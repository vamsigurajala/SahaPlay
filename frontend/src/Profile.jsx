import React, { useState, useEffect, useRef, useCallback } from 'react';
import { clearUserSession } from './lib/authUtils.js';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Play, ArrowLeft, Camera, Check, X, Eye, EyeOff, Shield, User as UserIcon, Mail, Lock, Edit2, ChevronDown, Trash2, Settings, LogOut, HelpCircle, Search, MessageSquare, AlertCircle, UserPlus, UserCheck, UserX, Users, Bell, MoreVertical, Flag, Share2, Ban, Sparkles, AtSign, Upload, Download } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { FaLinkedin, FaTelegramPlane, FaWhatsapp, FaInstagram, FaSnapchatGhost, FaRedditAlien, FaDiscord, FaFacebookF, FaPinterestP, FaTwitch } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { SiGmail } from 'react-icons/si';
import GlobalChatWidget from './components/GlobalChatWidget';
import SupportModal from './components/SupportModal';
import DownloadAppModal from './components/DownloadAppModal';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from './utils/CropImage';
import { getFlagUrl, getFlagUrlFromName } from './utils/countryFlags.js';
import { getAvatarUrl } from './utils/avatarUtils';
import { API } from './lib/api';
import { useBackIntercept } from './hooks/useBackIntercept';
import { getPersistedGcwOpen } from './utils/gcwPersist';
import { isTauriApp, isStandalonePWA } from './lib/platform';
import { useCrypto } from './contexts/CryptoContext';

// Minimum time the skeleton loader stays visible on first load, so the shimmer wave
// has time to actually be perceived instead of flashing by on fast (local) connections.
const MIN_SKELETON_MS = 500;

const Profile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { username: viewingUsername } = useParams(); // if set, we're viewing another user
  const { t, i18n } = useTranslation();
  const { clearKeys } = useCrypto();
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showDownloadAppModal, setShowDownloadAppModal] = useState(false);
  const isDesktopApp = isTauriApp();
  const standalone = isStandalonePWA();
  const getLocalizedCountryName = (code, name) => {
    if (!code) return name;
    try {
      const displayNames = new Intl.DisplayNames([i18n.language || 'en'], { type: 'region' });
      return displayNames.of(code.toUpperCase()) || name;
    } catch (e) {
      return name;
    }
  };
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const token = localStorage.getItem('watch_token');
  const myUsername = localStorage.getItem('watch_username');
  const isGuest = !token || token === 'null' || token === 'undefined' || localStorage.getItem('watch_is_guest') === 'true';
  const isOwnProfile = !viewingUsername || viewingUsername.toLowerCase() === myUsername?.toLowerCase();

  const handleLogout = () => {
    clearUserSession();
    clearKeys();
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

  useEffect(() => {
    const sec = location.state?.openSection;
    if (sec) {
      setOpenSection(sec);
      setTimeout(() => {
        const el = document.getElementById(`${sec.replace(/([A-Z])/g, '-$1').toLowerCase()}-section`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [location.state]);

  // Own profile state
  const [profile, setProfile] = useState(() => {
    const isG = !token || token === 'null' || token === 'undefined' || localStorage.getItem('watch_is_guest') === 'true';
    if (isG) {
      return {
        id: 0,
        username: localStorage.getItem('watch_username') || 'guest',
        displayName: 'Guest User',
        avatarPath: null,
        bio: 'Viewing via Cast',
        followersCount: 0,
        followingCount: 0,
        isGuest: true
      };
    }
    return null;
  });
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState(localStorage.getItem('watch_username') || '');
  const [usernameStatus, setUsernameStatus] = useState(null); // null|'checking'|'available'|'taken'|'invalid'|'self'
  const [savingUsername, setSavingUsername] = useState(false);
  const editingUsernameOriginal = useRef(''); // snapshot of username at edit-start, never changes during a session
  const editingUsernameId = useRef(null);
  // First load of profile/otherProfile is gated to a minimum visible duration so the skeleton's
  // shimmer wave actually has time to be seen on fast (local) connections instead of flashing by.
  const hasLoadedProfileOnce = useRef(false);
  const hasLoadedOtherProfileOnce = useRef(false);
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

  // viewingUsername changes via client-side navigation (search results, chat
  // avatars, etc.) without remounting this component, so state from the
  // previous profile — most importantly a stale userNotFound=true — must be
  // reset here or every subsequent profile visit in the session keeps
  // showing "user not found" even for real users.
  useEffect(() => {
    setUserNotFound(false);
    if (!viewingUsername) { setOtherProfile(null); return; }
    try {
      const cached = localStorage.getItem(`profile_cache_${viewingUsername.toLowerCase()}`);
      setOtherProfile(cached ? JSON.parse(cached) : null);
    } catch { setOtherProfile(null); }
  }, [viewingUsername]);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteChecked, setDeleteChecked] = useState(false);
  const [showDeleteError, setShowDeleteError] = useState(false);

  // Navbar state
  const [watchRole, setWatchRole] = useState(localStorage.getItem('watch_role') || 'user');
  const isAdminRole = ['super_admin', 'admin', 'moderator', 'support'].includes(watchRole);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showRecentChats, setShowRecentChats] = useState(getPersistedGcwOpen);
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

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isGuest) return;
    fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.role) { localStorage.setItem('watch_role', d.role); setWatchRole(d.role); } })
      .catch(() => {});
  }, []);

  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showReportUserModal, setShowReportUserModal] = useState(false);
  const [showBlockConfirmModal, setShowBlockConfirmModal] = useState(false);
  const [blockingUsername, setBlockingUsername] = useState('');
  const [isBlockingInProgress, setIsBlockingInProgress] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDescription, setReportDescription] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportDropdownOpen, setReportDropdownOpen] = useState(false);
  const reportDropdownRef = useRef(null);

  const [reportImages, setReportImages] = useState([]);
  const [reportImgErr, setReportImgErr] = useState('');
  const [draggingReport, setDraggingReport] = useState(false);
  const dragReportCount = useRef(0);
  const reportFileInputRef = useRef(null);

  const processReportFiles = useCallback((files) => {
    setReportImgErr('');
    const MAX_IMAGES = 5;
    const MAX_BYTES = 5 * 1024 * 1024;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    const slots = MAX_IMAGES - reportImages.length;
    if (slots <= 0) {
      setReportImgErr(`Maximum ${MAX_IMAGES} images allowed.`);
      return;
    }
    const toAdd = [];
    let errMsg = '';
    for (const f of Array.from(files).slice(0, slots)) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        errMsg = 'Only JPG, PNG, GIF, WEBP images allowed.';
        continue;
      }
      if (f.size > MAX_BYTES) {
        errMsg = `"${f.name}" exceeds 5 MB limit.`;
        continue;
      }
      toAdd.push({
        file: f,
        preview: URL.createObjectURL(f),
        name: f.name,
        type: f.type
      });
    }
    if (errMsg) setReportImgErr(errMsg);
    if (toAdd.length) setReportImages(prev => [...prev, ...toAdd]);
  }, [reportImages.length]);

  const removeReportImg = (i) => {
    setReportImages(prev => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, j) => j !== i);
    });
    setReportImgErr('');
  };

  // Fetch flag from restcountries if otherProfile has a country
  const handleBlockConfirmed = async () => {
    if (!blockingUsername || isBlockingInProgress) return;
    setIsBlockingInProgress(true);
    try {
      const r = await fetch(`${API}/api/block/${blockingUsername}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      if (r.ok) {
        toast.success(t('blockUserSuccess', 'You have blocked {{username}}', { username: blockingUsername }));
        try {
          const myU = localStorage.getItem('watch_username');
          const localBlocks = JSON.parse(localStorage.getItem(`blocked_chats_${myU}`) || '[]');
          if (!localBlocks.includes(blockingUsername)) {
            localBlocks.push(blockingUsername);
            localStorage.setItem(`blocked_chats_${myU}`, JSON.stringify(localBlocks));
            window.dispatchEvent(new Event('blocked_chats_updated'));
          }
        } catch (e) {}
        setShowBlockConfirmModal(false);
        setShowOptionsDropdown(false);
        fetchOtherProfile();
      }
    } finally {
      setIsBlockingInProgress(false);
    }
  };


  // Followers / Following modal
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [followModalTab, setFollowModalTab] = useState('followers'); // 'followers' | 'following'
  const [followListData, setFollowListData] = useState({ followers: [], following: [] });
  const [followListLoading, setFollowListLoading] = useState(false);
  const [followCache, setFollowCache] = useState({});

  useEffect(() => {
    const target = isOwnProfile ? myUsername : viewingUsername;
    if (target && !isGuest && token) {
      fetch(`${API}/api/follow/${target}/list`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          const newData = { followers: data.followers || [], following: data.following || [] };
          setFollowListData(newData);
          setFollowCache(prev => ({ ...prev, [target]: newData }));
        }).catch(() => {});
    }
  }, [isOwnProfile, myUsername, viewingUsername, token, isGuest]);

  const openFollowModal = useCallback((tab, targetUsername) => {
    setFollowModalTab(tab);
    setShowFollowModal(true);
    
    if (followCache[targetUsername]) {
      setFollowListData(followCache[targetUsername]);
      setFollowListLoading(false);
    } else {
      setFollowListLoading(true);
    }
    
    const headers = (!isGuest && token) ? { 'Authorization': `Bearer ${token}` } : {};
    fetch(`${API}/api/follow/${targetUsername}/list`, { headers })
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
  }, [token, isGuest, followCache]);

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
        setShowUserMenu(false);
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

  // Image crop state — react-easy-crop handles the actual pointer/touch
  // panning and pinch-zoom itself (the previous hand-rolled canvas version
  // only wired mouse events, so touch dragging fell through to the page's
  // native scroll instead of panning the image, and drew the source image
  // at 1:1 pixel scale onto a 240px canvas with no "fit" step, so anything
  // larger than that — i.e. basically every phone photo — opened already
  // zoomed into a tiny center crop).
  const [selectedImage, setSelectedImage] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const onCropComplete = useCallback((_croppedArea, pixels) => setCroppedAreaPixels(pixels), []);

  // Lock body scroll when modals are open
  useEffect(() => {
    if (showFollowModal || showCropModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showFollowModal, showCropModal]);

  // Mobile/iPad swipe-back should close these modals instead of navigating away.
  useBackIntercept((showFollowModal || showCropModal) ? 1 : 0, (newLevel) => {
    if (newLevel === 0) { setShowFollowModal(false); setShowCropModal(false); }
  });

  const fetchProfile = useCallback(() => {
    if (isGuest || !token) return;
    const isInitialLoad = !hasLoadedProfileOnce.current;
    const startedAt = Date.now();
    fetch(`${API}/api/profile`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const apply = () => {
          hasLoadedProfileOnce.current = true;
          setProfile(data);
          setDisplayName(prev => (prev && prev !== data.displayName && prev !== data.username) ? prev : (data.displayName || data.username || ''));
          setBio(prev => (prev && prev !== data.bio) ? prev : (data.bio || ''));
        };
        const remaining = isInitialLoad ? MIN_SKELETON_MS - (Date.now() - startedAt) : 0;
        if (remaining > 0) setTimeout(apply, remaining);
        else apply();
      })
      .catch(() => {});
  }, [token, isGuest]);
  
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
    const isInitialLoad = !hasLoadedOtherProfileOnce.current;
    const startedAt = Date.now();
    const headers = (!isGuest && token) ? { 'Authorization': `Bearer ${token}` } : {};
    fetch(`${API}/api/users/${viewingUsername}`, { headers })
      .then(r => {
        if (r.status === 404) { setUserNotFound(true); return null; }
        if (!r.ok) return null;
        return r.json();
      })
      .then(data => {
        if (!data) return;
        if (data.error) { setUserNotFound(true); return; }
        const apply = () => {
          hasLoadedOtherProfileOnce.current = true;
          setOtherProfile(data);
          try { localStorage.setItem(`profile_cache_${viewingUsername.toLowerCase()}`, JSON.stringify(data)); } catch {}
        };
        const remaining = isInitialLoad ? MIN_SKELETON_MS - (Date.now() - startedAt) : 0;
        if (remaining > 0) setTimeout(apply, remaining);
        else apply();
      })
      .catch(() => {});
  }, [viewingUsername, token]);

  const requireLogin = () => {
    toast.error(t('loginRequired', 'Please login to continue'));
    navigate('/login');
  };

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
    const handleBlockedUpdate = () => {
      if (openSection === 'blockedUsers') {
        fetchBlockedUsers();
      }
    };
    window.addEventListener('blocked_chats_updated', handleBlockedUpdate);
    return () => {
      window.removeEventListener('blocked_chats_updated', handleBlockedUpdate);
    };
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

  // Sync usernameInput from profile only when not actively editing
  useEffect(() => {
    if (!editingUsername && profile?.username) {
      setUsernameInput(profile.username);
    }
  }, [profile?.username, editingUsername]);

  // Debounced username availability check — only depends on input/editingUsername, NOT profile
  // (profile polls every 3s; including it would reset status to 'checking' on every poll tick)
  useEffect(() => {
    if (!editingUsername) return;
    if (!usernameInput || usernameInput.trim() === editingUsernameOriginal.current) {
      setUsernameStatus('self');
      return;
    }
    const cleaned = usernameInput.trim();
    if (cleaned.length < 3) { setUsernameStatus('too_short'); return; }
    if (cleaned.length > 30) { setUsernameStatus('too_long'); return; }
    if (!/^[a-zA-Z0-9._]+$/.test(cleaned)) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    const timer = setTimeout(() => {
      fetch(`${API}/api/profile/check-username?username=${encodeURIComponent(cleaned)}&excludeId=${editingUsernameId.current || ''}`)
        .then(r => r.json())
        .then(d => setUsernameStatus(d.available ? 'available' : 'taken'))
        .catch(() => setUsernameStatus(null));
    }, 500);
    return () => clearTimeout(timer);
  }, [usernameInput, editingUsername]);

  const handleSaveUsername = async () => {
    const cleaned = usernameInput.trim();
    if (!cleaned || usernameStatus !== 'available') return;
    setSavingUsername(true);
    try {
      const r = await fetch(`${API}/api/profile/username`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ username: cleaned })
      });
      const data = await r.json();
      if (!r.ok) { toast.error(data.error || 'Failed to update username'); return; }
      localStorage.setItem('watch_username', cleaned);
      if (data.token) localStorage.setItem('watch_token', data.token);
      setEditingUsername(false);
      setUsernameStatus(null);
      toast.success('Username updated!');
      fetchProfile();
    } catch {
      toast.error('Failed to update username');
    } finally {
      setSavingUsername(false);
    }
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
    if (isGuest) { requireLogin(); return; }
    if (!otherProfile) return;
    const currentStatus = otherProfile.followStatus;

    // Optimistic UI updates
    if (currentStatus === null) {
      setOtherProfile(p => p ? { ...p, followStatus: 'pending' } : p);
    } else {
      setOtherProfile(p => p ? {
        ...p,
        followStatus: null,
        followersCount: currentStatus === 'accepted' ? Math.max(0, (p.followersCount || 0) - 1) : p.followersCount
      } : p);
    }

    try {
      if (currentStatus === null) {
        // Send follow request
        const r = await fetch(`${API}/api/follow/${otherProfile.username}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        const d = await r.json();
        if (d.error) {
          toast.error(d.error);
          // Rollback
          setOtherProfile(p => p ? { ...p, followStatus: null } : p);
        } else {
          toast.success('Follow request sent!');
          window.dispatchEvent(new Event('follow_status_updated'));
          fetchOtherProfile();
        }
      } else {
        // Unfollow / cancel request
        const r = await fetch(`${API}/api/follow/${otherProfile.username}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        const d = await r.json();
        if (d.error) {
          toast.error(d.error);
          // Rollback
          setOtherProfile(p => p ? {
            ...p,
            followStatus: currentStatus,
            followersCount: currentStatus === 'accepted' ? (p.followersCount || 0) + 1 : p.followersCount
          } : p);
        } else {
          toast.success(currentStatus === 'pending' ? 'Request cancelled' : 'Unfollowed');
          window.dispatchEvent(new Event('follow_status_updated'));
          fetchOtherProfile();
        }
      }
    } catch {
      toast.error('Network error');
      // Rollback
      setOtherProfile(p => p ? {
        ...p,
        followStatus: currentStatus,
        followersCount: currentStatus === 'accepted' ? (p.followersCount || 0) + 1 : p.followersCount
      } : p);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setSelectedImage(ev.target.result); setCrop({ x: 0, y: 0 }); setCropZoom(1); setCroppedAreaPixels(null); setShowCropModal(true); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropConfirm = async () => {
    if (!croppedAreaPixels) return;
    try {
      const blob = await getCroppedImg(selectedImage, croppedAreaPixels);
      setShowCropModal(false);
      const formData = new FormData();
      formData.append('avatar', blob, 'avatar.png');
      const res = await fetch(`${API}/api/profile/avatar`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (data.error) return toast.error(data.error);
      toast.success('Avatar updated!');
      // So the bottom nav's avatar icon (and anywhere else showing it) updates
      // immediately instead of waiting for a full page reload.
      window.dispatchEvent(new Event('avatar_updated'));
      fetchProfile();
    } catch (err) {
      toast.error('Upload failed');
    }
  };

  if (!profile) {
    return (
      <div style={{ minHeight: '100vh', background: isLight ? '#f7fafc' : '#0a0a0f', color: isLight ? '#111' : '#fff' }}>
        <style>{`
          @keyframes shimmer {
            0% { background-position: -450px 0; }
            100% { background-position: 450px 0; }
          }
          .sk-shim {
            background: ${isLight ? 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)' : 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)'} !important;
            background-size: 900px 100% !important;
            animation: shimmer 1.6s infinite linear !important;
            border-radius: 12px;
          }
          .sk-circle {
            border-radius: 50% !important;
          }
        `}</style>

        {/* Skeleton Navbar */}
        <nav style={{ padding: isMobile ? '12px 16px' : '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.05)', background: isLight ? '#fff' : 'transparent' }}>
          <div style={{ flex: 1, display: 'flex' }}>
            <div className="sk-shim" style={{ width: isMobile ? 38 : 100, height: 38, borderRadius: isMobile ? '50%' : 16 }} />
          </div>
          <div style={{ flex: 1 }}></div>
          <div style={{ flex: 2, display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <div className="sk-shim sk-circle" style={{ width: 34, height: 34 }} />
            <div className="sk-shim sk-circle" style={{ width: 34, height: 34 }} />
            <div className="sk-shim sk-circle" style={{ width: 34, height: 34 }} />
          </div>
        </nav>

        {/* Skeleton Content */}
        <div style={{ maxWidth: isOwnProfile ? '620px' : '800px', margin: '40px auto 80px', padding: '0 20px' }}>
          {isOwnProfile ? (
            <div>
              {/* Account Settings Title */}
              <div className="sk-shim" style={{ height: 38, width: 250, marginBottom: 40 }} />

              {/* Avatar + name header with stats skeleton */}
              <div style={{ 
                display: 'flex', 
                flexDirection: isMobile ? 'column' : 'row', 
                alignItems: isMobile ? 'flex-start' : 'center', 
                gap: 24, 
                marginBottom: 32, 
                borderBottom: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)', 
                paddingBottom: 24 
              }}>
                <div className="sk-shim sk-circle" style={{ width: 84, height: 84, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
                  <div className="sk-shim" style={{ height: 22, width: 180, marginBottom: 8 }} />
                  <div className="sk-shim" style={{ height: 14, width: 100, marginBottom: 12 }} />
                  
                  {/* Followers / Following counts skeleton */}
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div className="sk-shim" style={{ height: 18, width: 30 }} />
                      <div className="sk-shim" style={{ height: 10, width: 60 }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div className="sk-shim" style={{ height: 18, width: 30 }} />
                      <div className="sk-shim" style={{ height: 10, width: 60 }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bio Block Skeleton */}
              <div className="sk-shim" style={{ height: 16, width: '100%', marginBottom: 10 }} />
              <div className="sk-shim" style={{ height: 16, width: '90%', marginBottom: 28 }} />

              {/* Settings Group Cards (Accordions) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="sk-shim" style={{ height: 70, width: '100%', borderRadius: 20 }} />
                <div className="sk-shim" style={{ height: 70, width: '100%', borderRadius: 20 }} />
                <div className="sk-shim" style={{ height: 70, width: '100%', borderRadius: 20 }} />
              </div>
            </div>
          ) : (
            <div style={{ 
              background: isLight ? '#ffffff' : 'rgba(255,255,255,0.03)', 
              border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.07)', 
              borderRadius: 24, 
              padding: isMobile ? 20 : 32 
            }}>
              <div style={{ 
                display: 'flex', 
                flexDirection: isMobile ? 'column' : 'row', 
                alignItems: isMobile ? 'flex-start' : 'center', 
                gap: 32, 
                marginBottom: 24 
              }}>
                <div className="sk-shim sk-circle" style={{ width: 96, height: 96, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
                  <div className="sk-shim" style={{ height: 24, width: 220, marginBottom: 8 }} />
                  <div className="sk-shim" style={{ height: 14, width: 120, marginBottom: 16 }} />
                  
                  {/* Stats Box Skeleton */}
                  <div style={{ display: 'flex', gap: 32 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div className="sk-shim" style={{ height: 20, width: 40 }} />
                      <div className="sk-shim" style={{ height: 10, width: 70 }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div className="sk-shim" style={{ height: 20, width: 40 }} />
                      <div className="sk-shim" style={{ height: 10, width: 70 }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bio Block Skeleton */}
              <div className="sk-shim" style={{ height: 16, width: '100%', marginBottom: 10 }} />
              <div className="sk-shim" style={{ height: 16, width: '85%', marginBottom: 24 }} />

              {/* Buttons (Follow, Message etc) */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                <div className="sk-shim" style={{ height: 42, flex: 1, borderRadius: 12 }} />
                <div className="sk-shim" style={{ height: 42, flex: 1, borderRadius: 12 }} />
              </div>

              {/* Tabs / Content Cards Skeleton */}
              <div style={{ display: 'flex', gap: 20, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10, marginBottom: 20 }}>
                <div className="sk-shim" style={{ height: 20, width: 80 }} />
                <div className="sk-shim" style={{ height: 20, width: 80 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="sk-shim" style={{ height: 60, width: '100%' }} />
                <div className="sk-shim" style={{ height: 60, width: '100%' }} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  const avatarUrl = getAvatarUrl(profile.avatarPath);
  const displayProfile = isOwnProfile ? profile : otherProfile;

  // Follow button state
  const followStatus = otherProfile?.followStatus;
  const followBtnLabel = followStatus === 'accepted' ? t('followingStatus', 'Following') : followStatus === 'pending' ? t('requestSent', 'Requested') : t('follow', 'Follow');
  const followBtnIcon = followStatus === 'accepted' ? <UserCheck size={16} /> : followStatus === 'pending' ? <UserX size={16} /> : <UserPlus size={16} />;
  const followBtnColor = followStatus ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,var(--brand-1),var(--brand-2))';
  const followBtnTextColor = followStatus ? (isLight ? '#444' : '#aaa') : '#fff';

  const closeReportModal = () => {
    setShowReportUserModal(false);
    setReportDescription('');
    setReportDropdownOpen(false);
    reportImages.forEach(img => URL.revokeObjectURL(img.preview));
    setReportImages([]);
    setReportImgErr('');
  };

  return (
    <>
      <Toaster position="top-center" containerStyle={{ zIndex: 100001 }} />
    <div style={{ minHeight: '100vh', filter: showReportUserModal ? 'blur(7px) brightness(0.6)' : 'none', transition: 'filter 0.3s ease', pointerEvents: showReportUserModal ? 'none' : 'auto' }}>
      <style>{`
        .profile-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; padding: 24px 28px; margin-bottom: 24px; transition: all 0.2s; }
        .profile-card:hover { border-color: rgba(255,255,255,0.15); }
        .acc-header { display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; }
        .acc-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: #e2e8f0; display: flex; align-items: center; gap: 10px; }
        .acc-body { margin-top: 24px; animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .profile-input { width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #fff; font-size: 15px; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
        .profile-input:focus { border-color: rgba(var(--brand-1-rgb),0.5); }
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
        @media (max-width: 768px) {
          .back-btn span {
            display: none !important;
          }
          .back-btn {
            padding: 10px !important;
            border-radius: 50% !important;
          }
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
          background: rgba(var(--brand-1-rgb),0.12); 
          color: var(--brand-1-light); 
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
        @media (max-width: 768px) {
          .profile-pill span {
            display: none !important;
          }
          .profile-pill {
            padding: 8px !important;
            border-radius: 50% !important;
          }
        }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        .save-btn { background: linear-gradient(135deg, var(--brand-1), var(--brand-2)); border: none; color: #fff; padding: 10px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: transform 0.2s, opacity 0.2s; }
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
        html[data-theme='light'] .profile-card:hover { border-color: rgba(var(--brand-1-rgb),0.3) !important; }
        html[data-theme='light'] .acc-header h3 { color: #111 !important; }
        html[data-theme='light'] .field-label { color: #64748b !important; }
        html[data-theme='light'] .profile-input { background: #f8fafc !important; border-color: rgba(0,0,0,0.08) !important; color: #111 !important; }
        html[data-theme='light'] .profile-input:focus { border-color: var(--brand-1) !important; background: #fff !important; }

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
        .follow-tab-btn.active { color: #fff; border-bottom: 2px solid var(--brand-2); }
        .follow-user-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 12px; cursor: pointer; transition: background 0.15s; }
        .follow-user-item:hover { background: rgba(255,255,255,0.05); }
        .follow-user-name { color: #fff; font-weight: 700; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        html[data-theme='light'] .follow-modal-overlay { background: rgba(255,255,255,0.7) !important; }
        html[data-theme='light'] .follow-modal-content { background: #ffffff !important; border: 1px solid rgba(0,0,0,0.1) !important; box-shadow: 0 16px 40px rgba(0,0,0,0.1) !important; }
        html[data-theme='light'] .follow-modal-close { background: #f1f5f9 !important; border: 1px solid #e2e8f0 !important; color: #475569 !important; }
        html[data-theme='light'] .follow-modal-close:hover { background: #e2e8f0 !important; color: #0f172a !important; }
        html[data-theme='light'] .follow-tab-btn { color: #64748b !important; }
        html[data-theme='light'] .follow-tab-btn.active { color: #111 !important; border-bottom: 2px solid var(--brand-2) !important; }
        html[data-theme='light'] .follow-user-item:hover { background: rgba(0,0,0,0.05) !important; }
        html[data-theme='light'] .follow-user-name { color: #111 !important; }
        
        /* Edit & Action Buttons */
        .profile-edit-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 10px 18px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 700; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .profile-edit-btn svg { color: #fff; transition: color 0.25s; }
        .profile-edit-btn:hover { background: var(--brand-1) !important; border-color: var(--brand-1-dark) !important; color: #ffffff !important; box-shadow: 0 4px 12px rgba(var(--brand-1-rgb),0.3); }
        .profile-edit-btn:hover svg { color: #ffffff !important; }
        
        html[data-theme='light'] .profile-edit-btn { background: #f1f5f9; border-color: #e2e8f0; color: #000 !important; }
        html[data-theme='light'] .profile-edit-btn svg { color: #000 !important; }
        html[data-theme='light'] .profile-edit-btn:hover { background: var(--brand-1) !important; border-color: var(--brand-1-dark) !important; color: #ffffff !important; }
        html[data-theme='light'] .profile-edit-btn:hover svg { color: #ffffff !important; }
        
        .profile-save-box { width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: linear-gradient(135deg, var(--brand-1), var(--brand-2)); border: none; color: #ffffff !important; cursor: pointer; transition: all 0.2s; }
        .profile-save-box svg { color: #ffffff !important; }
        .profile-save-box:hover { box-shadow: 0 4px 12px rgba(var(--brand-1-rgb),0.3); }
        
        .profile-cancel-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #aaa; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
        .profile-cancel-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        
        html[data-theme='light'] .profile-cancel-btn { background: #ffffff !important; border: 1px solid rgba(0,0,0,0.12) !important; color: #64748b !important; }
        html[data-theme='light'] .profile-cancel-btn:hover { background: #f1f5f9 !important; color: #ef4444 !important; border-color: #ef4444 !important; }

        @media (max-width: 767px) {
          nav .nav-dropdown {
            position: fixed !important;
            top: 68px !important;
            left: 16px !important;
            right: 16px !important;
            width: auto !important;
          }
        }
      `}</style>

      {/* Navbar */}
      <nav style={{ padding: isMobile ? '12px 16px' : '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative', zIndex: 1000 }}>
        {/* Left: Back Button */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <button className="back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} />
            <span>{t('back', 'Back')}</span>
          </button>
        </div>

        {/* Center: Empty (identity moved to right) */}
        <div style={{ flex: 1 }}></div>

        {/* Right: Actions — hidden in standalone PWA mode, where all of these
            (search, chat, notifications, account menu) are redundant with
            the bottom nav / top-bar notifications icon already shown on the
            rest of the app shell. */}
        {!standalone && (
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
              <div className="nav-dropdown" style={{
                position: isMobile ? 'fixed' : 'absolute',
                top: isMobile ? '68px' : 'calc(100% + 12px)',
                left: isMobile ? '16px' : 'auto',
                right: isMobile ? '16px' : -60,
                width: isMobile ? 'auto' : 320,
                background: isLight ? '#ffffff' : '#111',
                border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                padding: 12,
                boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
                zIndex: 10000
              }}>
                <input 
                  autoFocus
                  placeholder="Search users..."
                  className="nav-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                    border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    color: isLight ? '#111' : '#fff',
                    fontSize: 13,
                    outline: 'none',
                    marginBottom: 8
                  }}
                />
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {searchResults.length > 0 ? (
                    searchResults.map(u => (
                      <div key={u.username} onClick={() => { setShowSearch(false); navigate(`/profile/${u.username}`); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s' }}
                           onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'}
                           onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {u.avatarPath ? <img src={getAvatarUrl(u.avatarPath)} loading="lazy" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : <UserIcon size={14} color="#fff" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: isLight ? '#111' : '#fff', fontSize: 13, fontWeight: 700 }}>{u.displayName || u.username}</div>
                          <div style={{ color: isLight ? '#666' : '#6b7280', fontSize: 11 }}>@{u.username}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    searchQuery ? <div style={{ textAlign: 'center', color: isLight ? '#666' : '#444', fontSize: 12, padding: 12 }}>No users found</div> : null
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
              <div className="nav-dropdown" style={{
                position: isMobile ? 'fixed' : 'absolute',
                top: isMobile ? '68px' : 'calc(100% + 12px)',
                left: isMobile ? '16px' : 'auto',
                right: isMobile ? '16px' : 0,
                width: isMobile ? 'auto' : 340,
                background: isLight ? '#ffffff' : '#111',
                border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                padding: '12px 6px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
                zIndex: 10000
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#666' : '#555', padding: '0 12px 8px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>{t('followNotifications', 'Follow Notifications')}</div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {followRequests.length > 0 ? (
                    followRequests.map(u => (
                      <div key={u.username} onClick={() => { setShowNotifications(false); navigate(`/profile/${u.username}`); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s', background: u.status === 'pending' ? (isLight ? 'rgba(var(--brand-1-rgb),0.07)' : 'rgba(var(--brand-1-rgb),0.05)') : 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = u.status === 'pending' ? (isLight ? 'rgba(var(--brand-1-rgb),0.07)' : 'rgba(var(--brand-1-rgb),0.05)') : 'transparent'}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                          {u.avatarPath ? <img src={getAvatarUrl(u.avatarPath)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={18} color={isLight ? '#666' : '#888'} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: isLight ? '#111' : '#fff', fontSize: 13, fontWeight: 700 }}>{u.displayName || u.username}</div>
                          <div style={{ color: isLight ? '#444' : '#6b7280', fontSize: 11, marginTop: 2 }}>
                            {u.status === 'pending' ? t('wantsToFollow', { username: `@${u.username}`, defaultValue: `@${u.username} wants to follow you` }) : t('startedFollowing', { username: `@${u.username}`, defaultValue: `@${u.username} started following you` })}
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            {u.status === 'pending' ? (
                              <button onClick={(e) => handleAllowRequest(u.username, e)} style={{ padding: '6px 12px', background: 'rgba(var(--brand-1-rgb),0.15)', border: 'none', color: 'var(--brand-1-light)', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t('allow', 'Allow')}</button>
                            ) : (
                              <button disabled style={{ padding: '6px 12px', background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', border: 'none', color: isLight ? '#666' : '#6b7280', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{t('followerStatus', 'Follower')}</button>
                            )}
                            
                            {u.myFollowStatus === 'accepted' ? (
                              <button disabled style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.15)', border: 'none', color: '#10b981', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{t('followingStatus', 'Following')}</button>
                            ) : (
                              <button onClick={(e) => {
                                e.stopPropagation();
                                if (u.myFollowStatus === 'pending') return;
                                handleFollowBack(u.username, e);
                              }} style={{ padding: '6px 12px', background: u.myFollowStatus === 'pending' ? (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)') : 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', border: 'none', color: u.myFollowStatus === 'pending' ? (isLight ? '#666' : '#6b7280') : '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: u.myFollowStatus === 'pending' ? 'default' : 'pointer' }}>
                                {u.myFollowStatus === 'pending' ? t('requestSent', 'Request Sent') : t('followBack', 'Follow Back')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', color: isLight ? '#666' : '#444', fontSize: 12, padding: 24 }}>{t('noNewNotifications', 'No new notifications')}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }} onMouseLeave={() => setShowUserMenu(false)}>
            <div className="profile-pill"
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu(!showUserMenu);
                setShowSearch(false);
                setShowRecentChats(false);
                setShowNotifications(false);
              }}
              onMouseEnter={() => { setShowUserMenu(true); setShowSearch(false); setShowRecentChats(false); setShowNotifications(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '6px 14px', fontSize: '14px', color: '#ddd', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {profile?.avatarPath ? (
                  <img src={getAvatarUrl(profile.avatarPath)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <UserIcon size={14} style={{ color: 'var(--brand-1)' }} />
                )}
              </div>
              <span style={{ fontWeight: 600 }}>{myUsername}</span>
            </div>
            {showUserMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: 8, zIndex: 9999 }}>
                <div className="nav-dropdown" style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 8, minWidth: 220, boxShadow: '0 16px 48px rgba(0,0,0,0.8)' }}>
                  <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); navigate('/profile'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--brand-1-rgb),0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(var(--brand-1-rgb),0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserIcon size={16} color="var(--brand-1)" />
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
                  {!isGuest && (
                    <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); setShowSupportModal(true); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <HelpCircle size={16} color="#f59e0b" />
                      </div>
                      {t('contactSupport', 'Contact Support')}
                    </button>
                  )}
                  {!isDesktopApp && (
                    <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); setShowDownloadAppModal(true); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,189,248,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Download size={16} color="#38bdf8" />
                      </div>
                      {t('getDesktopApp', 'Get Desktop App')}
                    </button>
                  )}
                  {isAdminRole && (
                    <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); navigate('/admin'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'rgba(var(--brand-2-rgb),0.1)', border: 'none', color: 'var(--brand-2-light)', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--brand-2-rgb),0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(var(--brand-2-rgb),0.1)'}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(var(--brand-2-rgb),0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Sparkles size={16} color="var(--brand-2)" />
                      </div>
                      {t('adminDashboard', 'Admin Dashboard')}
                    </button>
                  )}
                  <div className="profile-divider" />
                  {isGuest ? (
                    <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); handleLogout(); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--brand-1-rgb),0.15)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(var(--brand-1-rgb),0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UserIcon size={16} color="var(--brand-1)" />
                      </div>
                      {t('logIn', 'Sign In')}
                    </button>
                  ) : (
                    <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); handleLogout(); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <LogOut size={16} color="#f87171" />
                      </div>
                      {t('logOut', 'Log Out')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        )}
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
                <button className="stay-white" onClick={async () => {
                  setOtherProfile(p => p ? { ...p, isBlockedByMe: false } : p);
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
                  setTimeout(fetchOtherProfile, 500);
                }} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Unblock User</button>
              </div>
            </div>
          ) : otherProfile && !userNotFound ? (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 24, padding: isMobile ? '20px 16px' : 32, marginBottom: 24 }}>
                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative' }}>
                      <div style={{ width: 84, height: 84, borderRadius: '50%', overflow: 'hidden', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {otherProfile.avatarPath ? <img src={getAvatarUrl(otherProfile.avatarPath)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={38} color="var(--brand-1)" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 32 }}>
                        <h2 style={{ margin: '0 0 2px', fontSize: '18px', fontWeight: 800, color: isLight ? '#1e293b' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {otherProfile.displayName || otherProfile.username}
                        </h2>
                        <div style={{ color: '#6b7280', fontSize: '13px', marginBottom: '8px' }}>@{otherProfile.username}</div>
                        <div style={{ display: 'flex', gap: '20px' }}>
                          <button onClick={() => openFollowModal('followers', otherProfile.username)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '16px', fontWeight: 800, color: isLight ? '#1e293b' : '#fff', lineHeight: 1.1 }}>{otherProfile.followersCount ?? 0}</span>
                            <span style={{ fontSize: '10px', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 1 }}>{t('followersTabTitle', 'Followers')}</span>
                          </button>
                          <button onClick={() => openFollowModal('following', otherProfile.username)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '16px', fontWeight: 800, color: isLight ? '#1e293b' : '#fff', lineHeight: 1.1 }}>{otherProfile.followingCount ?? 0}</span>
                            <span style={{ fontSize: '10px', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 1 }}>{t('followingTabTitle', 'Following')}</span>
                          </button>
                        </div>
                      </div>
                      <div style={{ position: 'absolute', top: 0, right: 0 }}>
                        {showOptionsDropdown && <div onClick={() => setShowOptionsDropdown(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />}
                        <button className="options-three-dot-btn" onClick={() => { setShowOptionsDropdown(!showOptionsDropdown); setShowRecentChats(false); setShowNotifications(false); setShowSearch(false); setShowUserMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: 8, display: 'flex', borderRadius: '50%', position: 'relative', zIndex: 91 }}>
                          <MoreVertical size={20} />
                        </button>
                        {showOptionsDropdown && (
                          <div className="options-dropdown" style={{ position: 'absolute', top: '100%', right: 0, background: isLight ? '#fff' : '#111', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 8, minWidth: 200, boxShadow: isLight ? '0 10px 40px rgba(0,0,0,0.1)' : '0 10px 40px rgba(0,0,0,0.8)', zIndex: 100 }}>
                            {otherProfile.country && (
                              <div className="options-dropdown-country" style={{ padding: '10px 12px', color: isLight ? '#64748b' : '#bbb', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.05)', marginBottom: 4 }}>
                                {(getFlagUrl(otherProfile.country_code) || getFlagUrlFromName(otherProfile.country)) && (
                                  <img
                                    src={getFlagUrl(otherProfile.country_code) || getFlagUrlFromName(otherProfile.country)}
                                    alt={otherProfile.country || otherProfile.country_code}
                                    style={{ width: 18, height: 13, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }}
                                    onError={e => { e.target.style.display = 'none'; }}
                                  />
                                )}
                                {t('country', 'Country')}: {getLocalizedCountryName(otherProfile.country_code, otherProfile.country)}
                              </div>
                            )}
                            <button onClick={() => { setShowOptionsDropdown(false); setShowShareModal(true); setShowRecentChats(false); setShowNotifications(false); setShowSearch(false); }} className="options-dropdown-btn" style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: isLight ? '#1e293b' : '#fff', padding: '10px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <Share2 size={14} /> {t('shareProfileUrl', 'Share Profile URL')}
                            </button>
                            <button onClick={() => { if (isGuest) { requireLogin(); return; } setBlockingUsername(otherProfile.username); setShowBlockConfirmModal(true); }} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: isLight ? '#dc2626' : '#ef4444', padding: '10px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <Ban size={14} /> {t('blockUser', 'Block User')}
                            </button>
                            <div style={{ height: 1, background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)', margin: '4px 8px' }} />
                            <button onClick={() => { if (isGuest) { requireLogin(); return; } setShowOptionsDropdown(false); setShowReportUserModal(true); }} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: isLight ? '#dc2626' : '#f87171', padding: '10px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.2s', fontWeight: 600 }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <Flag size={14} /> {t('reportUser', 'Report User')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {otherProfile.bio && <div style={{ marginTop: '4px', paddingLeft: '4px' }}><p style={{ margin: 0, fontSize: '13px', color: '#ccc', lineHeight: '1.6', wordBreak: 'break-word' }}>{otherProfile.bio}</p></div>}
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginBottom: 24 }}>
                      <div style={{ width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {otherProfile.avatarPath ? <img src={getAvatarUrl(otherProfile.avatarPath)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={44} color="var(--brand-1)" />}
                      </div>
                      <div style={{ display: 'flex', gap: 32 }}>
                        <button onClick={() => openFollowModal('followers', otherProfile.username)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <div className="stat-num" style={{ textAlign: 'left' }}>{otherProfile.followersCount ?? 0}</div>
                          <div className="stat-lbl" style={{ textAlign: 'left' }}>{t('followersTabTitle', 'Followers')}</div>
                        </button>
                        <button onClick={() => openFollowModal('following', otherProfile.username)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <div className="stat-num" style={{ textAlign: 'left' }}>{otherProfile.followingCount ?? 0}</div>
                          <div className="stat-lbl" style={{ textAlign: 'left' }}>{t('followingTabTitle', 'Following')}</div>
                        </button>
                      </div>
                      <div style={{ marginLeft: 'auto', position: 'relative', alignSelf: 'flex-start', marginTop: 12 }}>
                        {showOptionsDropdown && <div onClick={() => setShowOptionsDropdown(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />}
                        <button className="options-three-dot-btn" onClick={() => { setShowOptionsDropdown(!showOptionsDropdown); setShowRecentChats(false); setShowNotifications(false); setShowSearch(false); setShowUserMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: 8, display: 'flex', borderRadius: '50%', position: 'relative', zIndex: 91 }} onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <MoreVertical size={20} />
                        </button>
                        {showOptionsDropdown && (
                          <div className="options-dropdown" style={{ position: 'absolute', top: '100%', right: 0, background: isLight ? '#fff' : '#111', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 8, minWidth: 200, boxShadow: isLight ? '0 10px 40px rgba(0,0,0,0.1)' : '0 10px 40px rgba(0,0,0,0.8)', zIndex: 100 }}>
                            {otherProfile.country && (
                              <div className="options-dropdown-country" style={{ padding: '10px 12px', color: isLight ? '#64748b' : '#bbb', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.05)', marginBottom: 4 }}>
                                {(getFlagUrl(otherProfile.country_code) || getFlagUrlFromName(otherProfile.country)) && (
                                  <img
                                    src={getFlagUrl(otherProfile.country_code) || getFlagUrlFromName(otherProfile.country)}
                                    alt={otherProfile.country || otherProfile.country_code}
                                    style={{ width: 18, height: 13, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }}
                                    onError={e => { e.target.style.display = 'none'; }}
                                  />
                                )}
                                {t('country', 'Country')}: {getLocalizedCountryName(otherProfile.country_code, otherProfile.country)}
                              </div>
                            )}
                            <button onClick={() => { setShowOptionsDropdown(false); setShowShareModal(true); setShowRecentChats(false); setShowNotifications(false); setShowSearch(false); }} className="options-dropdown-btn" style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: isLight ? '#1e293b' : '#fff', padding: '10px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <Share2 size={14} /> {t('shareProfileUrl', 'Share Profile URL')}
                            </button>
                            <button onClick={() => { if (isGuest) { requireLogin(); return; } setBlockingUsername(otherProfile.username); setShowBlockConfirmModal(true); }} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: isLight ? '#dc2626' : '#ef4444', padding: '10px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <Ban size={14} /> {t('blockUser', 'Block User')}
                            </button>
                            <div style={{ height: 1, background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)', margin: '4px 8px' }} />
                            <button onClick={() => { if (isGuest) { requireLogin(); return; } setShowOptionsDropdown(false); setShowReportUserModal(true); }} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: isLight ? '#dc2626' : '#f87171', padding: '10px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.2s', fontWeight: 600 }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <Flag size={14} /> {t('reportUser', 'Report User')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ marginBottom: 20 }}>
                      <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: isLight ? '#1e293b' : '#fff' }}>{otherProfile.displayName || otherProfile.username}</h2>
                      <div style={{ color: '#6b7280', fontSize: 14, marginBottom: 12 }}>@{otherProfile.username}</div>
                      {otherProfile.bio && <p className="profile-bio-text" style={{ color: '#ccc', fontSize: 14, lineHeight: 1.6, margin: '0' }}>{otherProfile.bio}</p>}
                    </div>
                  </>
                )}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '20px 0' }} />
                {/* Action Buttons under divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                  <button className={!followStatus ? "stay-white" : ""} onClick={handleFollow} disabled={followLoading}
                    style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 4px', borderRadius: 12, border: followStatus ? '1px solid rgba(255,255,255,0.15)' : 'none', background: followBtnColor, color: followBtnTextColor, fontWeight: 700, fontSize: 13, cursor: followLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: followLoading ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                    {followBtnIcon} {followLoading ? '...' : followBtnLabel}
                  </button>
                  {(() => {
                    // Mutual follow = I am following them (accepted) AND they are following me back (accepted)
                    const iMutuallyFollow = followStatus === 'accepted' && otherProfile.isFollowingMe;
                    return (
                      <button
                        title={iMutuallyFollow ? t('sendMessageToUser', { username: otherProfile.displayName || otherProfile.username, defaultValue: `Send a message to ${otherProfile.displayName || otherProfile.username}` }) : t('mutualFollowOnlyMsg', 'You can only message users you mutually follow')}
                        onClick={() => {
                          if (isGuest) { requireLogin(); return; }
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
                          flex: 1, minWidth: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          padding: '10px 4px', borderRadius: 12,
                          border: iMutuallyFollow ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.07)',
                          background: iMutuallyFollow ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                          color: iMutuallyFollow ? '#fff' : '#555',
                          fontWeight: 700, fontSize: 13,
                          cursor: iMutuallyFollow ? 'pointer' : 'not-allowed',
                          transition: 'all 0.2s',
                          opacity: iMutuallyFollow ? 1 : 0.6,
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={e => { if (iMutuallyFollow) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                        onMouseLeave={e => { if (iMutuallyFollow) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                      >
                        <MessageSquare size={15} />
                        {t('message', 'Message')}
                        {!iMutuallyFollow && (
                          <span style={{ fontSize: 12, marginLeft: 1 }}>🔒</span>
                        )}
                      </button>
                    );
                  })()}
                  {otherProfile.email && (
                    <button
                      onClick={() => { window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${otherProfile.email}`, '_blank'); }}
                      title={t('email', 'Email')}
                      style={{
                        flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '10px', borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#fff', cursor: 'pointer', transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
                      <Mail size={17} />
                    </button>
                  )}
                </div>
            </div>
          ) : userNotFound ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <UserIcon size={36} color="#555" />
              </div>
              <h3 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>User Not Found</h3>
              <p style={{ color: '#555', fontSize: 14 }}>This account doesn't exist or has been deleted.</p>
              <button className="stay-white" onClick={() => navigate('/')} style={{ marginTop: 20, padding: '10px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Go Home</button>
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
          {isMobile ? (
            /* Mobile view layout for own profile */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                {/* Profile Picture */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 84, height: 84, borderRadius: '50%', overflow: 'hidden', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {avatarUrl ? <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={34} color="var(--brand-1)" />}
                  </div>
                  <button onClick={() => fileInputRef.current.click()} style={{ position: 'absolute', bottom: -2, right: -2, width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))', border: '2px solid #0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Camera size={12} color="#fff" />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileSelect} />
                </div>

                {/* Right side info: full name + followers/following count */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile.displayName || profile.username}
                  </h3>
                  <p style={{ margin: '2px 0 8px', fontSize: '13px', color: '#888' }}>@{profile.username}</p>
                  
                  {/* Followers / Following count under full name — stacked number / label */}
                  <div style={{ display: 'flex', gap: '20px' }}>
                    <button onClick={() => openFollowModal('followers', profile.username)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: isLight ? '#1e293b' : '#fff', lineHeight: 1.1 }}>{profile.followersCount ?? 0}</span>
                      <span style={{ fontSize: '10px', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 1 }}>{t('followersLabel', 'Followers')}</span>
                    </button>
                    <button onClick={() => openFollowModal('following', profile.username)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: isLight ? '#1e293b' : '#fff', lineHeight: 1.1 }}>{profile.followingCount ?? 0}</span>
                      <span style={{ fontSize: '10px', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 1 }}>{t('followingLabel', 'Following')}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Bio below the avatar and top row */}
              {profile.bio && (
                <div style={{ marginTop: '4px', paddingLeft: '4px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#aaa', lineHeight: '1.6', wordBreak: 'break-word' }}>{profile.bio}</p>
                </div>
              )}
            </div>
          ) : (
            /* Desktop view layout (original) */
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '40px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '32px' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 100, height: 100, borderRadius: '50%', overflow: 'hidden', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {avatarUrl ? <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={40} color="var(--brand-1)" />}
                </div>
                <button onClick={() => fileInputRef.current.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))', border: '2px solid #0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
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
                    <button onClick={() => openFollowModal('followers', profile.username)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: isLight ? '#1e293b' : '#fff', lineHeight: 1, textAlign: 'left' }}>{profile.followersCount ?? 0}</div>
                      <div style={{ fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 3, textAlign: 'left' }}>{t('followersLabel', 'followers')}</div>
                    </button>
                    <button onClick={() => openFollowModal('following', profile.username)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: isLight ? '#1e293b' : '#fff', lineHeight: 1, textAlign: 'left' }}>{profile.followingCount ?? 0}</div>
                      <div style={{ fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 3, textAlign: 'left' }}>{t('followingLabel', 'following')}</div>
                    </button>
                  </div>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#888' }}>@{profile.username}</p>
                {profile.bio && <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#aaa' }}>{profile.bio}</p>}
              </div>
            </div>
          )}

          {/* Display Name */}
          <div className="profile-card">
            <div className="acc-header" onClick={() => toggleSection('displayName')}>
              <h3><UserIcon size={18} color="var(--brand-1)" /> {t('displayName', 'Display Name')}</h3>
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

          {/* Username */}
          <div className="profile-card">
            <div className="acc-header" onClick={() => toggleSection('username')}>
              <h3><AtSign size={18} color="var(--brand-1)" style={{ marginRight: 6 }} />{t('usernameLabel', 'Username')}</h3>
              <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'username' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {openSection === 'username' && (
              <div className="acc-body">
                <div className="field-label">{t('usernameFieldLabel', 'Your unique @handle — used to find and mention you')}</div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      className="profile-input"
                      value={usernameInput}
                      onChange={e => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                      disabled={!editingUsername}
                      placeholder={t('usernamePlaceholder', 'e.g. john.doe_99')}
                      style={{ width: '100%', paddingRight: usernameStatus && editingUsername ? 36 : undefined }}
                      maxLength={30}
                    />
                    {editingUsername && usernameStatus && (
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>
                        {usernameStatus === 'checking' && <span style={{ color: '#94a3b8', fontSize: 12 }}>...</span>}
                        {usernameStatus === 'available' && <Check size={16} color="#22c55e" />}
                        {usernameStatus === 'taken' && <X size={16} color="#ef4444" />}
                        {(usernameStatus === 'invalid' || usernameStatus === 'too_short' || usernameStatus === 'too_long') && <AlertCircle size={16} color="#f59e0b" />}
                      </span>
                    )}
                  </div>
                  {editingUsername ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="profile-save-box"
                        onClick={handleSaveUsername}
                        disabled={usernameStatus !== 'available' || savingUsername}
                        style={{ opacity: usernameStatus !== 'available' || savingUsername ? 0.45 : 1 }}
                        title={t('saveChanges', 'Save Changes')}
                      >
                        <Check size={18} />
                      </button>
                      <button className="profile-cancel-btn" onClick={() => { setEditingUsername(false); setUsernameInput(profile?.username || ''); setUsernameStatus(null); }} title={t('cancelBtn', 'Cancel')}><X size={18} /></button>
                    </div>
                  ) : (
                    <button className="profile-edit-btn" onClick={() => {
                      editingUsernameOriginal.current = profile?.username || localStorage.getItem('watch_username') || '';
                      editingUsernameId.current = profile?.id || null;
                      setEditingUsername(true);
                    }}>
                      <Edit2 size={14} /> {t('edit', 'Edit')}
                    </button>
                  )}
                </div>
                {editingUsername && usernameStatus && usernameStatus !== 'checking' && usernameStatus !== 'self' && (
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5,
                    color: usernameStatus === 'available' ? '#22c55e' : usernameStatus === 'taken' ? '#ef4444' : '#f59e0b' }}>
                    {usernameStatus === 'available' && <><Check size={12} /> {t('usernameAvailable', 'Username is available')}</>}
                    {usernameStatus === 'taken' && <><X size={12} /> {t('usernameTaken', 'Username already taken')}</>}
                    {usernameStatus === 'too_short' && <><AlertCircle size={12} /> {t('usernameTooShort', 'Must be at least 3 characters')}</>}
                    {usernameStatus === 'too_long' && <><AlertCircle size={12} /> {t('usernameTooLong', 'Must be 30 characters or less')}</>}
                    {usernameStatus === 'invalid' && <><AlertCircle size={12} /> {t('usernameInvalidChars', 'Letters, numbers, dots and underscores only')}</>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bio */}
          <div className="profile-card">
            <div className="acc-header" onClick={() => toggleSection('bio')}>
              <h3><Edit2 size={18} color="var(--brand-2)" /> {t('bioTab', 'Bio')}</h3>
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
                      {currentPassword && <button className="pw-toggle" onClick={() => setShowCurrentPw(p => !p)}>{showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
                    </div>
                    {pwErrors.currentPassword && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}><AlertCircle size={12} />{pwErrors.currentPassword}</div>}
                  </div>
                  <div>
                    <div className="pw-wrapper">
                      <input className="profile-input" type={showNewPw ? 'text' : 'password'} placeholder={t('newPassword', 'New Password')} value={newPassword}
                        onChange={e => { setNewPassword(e.target.value); if (pwErrors.newPassword) setPwErrors(p => ({ ...p, newPassword: null })); }}
                        style={{ borderColor: pwErrors.newPassword ? '#ef4444' : undefined }} />
                      {newPassword && <button className="pw-toggle" onClick={() => setShowNewPw(p => !p)}>{showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
                    </div>
                    {pwErrors.newPassword && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}><AlertCircle size={12} />{pwErrors.newPassword}</div>}
                  </div>
                  <div>
                    <div className="pw-wrapper">
                      <input className="profile-input" type={showConfirmPw ? 'text' : 'password'} placeholder={t('confirmNewPassword', 'Confirm New Password')} value={confirmPassword}
                        onChange={e => { setConfirmPassword(e.target.value); if (pwErrors.confirmPassword) setPwErrors(p => ({ ...p, confirmPassword: null })); }}
                        style={{ borderColor: pwErrors.confirmPassword ? '#ef4444' : undefined }} />
                      {confirmPassword && <button className="pw-toggle" onClick={() => setShowConfirmPw(p => !p)}>{showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
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
          <div id="blocked-users-section" className="profile-card">
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
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                          {u.avatarPath ? <img src={getAvatarUrl(u.avatarPath)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={18} color="#fff" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{u.displayName || u.username}</div>
                          <div style={{ color: '#6b7280', fontSize: 12 }}>@{u.username}</div>
                        </div>
                        <button onClick={async (e) => {
                          e.stopPropagation();
                          // Optimistically filter from the UI list instantly
                          setBlockedUsers(prev => prev.filter(item => item.username.toLowerCase() !== u.username.toLowerCase()));
                          
                          const res = await fetch(`${API}/api/block/${u.username}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                          if (res.ok) {
                            toast.success(`Unblocked ${u.username}`);
                            
                            // Update local storage so widgets reflect immediately
                            try {
                              const localBlocks = JSON.parse(localStorage.getItem(`blocked_chats_${profile.username}`) || '[]');
                              const nextBlocks = localBlocks.filter(k => k.toLowerCase() !== u.username.toLowerCase());
                              localStorage.setItem(`blocked_chats_${profile.username}`, JSON.stringify(nextBlocks));
                              window.dispatchEvent(new Event('blocked_chats_updated'));
                            } catch (e) {}

                            setTimeout(fetchBlockedUsers, 500);
                            if (isOwnProfile) fetchProfile(); // Update follower/following counts if changed
                          } else {
                            toast.error('Failed to unblock');
                            // Re-fetch to restore state if unblocking failed
                            fetchBlockedUsers();
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
            <div style={{ position: 'relative', width: 240, height: 240, margin: '0 auto', borderRadius: '50%', overflow: 'hidden', background: '#000' }}>
              <Cropper
                image={selectedImage}
                crop={crop}
                zoom={cropZoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                objectFit="cover"
                onCropChange={setCrop}
                onZoomChange={setCropZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
              <span className="crop-zoom-label" style={{ fontSize: 12, color: '#888' }}>Zoom</span>
              <input type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={e => setCropZoom(parseFloat(e.target.value))} style={{ flex: 1, maxWidth: 180, accentColor: 'var(--brand-1)' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
              <button className="crop-btn" onClick={() => fileInputRef.current.click()}>Reselect</button>
              <button className="crop-btn" onClick={() => setShowCropModal(false)}>Cancel</button>
              <button className="save-btn" onClick={handleCropConfirm}><Check size={16} style={{ marginRight: 4 }} /> Save</button>
            </div>
          </div>
        </div>
      )}
      {/* Block Confirm Modal — shown in ALL views */}
      {showBlockConfirmModal && (
        <div className="block-confirm-overlay" onClick={() => setShowBlockConfirmModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: isLight ? '#fff' : '#18181f', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '28px 28px 24px', width: '90vw', maxWidth: 360, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', animation: 'slideUp 0.25s ease-out' }}>
            {/* Icon + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ban size={20} color="#ef4444" />
              </div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: isLight ? '#1e293b' : '#fff' }}>
                {t('blockUserTitle', 'Block User?')}
              </h3>
            </div>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: isLight ? '#64748b' : '#9ca3af', lineHeight: 1.6 }}>
              {t('blockUserConfirmMsg', 'Are you sure you want to block')} <strong style={{ color: isLight ? '#1e293b' : '#e5e7eb' }}>@{blockingUsername}</strong>? {t('blockUserConfirmDesc', "They won't be able to message you or view your profile.")}
            </p>
            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowBlockConfirmModal(false)}
                style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: isLight ? '#475569' : '#aaa', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f8fafc' : 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                onClick={handleBlockConfirmed}
                disabled={isBlockingInProgress}
                style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', background: isBlockingInProgress ? '#9ca3af' : '#ef4444', color: '#fff', fontSize: 14, fontWeight: 700, cursor: isBlockingInProgress ? 'not-allowed' : 'pointer', transition: 'background 0.2s', WebkitTextFillColor: '#fff' }}
                onMouseEnter={e => { if (!isBlockingInProgress) e.currentTarget.style.background = '#dc2626'; }}
                onMouseLeave={e => { if (!isBlockingInProgress) e.currentTarget.style.background = '#ef4444'; }}
              >
                {isBlockingInProgress ? '...' : t('block', 'Block')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Share Modal */}

      {showShareModal && (
        <div className="share-modal-overlay" onClick={() => setShowShareModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: isLight ? 'rgba(15, 23, 42, 0.4)' : 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
            <button className="share-modal-close" onClick={() => setShowShareModal(false)} style={{ position: 'absolute', top: isMobile ? 12 : -2, right: isMobile ? 12 : -64, width: 36, height: 36, borderRadius: '50%', background: isLight ? '#fff' : '#2a2a3e', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', color: isLight ? '#1e293b' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.05)' : '0 4px 12px rgba(0,0,0,0.5)', transition: 'background 0.2s, transform 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = isLight ? '#f8fafc' : '#3a3a4e'; e.currentTarget.style.transform='scale(1.05)' }} onMouseLeave={e => { e.currentTarget.style.background = isLight ? '#fff' : '#2a2a3e'; e.currentTarget.style.transform='scale(1)' }}>
              <X size={17} />
            </button>
            <div className="share-modal-content" onClick={(e) => e.stopPropagation()} style={{ background: isLight ? '#fff' : '#141420', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', padding: isMobile ? '48px 20px 24px' : 32, borderRadius: 24, width: '90vw', maxWidth: isMobile ? 360 : 480, animation: 'slideUp 0.3s ease-out', boxShadow: isLight ? '0 32px 80px rgba(0,0,0,0.15)' : '0 40px 100px rgba(0,0,0,0.9)' }}>
              <h3 className="share-modal-title" style={{ margin: '0 0 20px', color: isLight ? '#1e293b' : '#fff', fontSize: 18, fontWeight: 800, textAlign: 'center' }}>Share Profile</h3>
              
              <div className="share-modal-url-row" style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.05)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <span className="share-modal-url-display" style={{ flex: 1, fontSize: 12, color: isLight ? '#475569' : '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                  {`${window.location.origin}/profile/${otherProfile?.username}`}
                </span>
                <button className="share-modal-copy-btn" onClick={copyProfileLink} style={{ background: copied ? '#10b981' : 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff !important', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', WebkitTextFillColor: '#fff', flexShrink: 0 }} onMouseEnter={e => e.currentTarget.style.transform='scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(4, 1fr)' : 'repeat(6, 1fr)', gap: isMobile ? '16px 6px' : '20px 8px', justifyContent: 'center' }}>
                {[
                  { label: 'WhatsApp', color: '#25D366', icon: <FaWhatsapp size={20} />, url: `https://api.whatsapp.com/send?text=${window.location.origin}/profile/${otherProfile?.username}` },
                  { label: 'Telegram', color: '#0088cc', icon: <FaTelegramPlane size={20} />, url: `https://t.me/share/url?url=${window.location.origin}/profile/${otherProfile?.username}` },
                  { label: 'Instagram', color: '#E1306C', icon: <FaInstagram size={20} />, url: 'https://instagram.com/' },
                  { label: 'Snapchat', color: '#eab308', icon: <FaSnapchatGhost size={20} />, url: 'https://snapchat.com/' },
                  { label: 'X', color: isLight ? '#000' : '#e5e5e5', icon: <FaXTwitter size={18} />, url: `https://twitter.com/intent/tweet?url=${window.location.origin}/profile/${otherProfile?.username}` },
                  { label: 'Email', color: '#EA4335', icon: <SiGmail size={18} />, url: `mailto:?body=${window.location.origin}/profile/${otherProfile?.username}` },
                  { label: 'Discord', color: '#5865F2', icon: <FaDiscord size={20} />, url: `https://discord.com/channels/@me` },
                  { label: 'Reddit', color: '#FF4500', icon: <FaRedditAlien size={20} />, url: `https://reddit.com/submit?url=${window.location.origin}/profile/${otherProfile?.username}` },
                  { label: 'Facebook', color: '#1877F2', icon: <FaFacebookF size={20} />, url: `https://www.facebook.com/sharer/sharer.php?u=${window.location.origin}/profile/${otherProfile?.username}` },
                  { label: 'LinkedIn', color: '#0A66C2', icon: <FaLinkedin size={20} />, url: `https://www.linkedin.com/shareArticle?mini=true&url=${window.location.origin}/profile/${otherProfile?.username}` },
                  { label: 'Pinterest', color: '#E60023', icon: <FaPinterestP size={20} />, url: `https://pinterest.com/pin/create/button/?url=${window.location.origin}/profile/${otherProfile?.username}` },
                  { label: 'Twitch', color: '#9146FF', icon: <FaTwitch size={20} />, url: 'https://twitch.tv/' }
                ].map(s => (
                  <button key={s.label} onClick={() => window.open(s.url, '_blank')} style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', transition: 'transform 0.2s', width: '100%' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                    <div style={{ width: isMobile ? 42 : 48, height: isMobile ? 42 : 48, borderRadius: 12, background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                      {s.icon}
                    </div>
                    <span style={{ fontSize: 10, color: isLight ? '#64748b' : '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>{s.label}</span>
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
                      <div style={{ width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {u.avatarPath ? <img src={getAvatarUrl(u.avatarPath)} alt={u.username} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={18} color="var(--brand-1)" />}
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
    {/* Report User Modal — outside blurring div so it stays sharp */}
      {showReportUserModal && (
        <div className="report-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeReportModal(); }} style={{ position: 'fixed', inset: 0, backgroundColor: isLight ? 'rgba(15, 23, 42, 0.25)' : 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <style>{`
            .no-scrollbar::-webkit-scrollbar { display: none !important; }
            .no-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }
            .report-modal-card {
              padding: 32px !important;
              max-height: 85vh !important;
              overflow-y: auto !important;
            }
            @media (max-width: 600px) {
              .report-modal-card {
                padding: 16px 20px 20px !important;
                border-radius: 16px !important;
                max-height: 92vh !important;
                width: 95vw !important;
              }
            }
          `}</style>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
            <button className="report-modal-close" onClick={closeReportModal} style={{ position: 'absolute', top: -2, right: -64, width: 44, height: 44, borderRadius: '50%', background: isLight ? '#fff' : '#2a2a3e', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', color: isLight ? '#1e293b' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.05)' : '0 4px 12px rgba(0,0,0,0.5)', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = isLight ? '#f8fafc' : '#3a3a4e'; e.currentTarget.style.transform='scale(1.05)' }} onMouseLeave={e => { e.currentTarget.style.background = isLight ? '#fff' : '#2a2a3e'; e.currentTarget.style.transform='scale(1)' }}>
              <X size={20} />
            </button>
            <div className="report-modal-card no-scrollbar" style={{ background: isLight ? '#fff' : '#141420', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: 24, width: '90vw', maxWidth: 480, animation: 'slideUp 0.3s ease-out', boxShadow: isLight ? '0 32px 80px rgba(0,0,0,0.15)' : '0 40px 100px rgba(0,0,0,0.9)' }}>
              <h3 style={{ margin: '0 0 8px', color: isLight ? '#1e293b' : '#fff', fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Flag size={20} color="#ef4444" /> {t('reportUserTitle', 'Report @{{username}}', { username: otherProfile?.username })}
              </h3>
              <p style={{ color: isLight ? '#64748b' : '#9ca3af', fontSize: 13, margin: '0 0 24px', lineHeight: 1.5 }}>
                {t('reportUserDesc', 'Help us keep SahaPlay safe. Describe what is wrong with this user profile or their behavior, and our team will investigate.')}
              </p>

              {/* Custom Dropdown for Reason */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: isLight ? '#475569' : '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {t('reportReasonLabel', 'Reason for Report')}
                </label>
                <div ref={reportDropdownRef} style={{ position: 'relative', userSelect: 'none' }}>
                  <div
                    onClick={() => setReportDropdownOpen(o => !o)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: reportDropdownOpen ? '12px 12px 0 0' : 12, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.15)', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.06)', color: isLight ? '#1e293b' : '#fff', fontSize: 14, cursor: 'pointer', transition: 'border-radius 0.15s', boxSizing: 'border-box' }}
                  >
                    <span>{
                      reportReason === 'spam' ? t('reportReasonSpam', 'Spam / Advertising')
                      : reportReason === 'harassment' ? t('reportReasonHarassment', 'Harassment / Abuse')
                      : reportReason === 'inappropriate_profile' ? t('reportReasonInappropriate', 'Inappropriate Username, Avatar, or Bio')
                      : t('reportReasonOther', 'Other')
                    }</span>
                    <ChevronDown size={16} style={{ transition: 'transform 0.25s', transform: reportDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0, marginLeft: 8 }} />
                  </div>
                  {reportDropdownOpen && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: isLight ? '#fff' : '#1e1e2e', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.15)', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden', zIndex: 100, boxShadow: isLight ? '0 8px 24px rgba(0,0,0,0.1)' : '0 8px 24px rgba(0,0,0,0.6)' }}>
                      {[
                        { value: 'spam', label: t('reportReasonSpam', 'Spam / Advertising') },
                        { value: 'harassment', label: t('reportReasonHarassment', 'Harassment / Abuse') },
                        { value: 'inappropriate_profile', label: t('reportReasonInappropriate', 'Inappropriate Username, Avatar, or Bio') },
                        { value: 'other', label: t('reportReasonOther', 'Other') },
                      ].map(opt => (
                        <div
                          key={opt.value}
                          onClick={() => { setReportReason(opt.value); setReportDropdownOpen(false); }}
                          style={{ padding: '11px 16px', cursor: 'pointer', fontSize: 14, color: isLight ? '#1e293b' : '#e2e8f0', background: reportReason === opt.value ? (isLight ? '#f0f4ff' : 'rgba(var(--brand-1-rgb),0.18)') : 'transparent', fontWeight: reportReason === opt.value ? 700 : 400, transition: 'background 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.08)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = reportReason === opt.value ? (isLight ? '#f0f4ff' : 'rgba(var(--brand-1-rgb),0.18)') : 'transparent'; }}
                        >
                          {opt.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: isLight ? '#475569' : '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {t('reportDetailsLabel', 'Details')}
                </label>
                <textarea rows={4} value={reportDescription} onChange={e => setReportDescription(e.target.value)} placeholder={t('reportPlaceholder', 'Please provide details or links to evidence to help our team take action...')} style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', borderRadius: 12, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.04)', color: isLight ? '#1e293b' : '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'none', lineHeight: 1.5 }} />
              </div>

              {/* Proof Images Upload - Mandatory */}
              <div style={{ marginBottom: 22 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: isLight ? '#475569' : '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Proof Images <span style={{ color: '#ef4444', fontWeight: 800 }}>*</span>
                </label>
                <p style={{ fontSize: 12, color: isLight ? '#64748b' : '#9ca3af', margin: '0 0 10px' }}>
                  At least 1 screenshot is required. Max 5 images, 5 MB each.
                </p>

                {reportImages.length < 5 && (
                  <div
                    onDragEnter={(e) => { e.preventDefault(); dragReportCount.current++; setDraggingReport(true); }}
                    onDragLeave={(e) => { e.preventDefault(); dragReportCount.current--; if (dragReportCount.current === 0) setDraggingReport(false); }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); dragReportCount.current = 0; setDraggingReport(false); processReportFiles(e.dataTransfer.files); }}
                    onClick={() => reportFileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${draggingReport ? 'var(--brand-1)' : (reportImgErr && reportImages.length === 0 ? '#ef4444' : (isLight ? '#94a3b8' : 'rgba(255,255,255,0.2)'))}`,
                      borderRadius: 12, padding: '20px 16px', textAlign: 'center',
                      cursor: 'pointer', background: draggingReport ? (isLight ? 'rgba(var(--brand-1-rgb),0.06)' : 'rgba(var(--brand-1-rgb),0.1)') : 'transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Upload size={22} style={{ color: 'var(--brand-1)', marginBottom: 8, display: 'inline-block' }} />
                    <div style={{ fontSize: 13, color: isLight ? '#1e293b' : '#ffffff', fontWeight: 600, marginBottom: 2 }}>
                      <span style={{ color: 'var(--brand-1-light)' }}>Click to attach</span> or drag and drop
                    </div>
                    <div style={{ fontSize: 12, color: isLight ? '#64748b' : '#9ca3af' }}>JPG, PNG, GIF, WEBP — up to 5 MB each</div>
                    <input
                      ref={reportFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={e => { processReportFiles(e.target.files); e.target.value = ''; }}
                    />
                  </div>
                )}

                {reportImgErr && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: '#ef4444', fontSize: 12 }}>
                    <AlertCircle size={13} />
                    {reportImgErr}
                  </div>
                )}

                {reportImages.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    {reportImages.map((img, i) => (
                      <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.12)', flexShrink: 0 }}>
                        <img src={img.preview} alt={img.name} style={{ width: 72, height: 56, objectFit: 'cover', display: 'block' }} />
                        <button
                          onClick={() => removeReportImg(i)}
                          style={{
                            position: 'absolute', top: 2, right: 2, width: 18, height: 18,
                            borderRadius: '50%', background: 'rgba(0,0,0,0.75)', border: 'none',
                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', padding: 0,
                          }}
                        >
                          <X size={10} color="#ffffff" style={{ color: '#ffffff' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {reportImages.length > 0 && (
                  <p style={{ fontSize: 12, color: isLight ? '#64748b' : '#9ca3af', margin: '8px 0 0' }}>
                    {reportImages.length} / 5 images attached
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button onClick={closeReportModal} style={{ padding: '10px 16px', borderRadius: 12, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: isLight ? '#475569' : '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {t('cancelBtn', 'Cancel')}
                </button>
                <button
                  disabled={submittingReport || reportImages.length === 0}
                  className={reportImages.length === 0 ? "" : "stay-white"}
                  onClick={async () => {
                  if (reportImages.length === 0) {
                    setReportImgErr('At least 1 proof image is required to submit a report.');
                    return;
                  }
                  setSubmittingReport(true);
                  try {
                    const toB64 = (f) => new Promise((res, rej) => {
                      const r = new FileReader();
                      r.onload = () => res(r.result);
                      r.onerror = rej;
                      r.readAsDataURL(f);
                    });
                    const imagePayload = await Promise.all(reportImages.map(async img => ({
                      data: await toB64(img.file),
                      type: img.type,
                      name: img.name,
                    })));

                    const res = await fetch(`${API}/api/report-user`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({
                        reportedUsername: otherProfile?.username,
                        reason: reportReason,
                        description: reportDescription,
                        images: imagePayload
                      })
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                      toast.success(t('reportSuccess', 'User reported successfully. Thank you!'));
                      closeReportModal();
                    } else {
                      toast.error(data.error || t('reportError', 'Failed to submit report. Please try again.'));
                    }
                  } catch (err) {
                    toast.error(t('reportError', 'Failed to submit report. Please try again.'));
                  } finally {
                    setSubmittingReport(false);
                  }
                }} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: reportImages.length === 0 ? (isLight ? '#d1d5db' : 'rgba(255,255,255,0.1)') : '#ef4444', color: reportImages.length === 0 ? (isLight ? '#9ca3af' : 'rgba(255,255,255,0.35)') : '#ffffff', fontSize: 13, fontWeight: 700, cursor: (submittingReport || reportImages.length === 0) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, WebkitTextFillColor: reportImages.length === 0 ? (isLight ? '#9ca3af' : 'rgba(255,255,255,0.35)') : '#ffffff' }}>
                  {submittingReport ? '...' : t('submitReport', 'Submit Report')}
                </button>
              </div>
              {reportImages.length === 0 && (
                <p style={{ textAlign: 'center', fontSize: 12, color: '#ef4444', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <AlertCircle size={12} />
                  Proof images are required to submit this report
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      <SupportModal isOpen={showSupportModal} onClose={() => setShowSupportModal(false)} />
      <DownloadAppModal isOpen={showDownloadAppModal} onClose={() => setShowDownloadAppModal(false)} />
    </>
  );
};

export default Profile;





