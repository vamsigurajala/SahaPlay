import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import ReactPlayerRaw from 'react-player/lazy';
const ReactPlayer = ReactPlayerRaw.default || ReactPlayerRaw;
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import crownImg from './assets/crown.svg';
import { Upload, Link as LinkIcon, MessageSquare, Monitor, Users, Send, VolumeX, Volume2, Ban, Flag, Play, X, Share2, MessageCircle, MicOff, LogOut, Reply, Lock, Hash, ChevronLeft, Settings, Video, VideoOff, Mic, MoreVertical, Edit2, Trash2, Globe, Pin, Star, SmilePlus, Plus } from 'lucide-react';
import { FaWhatsapp, FaTelegramPlane, FaYoutube, FaTwitch, FaVimeo, FaSoundcloud } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { SiGmail } from 'react-icons/si';
import toast, { Toaster } from 'react-hot-toast';

const SOCKET_SERVER_URL = 'http://127.0.0.1:3001';
const QUICK_EMOJIS = ['👍','❤️','😂','😮','😢'];
const ALL_EMOJIS = ['👍','❤️','😂','😮','😢','🔥','🎉','👏','🤔','🙌','😍','😎','✨','💯','👀','💀','👽','🤖','👻','💩','🙏','💪','👌','✌️','🤞','👎','😡','🤢','🤡','🤫'];

// ── Helpers ────────────────────────────────────────────────
function getInitials(name) { return (name||'?').slice(0,2).toUpperCase(); }
function getAvatarColor(name) {
  const colors = ['#6366f1','#a855f7','#ec4899','#ef4444','#f97316','#10b981','#3b82f6','#06b6d4'];
  let h = 0; for (let c of (name||'')) h = c.charCodeAt(0) + ((h<<5)-h);
  return colors[Math.abs(h) % colors.length];
}
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}
function playPing() {
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; o.type = 'sine';
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.4);
    o.start(ctx.currentTime); o.stop(ctx.currentTime+0.4);
  } catch(e){}
}

// ── Avatar ────────────────────────────────────────────────
function Avatar({ name, size=36, isHost=false, isMuted=false, style={} }) {
  const bg = getAvatarColor(name);
  return (
    <div style={{ position:'relative', display:'inline-flex', flexShrink:0, ...style }}>
      <div style={{ width:size, height:size, borderRadius:'50%', background:bg,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:size*0.35, fontWeight:700, color:'#fff', flexShrink:0,
        border: isHost ? '2px solid #FFD700' : '2px solid rgba(255,255,255,0.15)',
        boxShadow: isHost ? '0 0 8px #FFD70055' : 'none' }}>
        {getInitials(name)}
      </div>
      {isMuted && <div style={{ position:'absolute', bottom:-2, right:-2, width:14, height:14, borderRadius:'50%', background:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #111' }}><MicOff size={8} color="#fff"/></div>}
    </div>
  );
}

// ── Main Room Component ───────────────────────────────────
const Room = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const username = (() => {
    try { const p=JSON.parse(atob(localStorage.getItem('watch_token')?.split('.')?.[1]||'')); return p.username||'Anonymous'; } catch{ return 'Anonymous'; }
  })();

  // Socket & presence
  const [socket, setSocket] = useState(null);
  const [userList, setUserList] = useState([]);
  const [hostId, setHostId] = useState(null);
  const [mySocketId, setMySocketId] = useState(null);
  const [knownUsers, setKnownUsers] = useState(new Set());
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [clearChatModalOpen, setClearChatModalOpen] = useState(false);
  const [clearChatTarget, setClearChatTarget] = useState(null);
  const [clearForBoth, setClearForBoth] = useState(false);
  const mySocketIdRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const userPanelRef = useRef(null);
  const [userMenuOpen, setUserMenuOpen] = useState(null);
  const [kickedReason, setKickedReason] = useState(null); // 'kicked'|'banned'|null
  const [showSettings, setShowSettings] = useState(false);
  const [pinnedRooms, setPinnedRooms] = useState(() => { try { return JSON.parse(localStorage.getItem('pinned_rooms')||'[]'); } catch{ return []; } });
  const settingsRef = useRef(null);

  // Media
  const [mediaUrl, setMediaUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Chat
  const [chatTab, setChatTab] = useState('list'); // 'list'|'group'|'dm'
  const [groupMessages, setGroupMessages] = useState([]);
  const [dmTarget, setDmTarget] = useState(null); // socketId
  const dmTargetRef = useRef(null);
  const [dmThreads, setDmThreads] = useState({}); // socketId -> msgs[]
  const [dmUnread, setDmUnread] = useState({}); // socketId -> count
  const [groupUnread, setGroupUnread] = useState(0);
  const chatTabRef = useRef('group');
  const [groupChatInput, setGroupChatInput] = useState('');
  const [dmChatInput, setDmChatInput] = useState('');
  const [groupReplyTo, setGroupReplyTo] = useState(null); // message obj
  const [dmReplyTo, setDmReplyTo] = useState(null); // message obj
  const [roomName, setRoomName] = useState('Room Chat');
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showDmMenu, setShowDmMenu] = useState(null);
  const [activeReactionMsg, setActiveReactionMsg] = useState(null);
  const [showAllEmojis, setShowAllEmojis] = useState(false);
  const [typingUsers, setTypingUsers] = useState({}); // socketId -> username
  const typingTimer = useRef(null);
  const messagesEndRef = useRef(null);
  const groupMessagesRef = useRef([]);

  // E2E keys
  const myKeyPair = useRef(null);
  const peerPublicKeys = useRef({}); // socketId -> Uint8Array
  const publicKeySentRef = useRef(false);

  // WebRTC
  const playerRef = useRef(null);
  const lastExternalUpdate = useRef(0);
  const videoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const [isScreensharing, setIsScreensharing] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);

  const userCount = userList.length;

  // Camera / Mic state
  const [isCamOn, setIsCamOn] = useState(false);
  const [isMicOnCam, setIsMicOnCam] = useState(true);
  const localCamRef = useRef(null); // our own camera stream
  const cameraPcRefs = useRef({}); // socketId -> RTCPeerConnection for camera
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> {stream, username}

  const platforms = [
    { id:'youtube', name:'YouTube', icon:FaYoutube, color:'#FF0000', placeholder:'Paste YouTube URL...' },
    { id:'twitch', name:'Twitch', icon:FaTwitch, color:'#9146FF', placeholder:'Paste Twitch URL...' },
    { id:'vimeo', name:'Vimeo', icon:FaVimeo, color:'#1AB7EA', placeholder:'Paste Vimeo URL...' },
    { id:'soundcloud', name:'SoundCloud', icon:FaSoundcloud, color:'#ff5500', placeholder:'Paste SoundCloud URL...' },
    { id:'custom', name:'Other', icon:LinkIcon, color:'#6366f1', placeholder:'Paste any direct video URL...' },
    { id:'screenshare', name:'Screenshare', icon:Monitor, color:'#10b981', placeholder:'Share your screen...' },
  ];
  const [activePlatform, setActivePlatform] = useState(platforms[0]);

  // ── Scroll to bottom ──
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [groupMessages, dmThreads, dmTarget]);

  // ── Video stream attach ──
  useEffect(() => {
    if (videoRef.current) {
      if (isViewer && remoteStream) videoRef.current.srcObject = remoteStream;
      else if (isScreensharing && localStreamRef.current) videoRef.current.srcObject = localStreamRef.current;
    }
  }, [remoteStream, isViewer, isScreensharing]);

  useEffect(() => { setHasMounted(true); }, []);

  // ── Persist E2E keypair in localStorage ──
  useEffect(() => {
    const storageKey = `e2e_keypair_${username}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const { publicKey, secretKey } = JSON.parse(saved);
        myKeyPair.current = {
          publicKey: new Uint8Array(Object.values(publicKey)),
          secretKey: new Uint8Array(Object.values(secretKey))
        };
      } else {
        const kp = nacl.box.keyPair();
        myKeyPair.current = kp;
        localStorage.setItem(storageKey, JSON.stringify({ publicKey: Array.from(kp.publicKey), secretKey: Array.from(kp.secretKey) }));
      }
    } catch {
      myKeyPair.current = nacl.box.keyPair();
    }
  }, [username]);

  // ── Main socket setup ──
  useEffect(() => {
    const sock = io(SOCKET_SERVER_URL);
    setSocket(sock);

    sock.on('connect', () => {
      mySocketIdRef.current = sock.id;
      setMySocketId(sock.id);
      sock.emit('join_room', { roomId, username });
    });

    sock.on('connect_error', err => console.error('Socket error:', err));
    
    sock.on('room_renamed', name => setRoomName(name));
    sock.on('dm_cleared', ({ userA, userB, clearedBy, clearForBoth }) => {
      console.log('dm_cleared RECEIVED:', { userA, userB, clearedBy, clearForBoth, myUsername: username });
      // If doing a unilateral clear, ONLY the user who initiated it should locally erase their thread cache
      if (!clearForBoth && username !== clearedBy) return;
      const otherUser = userA === username ? userB : userA;
      console.log('dm_cleared EXECUTING clear for thread:', otherUser);
      setDmThreads(prev => ({ ...prev, [otherUser]: [] }));
      // Tell server to re-send our dm history from DB to ensure local state syncs with hiddenFor flag
      sock.emit('request_dm_history', roomId);
    });

    sock.on('room_state', state => {
      if (state.roomName) setRoomName(state.roomName);
      if (state.currentMedia) setMediaUrl(state.currentMedia);
      setTimeout(() => {
        if (playerRef.current && state.currentTime > 0) { lastExternalUpdate.current = Date.now(); playerRef.current.seekTo(state.currentTime,'seconds'); }
        setIsPlaying(state.isPlaying);
      }, 500);
    });

    sock.on('chat_history', msgs => {
      const parsed = msgs.map(m => ({ ...m, reactions: fixReactions(m.reactions) }));
      setGroupMessages(parsed);
      groupMessagesRef.current = parsed;
    });

    sock.on('user_list', ({ users, hostId: hid }) => {
      setUserList(users);
      setHostId(hid);
      setKnownUsers(prev => { const n = new Set(prev); users.forEach(u=>n.add(u.username)); return n; });
      if (!mySocketIdRef.current && sock.id) { mySocketIdRef.current = sock.id; setMySocketId(sock.id); }
      // Store peer public keys
      users.forEach(u => {
        if (u.publicKey && u.socketId !== sock.id) {
          try { peerPublicKeys.current[u.socketId] = decodeBase64(u.publicKey); } catch{}
        }
      });
      // Send our public key ONCE only (avoid infinite loop)
      if (myKeyPair.current && !publicKeySentRef.current) {
        publicKeySentRef.current = true;
        sock.emit('chat:publicKey', { roomId, publicKey: encodeBase64(myKeyPair.current.publicKey) });
      }
    });

    sock.on('user_joined', ({ username: uname }) => { setKnownUsers(prev => new Set(prev).add(uname)); toast.success(`${uname} joined`); });
    sock.on('user_left', ({ username: uname }) => toast(`${uname} left`, { icon:'👋' }));
    sock.on('host_changed', ({ newHostName }) => toast(`${newHostName} is now the host 👑`, { duration:4000 }));

    sock.on('chat_message', msg => {
      const m = { ...msg, reactions: fixReactions(msg.reactions) };
      setGroupMessages(prev => { const n=[...prev,m]; groupMessagesRef.current=n; return n; });
      if (chatTabRef.current !== 'group') setGroupUnread(p => p+1);
    });

    sock.on('chat:private_reaction', ({ messageId, senderName, emoji, targetName }) => {
      const otherUser = senderName === username ? targetName : senderName;
      setDmThreads(prev => {
        const thread = prev[otherUser];
        if (!thread) return prev;
        const mapped = thread.map(m => {
          if (m.id === messageId || m.timestamp === messageId) {
            const rx = m.reactions ? { ...m.reactions } : {};
            if (!rx[emoji]) rx[emoji] = [];
            const uidStr = senderName; 
            if (rx[emoji].includes(uidStr)) rx[emoji] = rx[emoji].filter(id => id !== uidStr);
            else rx[emoji].push(uidStr);
            return { ...m, reactions: rx };
          }
          return m;
        });
        return { ...prev, [otherUser]: mapped };
      });
    });

    sock.on('chat:typing', ({ socketId, username: uname, isTyping }) => {
      setTypingUsers(prev => {
        const next = { ...prev };
        if (isTyping) next[socketId] = uname;
        else delete next[socketId];
        return next;
      });
    });

    sock.on('chat:reaction', ({ messageId, reactions }) => {
      setGroupMessages(prev => prev.map(m => m.id===messageId ? {...m, reactions:fixReactions(reactions)} : m));
    });

    sock.on('private_message', msg => {
      const otherName = msg.isMe ? msg.targetName : msg.senderName;
      let decrypted = msg.message;
      // Decrypt if we have the key and it's for us
      if (!msg.isMe && msg.nonce && peerPublicKeys.current[msg.senderId] && myKeyPair.current) {
        try {
          const box = decodeBase64(msg.message);
          const nonce = decodeBase64(msg.nonce);
          const plain = nacl.box.open(box, nonce, peerPublicKeys.current[msg.senderId], myKeyPair.current.secretKey);
          if (plain) decrypted = decodeUTF8(plain);
        } catch{}
      }
      const newMsg = { ...msg, message: decrypted };
      setDmThreads(prev => ({ ...prev, [otherName]: [...(prev[otherName]||[]), newMsg] }));
      if (chatTabRef.current !== 'dm' || dmTargetRef.current !== otherName) {
        setDmUnread(prev => ({ ...prev, [otherName]: (prev[otherName]||0) + 1 }));
        if (!msg.isMe) {
          toast(`New message from ${msg.senderName}`, { icon:'💬' });
          if (audioCtxRef.current && pannerRef.current) { const osc = audioCtxRef.current.createOscillator(); osc.type='sine'; osc.frequency.setValueAtTime(880, audioCtxRef.current.currentTime); osc.frequency.exponentialRampToValueAtTime(440, audioCtxRef.current.currentTime+0.1); osc.connect(pannerRef.current); osc.start(); osc.stop(audioCtxRef.current.currentTime+0.1); }
        }
      }
    });


    // ── DM history from DB (historical, server emits on join) ──
    sock.on('chat_history_dm', (dmHistory) => {
      const threads = {};
      
      for (const [otherName, messages] of Object.entries(dmHistory)) {
        threads[otherName] = messages.map(msg => {
          let decrypted = msg.message;
          // Attempt decryption for messages received by us
          if (!msg.isMe && msg.nonce && myKeyPair.current) {
            // We need peer public key by name — try to find it by socketId mapping
            const peerKey = Object.values(peerPublicKeys.current)[0]; // best effort for history
            if (peerKey) {
              try {
                const box = decodeBase64(msg.message);
                const nonce = decodeBase64(msg.nonce);
                const plain = nacl.box.open(box, nonce, peerKey, myKeyPair.current.secretKey);
                if (plain) decrypted = decodeUTF8(plain);
              } catch {}
            }
          }
          return { ...msg, message: decrypted };
        });
      }

      setDmThreads(prev => {
        const merged = { ...prev };
        for (const [name, msgs] of Object.entries(threads)) {
          merged[name] = msgs;
        }
        return merged;
      });
    });

    sock.on('media_changed', url => { setMediaUrl(url); setIsPlaying(false); playerRef.current?.seekTo(0); });
    sock.on('action_play', t => { lastExternalUpdate.current=Date.now(); if(playerRef.current&&Math.abs(playerRef.current.getCurrentTime()-t)>2)playerRef.current.seekTo(t,'seconds'); setIsPlaying(true); });
    sock.on('action_pause', t => { lastExternalUpdate.current=Date.now(); playerRef.current?.seekTo(t,'seconds'); setIsPlaying(false); });
    sock.on('action_seek', t => { lastExternalUpdate.current=Date.now(); playerRef.current?.seekTo(t,'seconds'); });

    // ── Camera p2p listeners ──
    sock.on('cam_started', ({ socketId, username: uname }) => {
      console.log('Received cam_started from', uname, socketId);
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      cameraPcRefs.current[socketId] = pc;
      pc.onicecandidate = e => { if (e.candidate) sock.emit('cam_ice', { targetSocketId: socketId, candidate: e.candidate }); };
      pc.ontrack = e => {
        console.log('Received remote track from', uname, e.streams[0]);
        if (e.streams[0]) setRemoteStreams(prev => ({ ...prev, [socketId]: { stream: e.streams[0], username: uname } }));
      };
      if (localCamRef.current) {
        console.log('Adding local tracks to new PC for', uname);
        localCamRef.current.getTracks().forEach(t => pc.addTrack(t, localCamRef.current));
      }
      pc.createOffer().then(o => { 
        console.log('Sending cam_offer to', uname);
        pc.setLocalDescription(o); 
        sock.emit('cam_offer', { targetSocketId: socketId, offer: o }); 
      }).catch(err => console.error('Error creating offer', err));
    });
    sock.on('cam_stopped', ({ socketId }) => {
      console.log('Received cam_stopped from', socketId);
      cameraPcRefs.current[socketId]?.close();
      delete cameraPcRefs.current[socketId];
      setRemoteStreams(prev => { const n = { ...prev }; delete n[socketId]; return n; });
    });
    sock.on('cam_offer', async ({ senderSocketId, senderName, offer }) => {
      console.log('Received cam_offer from', senderName);
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      cameraPcRefs.current[senderSocketId] = pc;
      pc.onicecandidate = e => { if (e.candidate) sock.emit('cam_ice', { targetSocketId: senderSocketId, candidate: e.candidate }); };
      pc.ontrack = e => {
        console.log('Received remote track (offer handler) from', senderName, e.streams[0]);
        if (e.streams[0]) setRemoteStreams(prev => ({ ...prev, [senderSocketId]: { stream: e.streams[0], username: senderName } }));
      };
      if (localCamRef.current) {
        localCamRef.current.getTracks().forEach(t => pc.addTrack(t, localCamRef.current));
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        console.log('Sending cam_answer back to', senderName);
        sock.emit('cam_answer', { targetSocketId: senderSocketId, answer: ans });
      } catch (err) { console.error('Error handling offer', err); }
    });
    sock.on('cam_answer', async ({ senderSocketId, answer }) => {
      console.log('Received cam_answer from', senderSocketId);
      try { await cameraPcRefs.current[senderSocketId]?.setRemoteDescription(new RTCSessionDescription(answer)); } 
      catch (err) { console.error('Error handling answer', err); }
    });
    sock.on('cam_ice', async ({ senderSocketId, candidate }) => {
      try { await cameraPcRefs.current[senderSocketId]?.addIceCandidate(new RTCIceCandidate(candidate)); } 
      catch (err) { console.error('Error adding ICE candidate', err); }
    });

    sock.on('kicked_out', ({ reason }) => setKickedReason(reason));
    sock.on('you_are_muted', () => { setIsMuted(true); toast('Muted by host 🔇'); });
    sock.on('you_are_unmuted', () => { setIsMuted(false); toast('Unmuted 🔊'); });
    sock.on('you_are_now_host', () => toast.success('You are now the host! 👑'));

    // WebRTC
    sock.on('webrtc_screenshare_started', hid => { setIsViewer(true); sock.emit('webrtc_join_request',{targetSocketId:hid}); });
    sock.on('webrtc_screenshare_stopped', () => { setIsViewer(false); setRemoteStream(null); Object.values(peerConnectionsRef.current).forEach(p=>p.close()); peerConnectionsRef.current={}; });
    sock.on('webrtc_viewer_joined', async vid => {
      if (!localStreamRef.current) return;
      const peer = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
      peerConnectionsRef.current[vid] = peer;
      localStreamRef.current.getTracks().forEach(t=>peer.addTrack(t,localStreamRef.current));
      peer.onicecandidate = e => { if(e.candidate) sock.emit('webrtc_ice_candidate',{targetSocketId:vid,candidate:e.candidate}); };
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
      sock.emit('webrtc_offer',{targetSocketId:vid,offer});
    });
    sock.on('webrtc_offer', async ({senderSocketId,offer}) => {
      const peer = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
      peerConnectionsRef.current[senderSocketId] = peer;
      peer.ontrack = e => { if(e.streams[0]) setRemoteStream(e.streams[0]); };
      peer.onicecandidate = e => { if(e.candidate) sock.emit('webrtc_ice_candidate',{targetSocketId:senderSocketId,candidate:e.candidate}); };
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const ans = await peer.createAnswer(); await peer.setLocalDescription(ans);
      sock.emit('webrtc_answer',{targetSocketId:senderSocketId,answer:ans});
    });
    sock.on('webrtc_answer', async ({senderSocketId,answer}) => { peerConnectionsRef.current[senderSocketId]?.setRemoteDescription(new RTCSessionDescription(answer)); });
    sock.on('webrtc_ice_candidate', async ({senderSocketId,candidate}) => { peerConnectionsRef.current[senderSocketId]?.addIceCandidate(new RTCIceCandidate(candidate)); });

    const onVis = () => { if(!document.hidden&&sock.connected) sock.emit('request_sync',roomId); };
    document.addEventListener('visibilitychange',onVis);
    return () => { document.removeEventListener('visibilitychange',onVis); sock.close(); };
  }, [roomId]);

  // ── Helpers ──
  function fixReactions(r) {
    if (!r) return {};
    const out = {};
    for (const [e,v] of Object.entries(r)) out[e] = Array.isArray(v) ? v : [...v];
    return out;
  }

  const isHost = !!(mySocketId && hostId && mySocketId === hostId);

  // ── Chat typing ──
  const handleChatInputChange = (val) => {
    if (socket && (chatTab==='group' || chatTab==='dm')) {
      socket.emit('chat:typing',{roomId,isTyping:true});
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(()=>socket.emit('chat:typing',{roomId,isTyping:false}),2000);
    }
  };

  // ── Send message ──
  const sendGroupChat = (e) => {
    e.preventDefault();
    if (!groupChatInput.trim() || !socket) return;
    socket.emit('chat_message', { 
      roomId, message: groupChatInput, username, 
      replyTo: groupReplyTo ? { id:groupReplyTo.id, username:groupReplyTo.username, message:groupReplyTo.message } : null 
    });
    setGroupReplyTo(null);
    setGroupChatInput('');
  };

  const sendDmChat = (e) => {
    e.preventDefault();
    if (!dmChatInput.trim() || !socket || !dmTarget) return;
    const targetUser = userList.find(u => u.username === dmTarget);
    if (!targetUser) { toast.error('User is offline, cannot send encrypted message'); return; }
    const targetSocketId = targetUser.socketId;
    
    let msgToSend = dmChatInput;
    let nonce = null; let ephemeralPublicKey = null;
    const theirKey = peerPublicKeys.current[targetSocketId];
    if (theirKey && myKeyPair.current) {
      try {
        const n = nacl.randomBytes(nacl.box.nonceLength);
        const box = nacl.box(encodeUTF8(dmChatInput), n, theirKey, myKeyPair.current.secretKey);
        msgToSend = encodeBase64(box);
        nonce = encodeBase64(n);
        ephemeralPublicKey = encodeBase64(myKeyPair.current.publicKey);
      } catch{}
    }
    socket.emit('private_message', { 
      targetSocketId, targetName: dmTarget, message: msgToSend, nonce, ephemeralPublicKey, 
      replyTo: dmReplyTo ? { id:dmReplyTo.id, username:dmReplyTo.username || dmReplyTo.senderName || dmReplyTo.targetName, message:dmReplyTo.message } : null,
      msgId: `dm-${Date.now()}-${Math.random().toString(36).substr(2,9)}`
    });
    setDmReplyTo(null);
    setDmChatInput('');
  };

  // ── Media ──
  const changeMedia = (url) => {
    if (!url) { toast.error('Enter a URL first'); return; }
    if (activePlatform.id!=='screenshare' && !ReactPlayer.canPlay(url)) { toast.error('Invalid URL'); return; }
    socket.emit('change_media',{roomId,mediaUrl:url});
  };
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if(!file) return;
    setIsUploading(true);
    const fd = new FormData(); fd.append('media',file); fd.append('roomId',roomId);
    try {
      const r = await fetch(`${SOCKET_SERVER_URL}/api/upload`,{method:'POST',body:fd});
      const d = await r.json();
      if (d.url) changeMedia(`${SOCKET_SERVER_URL}${d.url}`);
    } catch{ toast.error('Upload failed'); } finally { setIsUploading(false); e.target.value=null; }
  };
  const handlePlay = () => { if(Date.now()-lastExternalUpdate.current<500)return; socket.emit('play',{roomId,currentTime:playerRef.current?.getCurrentTime()||0}); setIsPlaying(true); };
  const handlePause = () => { if(Date.now()-lastExternalUpdate.current<500)return; socket.emit('pause',{roomId,currentTime:playerRef.current?.getCurrentTime()||0}); setIsPlaying(false); };
  const handleSeek = (s) => { if(Date.now()-lastExternalUpdate.current<500)return; socket.emit('seek',{roomId,currentTime:s}); };

  const startScreenshare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
      localStreamRef.current=stream; setIsScreensharing(true); socket.emit('webrtc_start_screenshare',roomId);
      stream.getVideoTracks()[0].onended = () => stopScreenshare();
    } catch(err){ console.error(err); }
  };
  const stopScreenshare = () => {
    localStreamRef.current?.getTracks().forEach(t=>t.stop()); localStreamRef.current=null; setIsScreensharing(false);
    Object.values(peerConnectionsRef.current).forEach(p=>p.close()); peerConnectionsRef.current={};
    socket?.emit('webrtc_stop_screenshare',roomId);
  };

  // ── Camera / Mic Toggle ──
  const toggleCamera = async () => {
    console.log('toggleCamera clicked. isCamOn:', isCamOn);
    if (isCamOn) {
      // Turn off
      localCamRef.current?.getTracks().forEach(t => t.stop());
      localCamRef.current = null;
      setIsCamOn(false);
      Object.values(cameraPcRefs.current).forEach(p => p.close());
      cameraPcRefs.current = {};
      socket?.emit('cam_stopped', { roomId });
    } else {
      // Turn on
      try {
        console.log('Requesting getUserMedia... mic:', isMicOnCam);
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: isMicOnCam });
        console.log('getUserMedia success', stream.getTracks());
        localCamRef.current = stream;
        setIsCamOn(true);
        socket?.emit('cam_started', { roomId });
        
        // If others already have cameras on but we just joined, we need to renegotiate with them
        // Actually, we should let the existing peers know we turned on our camera, so `cam_started` signals that.
        // Wait, `cam_started` makes THEM create an offer to US.
      } catch (err) {
        toast.error('Could not access camera/mic. Please check permissions.');
        console.error('getUserMedia error:', err);
      }
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !t.enabled);
    }
    const nextState = !isMicOnCam;
    setIsMicOnCam(nextState);
    if (socket) socket.emit('self_mute', { roomId, isMuted: !nextState });
  };

  const openDM = (uname) => {
    dmTargetRef.current = uname; setDmTarget(uname); setChatTab('dm');
    chatTabRef.current = 'dm';
    setDmUnread(prev=>({...prev,[uname]:0}));
  };
  const totalDmUnread = Object.values(dmUnread).reduce((a,b)=>a+b,0);

  const copyRoomLink = () => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(()=>setCopied(false),2000); toast.success('Link copied!'); };

  const reportMsg = async (msg) => {
    try { await fetch(`${SOCKET_SERVER_URL}/api/reports`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomId,reporterUsername:username,reportedUsername:msg.username,message:msg.message})}); toast.success('Reported'); } catch{}
  };

  // ── Kicked Modal ──
  if (kickedReason) return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.92)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:99999,flexDirection:'column',gap:'20px',color:'#fff',fontFamily:"'Outfit',sans-serif",backdropFilter:'blur(20px)'}}>
      <div style={{fontSize:'48px'}}>{kickedReason==='banned'?'🔨':'👢'}</div>
      <h2 style={{fontSize:'24px',fontWeight:800,margin:0}}>{kickedReason==='banned'?'You are banned from this room':'You have been removed from this room'}</h2>
      <p style={{color:'#888',margin:0}}>The host has {kickedReason==='banned'?'banned':'kicked'} you.</p>
      <button onClick={()=>navigate('/')} style={{marginTop:8,background:'linear-gradient(135deg,#6366f1,#a855f7)',border:'none',borderRadius:12,padding:'12px 32px',color:'#fff',fontSize:16,fontWeight:700,cursor:'pointer'}}>Go Home</button>
    </div>
  );

  // ── RENDER ──
  return (
    <div style={{display:'flex',height:'100vh',flexDirection:'column',background:'#0a0a0a',fontFamily:"'Outfit',sans-serif",color:'#fff'}}>
      <Toaster position="top-center" containerStyle={{zIndex:99999}} />
      <style>{`
        @keyframes crownPulse { 0%,100%{filter:drop-shadow(0 0 4px #FFD700);} 50%{filter:drop-shadow(0 0 10px #FFD700) drop-shadow(0 0 20px #FF8C00);} }
        @keyframes slideIn { from{opacity:0;transform:translateY(12px);} to{opacity:1;transform:translateY(0);} }
        @keyframes bounce { 0%,80%,100%{transform:scale(0);} 40%{transform:scale(1);} }
        .msg-enter{animation:slideIn 0.2s ease;}
        .typing-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#888;animation:bounce 1.4s infinite ease-in-out;}
        .typing-dot:nth-child(1){animation-delay:-0.32s;} .typing-dot:nth-child(2){animation-delay:-0.16s;}
        .react-btn{opacity:0;transition:opacity 0.15s;} .msg-row:hover .react-btn{opacity:1;}
        .usr-btn{background:transparent;border:none;color:#555;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:7px;transition:background 0.15s,color 0.15s;width:28px;height:28px;}
        .usr-btn:hover{background:rgba(255,255,255,0.12);color:#fff;}
        .usr-menu-item{width:100%;display:flex;align-items:center;gap:8px;padding:7px 10px;background:transparent;border:none;cursor:pointer;border-radius:7px;font-size:12px;font-weight:500;font-family:inherit;transition:background 0.12s;}
        .usr-menu-item:hover{background:rgba(255,255,255,0.07);}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:#111;} ::-webkit-scrollbar-thumb{background:#333;border-radius:2px;}
      `}</style>

      {/* ── Share Modal ── */}
      {showShareModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowShareModal(false)}>
          <div style={{background:'#141420',border:'1px solid rgba(255,255,255,0.1)',borderRadius:24,padding:32,maxWidth:440,width:'90%',position:'relative'}} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setShowShareModal(false)} style={{position:'absolute',top:12,right:12,background:'none',border:'none',color:'#888',cursor:'pointer'}}><X size={20}/></button>
            <h2 style={{margin:'0 0 20px',fontSize:20,fontWeight:800}}>Invite Friends</h2>
            <div style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:'10px 14px',display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
              <span style={{flex:1,fontSize:13,color:'#aaa',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{window.location.href}</span>
              <button onClick={copyRoomLink} style={{background:copied?'#10b981':'linear-gradient(135deg,#6366f1,#a855f7)',border:'none',borderRadius:8,padding:'6px 14px',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer'}}>{copied?'Copied!':'Copy'}</button>
            </div>
            <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
              {[{icon:<FaWhatsapp size={20}/>,label:'WhatsApp',color:'#25D366',href:`https://api.whatsapp.com/send?text=${encodeURIComponent(window.location.href)}`},
                {icon:<FaTelegramPlane size={20}/>,label:'Telegram',color:'#0088cc',href:`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}`},
                {icon:<FaXTwitter size={20}/>,label:'X',color:'#e5e5e5',href:`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}`},
                {icon:<SiGmail size={20}/>,label:'Email',color:'#EA4335',href:`mailto:?body=${encodeURIComponent(window.location.href)}`}
              ].map(s=>(
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,textDecoration:'none',color:s.color}}>
                  <div style={{width:48,height:48,borderRadius:14,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center'}}>{s.icon}</div>
                  <span style={{fontSize:11,color:'#666'}}>{s.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{height:52,padding:'0 16px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#111',borderBottom:'1px solid rgba(255,255,255,0.07)',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {/* Back Button */}
          <button onClick={()=>navigate('/')} title="Back to Home" style={{width:32,height:32,borderRadius:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'#aaa',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <ChevronLeft size={18}/>
          </button>
          <button onClick={()=>navigate('/')} style={{display:'flex',alignItems:'center',gap:8,background:'none',border:'none',cursor:'pointer',padding:0}}>
            <div style={{width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#6366f1,#a855f7)',display:'flex',alignItems:'center',justifyContent:'center'}}><Play size={13} fill="#fff" color="#fff"/></div>
            <span style={{fontWeight:700,fontSize:15,color:'#fff'}}>WatchTogether</span>
          </button>
          <div style={{width:1,height:20,background:'rgba(255,255,255,0.1)'}}/>
          <span style={{fontSize:13,color:'#888'}}>Room: <span style={{color:'#a0aab2',fontWeight:600}}>{roomId}</span></span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{position:'relative'}} ref={userPanelRef}>
            <button onClick={()=>setShowUserPanel(p=>!p)} style={{display:'flex',alignItems:'center',gap:6,background:'rgba(16,185,129,0.12)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:20,padding:'5px 14px',fontSize:13,color:'#10b981',fontWeight:600,cursor:'pointer',position:'relative',zIndex:50001}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:'#10b981',display:'inline-block'}}/>
              {userCount} watching
            </button>
            {showUserPanel && (
              <div style={{position:'absolute',top:'calc(100% + 8px)',right:0,background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,padding:10,minWidth:220,zIndex:50000,boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}} onMouseDown={e=>e.stopPropagation()}>
                <div style={{fontSize:11,color:'#555',fontWeight:600,letterSpacing:'0.5px',marginBottom:8,padding:'0 6px'}}>ROOM MEMBERS ({userCount})</div>
                {userList.map(u => {
                  const uIsHost = u.isHost === true;
                  const uIsMe = u.socketId === socket.id;
                  const amHost = isHost;
                  return (
                    <div key={u.socketId} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 6px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                      <Avatar name={u.username} isHost={uIsHost} isMuted={u.isMuted} size={34}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:5}}>
                          <span style={{fontSize:13,color:uIsMe?'#6366f1':'#ddd',fontWeight:uIsMe?700:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {u.username}{uIsMe?' (You)':''}
                          </span>
                          {uIsHost && <Star size={12} color="#FFD700" fill="#FFD700" style={{flexShrink:0}}/>}
                          {u.isMuted && <MicOff size={11} color="#ef4444"/>}
                        </div>
                        {uIsHost && <div style={{fontSize:10,color:'#FFD700',marginTop:1}}>Host</div>}
                      </div>
                      {!uIsMe && (
                        <div style={{display:'flex',gap:2,flexShrink:0,alignItems:'center'}}>
                          <div style={{position:'relative'}}>
                            <button className="usr-btn" title="Private chat" onClick={()=>{openDM(u.username);setShowUserPanel(false);}}>
                              <MessageCircle size={14}/>
                              {(dmUnread[u.socketId]||0)>0 && <span style={{position:'absolute',top:-3,right:-3,width:12,height:12,borderRadius:'50%',background:'#ef4444',fontSize:8,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff'}}>{dmUnread[u.socketId]}</span>}
                            </button>
                          </div>
                          {!uIsHost && (
                            <div style={{position:'relative'}}>
                              <button className="usr-btn" title="More options" onClick={e=>{e.stopPropagation();setUserMenuOpen(userMenuOpen===u.socketId?null:u.socketId);}}>
                                <MoreVertical size={14}/>
                              </button>
                              {userMenuOpen===u.socketId && (
                                <div style={{position:'absolute',right:0,top:'calc(100% + 4px)',background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,padding:4,zIndex:99999,minWidth:130,boxShadow:'0 8px 24px rgba(0,0,0,0.7)'}} onMouseLeave={()=>setUserMenuOpen(null)} onClick={e=>e.stopPropagation()}>
                                  {amHost ? (
                                    <>
                                      <button className="usr-menu-item" style={{color:'#fbbf24'}} onClick={()=>{socket.emit('mod_mute',{roomId,targetSocketId:u.socketId});setUserMenuOpen(null);}}>
                                        {u.isMuted?<Volume2 size={13}/>:<VolumeX size={13}/>}{u.isMuted?'Unmute':'Mute'}
                                      </button>
                                      <button className="usr-menu-item" style={{color:'#f97316'}} onClick={()=>{socket.emit('mod_kick',{roomId,targetSocketId:u.socketId});setUserMenuOpen(null);}}>
                                        <LogOut size={13}/>Kick
                                      </button>
                                      <button className="usr-menu-item" style={{color:'#ef4444'}} onClick={()=>{if(window.confirm(`Ban ${u.username}?`)){socket.emit('mod_ban',{roomId,targetSocketId:u.socketId});setUserMenuOpen(null);}}}>
                                        <Ban size={13}/>Ban
                                      </button>
                                    </>
                                  ) : (
                                    <div style={{padding:'7px 10px',color:'#555',fontSize:12}}>No actions</div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <button onClick={()=>setShowShareModal(true)} style={{display:'flex',alignItems:'center',gap:6,background:'linear-gradient(135deg,#6366f1,#a855f7)',border:'none',borderRadius:20,padding:'6px 14px',fontSize:13,fontWeight:600,color:'#fff',cursor:'pointer'}}>
            <Share2 size={14}/> Invite
          </button>
          {/* Settings Icon */}
          <div style={{position:'relative'}} ref={settingsRef}>
            <button onClick={()=>setShowSettings(p=>!p)} title="Room Settings" style={{width:34,height:34,borderRadius:10,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'#aaa',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Settings size={16}/>
            </button>
            {showSettings && (
              <div style={{position:'absolute',top:'calc(100% + 8px)',right:0,background:'#141414',border:'1px solid rgba(255,255,255,0.08)',borderRadius:16,padding:6,minWidth:190,zIndex:5000,boxShadow:'0 10px 40px rgba(0,0,0,0.8)'}}>
                <button className="settings-menu-btn" onClick={()=>{
                  const isPinned = pinnedRooms.includes(roomId);
                  const next = isPinned ? pinnedRooms.filter(r=>r!==roomId) : [...pinnedRooms, roomId];
                  setPinnedRooms(next);
                  localStorage.setItem('pinned_rooms', JSON.stringify(next));
                  toast.success(isPinned ? 'Room unpinned' : 'Room pinned! 📌');
                  setShowSettings(false);
                }} style={{width:'100%',textAlign:'left',padding:'10px 14px',background:'transparent',border:'none',color:'#f1f1f1',cursor:'pointer',borderRadius:10,fontSize:14,display:'flex',alignItems:'center',gap:12,fontWeight:500}}>
                  <Pin size={16} color="#888"/> {pinnedRooms.includes(roomId) ? 'Unpin Room' : 'Pin Room'}
                </button>

                <button className="settings-menu-btn" onClick={()=>{ toast.success('Room is now public! 🌍'); setShowSettings(false); }} style={{width:'100%',textAlign:'left',padding:'10px 14px',background:'transparent',border:'none',color:'#f1f1f1',cursor:'pointer',borderRadius:10,fontSize:14,display:'flex',alignItems:'center',gap:12,fontWeight:500}}>
                  <Globe size={16} color="#10b981"/> Make this public
                </button>

                <div style={{height:1,background:'rgba(255,255,255,0.06)',margin:'4px 0'}}></div>

                <button className="settings-menu-btn-danger" onClick={()=>{ setShowSettings(false); navigate('/'); }} style={{width:'100%',textAlign:'left',padding:'10px 14px',background:'transparent',border:'none',color:'#f87171',cursor:'pointer',borderRadius:10,fontSize:14,display:'flex',alignItems:'center',gap:12,fontWeight:500}}>
                  <LogOut size={16} color="#f87171"/> Leave Room
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {showSettings && <div style={{position:'fixed',inset:0,zIndex:4998}} onClick={()=>setShowSettings(false)}/>}

      {/* close panel on outside click */}
      {showUserPanel && <div style={{position:'fixed',inset:0,zIndex:4999}} onClick={()=>setShowUserPanel(false)}/>}

      {/* ── Main Content ── */}
      <div style={{display:'flex',flex:1,overflow:'hidden',padding:12,gap:12}}>
        {/* Video + controls */}
        <div style={{flex:3,display:'flex',flexDirection:'column',gap:12}}>
          <div style={{flex:1,background:'#111',borderRadius:16,border:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',position:'relative'}}>
            {(isScreensharing||isViewer) ? (
              <video ref={videoRef} autoPlay playsInline controls={isViewer} muted={isScreensharing} style={{width:'100%',height:'100%',objectFit:'contain'}}/>
            ) : hasMounted && mediaUrl ? (
              <div style={{position:'absolute',inset:0}}>
                <ReactPlayer ref={playerRef} url={mediaUrl} width="100%" height="100%" controls playing={isPlaying} onPlay={handlePlay} onPause={handlePause} onSeek={handleSeek}/>
              </div>
            ) : (
              <div style={{textAlign:'center',color:'#444'}}>
                <MessageSquare size={48} style={{marginBottom:12,opacity:0.3}}/>
                <h3 style={{margin:'0 0 8px',color:'#666'}}>No Media Selected</h3>
                <p style={{margin:0,fontSize:13}}>Paste a URL below or upload a local file</p>
              </div>
            )}
          </div>

          {/* ── Camera/Mic video tiles (bottom center) ── */}
          {(isCamOn || Object.keys(remoteStreams).length > 0) && (
            <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap',padding:'8px 0'}}>
              {isCamOn && (
                <div style={{position:'relative',width:120,height:90,borderRadius:12,overflow:'hidden',background:'#000',border:'2px solid #6366f1',flexShrink:0}}>
                  <video autoPlay muted playsInline style={{width:'100%',height:'100%',objectFit:'cover'}} ref={el => { if (el && localCamRef.current) el.srcObject = localCamRef.current; }}/>
                  <div style={{position:'absolute',bottom:4,left:0,right:0,textAlign:'center',fontSize:10,color:'#fff',fontWeight:600,textShadow:'0 1px 3px rgba(0,0,0,0.8)'}}>{username} (You)</div>
                  {!isMicOnCam && <div style={{position:'absolute',top:4,right:4,background:'rgba(239,68,68,0.9)',borderRadius:4,padding:'2px 4px',display:'flex'}}><MicOff size={10} color="#fff"/></div>}
                </div>
              )}
              {Object.entries(remoteStreams).map(([sid, { stream, username: uname }]) => {
                const uObj = userList.find(u=>u.username===uname);
                return (
                  <div key={sid} style={{position:'relative',width:120,height:90,borderRadius:12,overflow:'hidden',background:'#000',border:'2px solid rgba(255,255,255,0.15)',flexShrink:0}}>
                    <video autoPlay playsInline muted={uObj?.isMuted} style={{width:'100%',height:'100%',objectFit:'cover'}} ref={el => { if (el && stream) el.srcObject = stream; }}/>
                    <div style={{position:'absolute',bottom:4,left:0,right:0,textAlign:'center',fontSize:10,color:'#fff',fontWeight:600,textShadow:'0 1px 3px rgba(0,0,0,0.8)'}}>{uname}</div>
                    {uObj?.isMuted && <div style={{position:'absolute',top:4,right:4,background:'rgba(239,68,68,0.9)',borderRadius:4,padding:'2px 4px',display:'flex'}}><MicOff size={10} color="#fff"/></div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Camera / Mic control bar */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'4px 0'}}>
            <button onClick={toggleCamera} title={isCamOn ? 'Turn off camera' : 'Turn on camera'} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:20,border:`1px solid ${isCamOn?'#6366f1':'rgba(255,255,255,0.15)'}`,background:isCamOn?'rgba(99,102,241,0.15)':'rgba(255,255,255,0.04)',color:isCamOn?'#a5b4fc':'#888',cursor:'pointer',fontSize:12,fontWeight:600}}>
              {isCamOn ? <Video size={14}/> : <VideoOff size={14}/>}
              {isCamOn ? 'Cam On' : 'Start Cam'}
            </button>
            {isCamOn && (
              <button onClick={toggleMic} title={isMicOnCam ? 'Mute mic' : 'Unmute mic'} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:20,border:`1px solid ${isMicOnCam?'#10b981':'#ef4444'}`,background:isMicOnCam?'rgba(16,185,129,0.12)':'rgba(239,68,68,0.12)',color:isMicOnCam?'#10b981':'#ef4444',cursor:'pointer',fontSize:12,fontWeight:600}}>
                {isMicOnCam ? <Mic size={14}/> : <MicOff size={14}/>}
                {isMicOnCam ? 'Mic On' : 'Muted'}
              </button>
            )}
          </div>

          <div style={{background:'#111',borderRadius:16,border:'1px solid rgba(255,255,255,0.07)',padding:16,display:'flex',flexDirection:'column',gap:12}}>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {platforms.map(p=>{const Icon=p.icon;const active=activePlatform.id===p.id;return(
                <button key={p.id} onClick={()=>setActivePlatform(p)} style={{flex:'1 1 auto',display:'flex',alignItems:'center',gap:6,padding:'8px 12px',borderRadius:10,border:`1px solid ${active?p.color:'rgba(255,255,255,0.08)'}`,background:active?p.color:'rgba(255,255,255,0.03)',color:active?'#fff':'#888',cursor:'pointer',fontSize:13,fontWeight:active?700:400,transition:'all 0.2s'}}>
                  <Icon size={14}/>{p.name}
                </button>
              );})}
            </div>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <input className="input-field" value={inputUrl} onChange={e=>setInputUrl(e.target.value)} placeholder={activePlatform.placeholder} disabled={activePlatform.id==='screenshare'||isScreensharing||isViewer} style={{flex:1,borderRadius:10,padding:'10px 14px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',color:'#fff',fontSize:14,outline:'none'}}/>
              {activePlatform.id==='screenshare' ? (
                <button onClick={isScreensharing?stopScreenshare:startScreenshare} disabled={isViewer&&!isScreensharing} style={{background:isScreensharing?'linear-gradient(135deg,#ef4444,#dc2626)':'linear-gradient(135deg,#6366f1,#a855f7)',border:'none',borderRadius:10,padding:'10px 18px',color:'#fff',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                  {isScreensharing?'Stop':isViewer?'Viewing':'Start Screenshare'}
                </button>
              ) : (
                <button onClick={()=>changeMedia(inputUrl)} disabled={isScreensharing||isViewer} style={{background:'linear-gradient(135deg,#6366f1,#a855f7)',border:'none',borderRadius:10,padding:'10px 18px',color:'#fff',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>Play Video</button>
              )}
              <span style={{color:'#555',fontSize:13}}>OR</span>
              <label style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,padding:'10px 14px',color:'#aaa',cursor:'pointer',fontSize:13,whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:6}}>
                <Upload size={14}/>{isUploading?'Uploading...':'Local File'}
                <input type="file" accept="video/*" style={{display:'none'}} onChange={handleFileUpload} disabled={isUploading}/>
              </label>
            </div>
          </div>
        </div>

        {/* ── Chat Panel (Unified List + Thread) ── */}
        <div style={{width:340,display:'flex',flexDirection:'column',background:'#111',borderRadius:16,border:'1px solid rgba(255,255,255,0.07)',overflow:'hidden',flexShrink:0}}>

          {chatTab === 'list' ? (
            /* ===== CHAT LIST VIEW ===== */
            <>
              <div style={{padding:'12px 14px',borderBottom:'1px solid rgba(255,255,255,0.07)',fontWeight:700,fontSize:14,color:'#ddd',letterSpacing:'0.2px'}}>
                Chats
              </div>
              <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>
                {/* Group chat row */}
                <button onClick={()=>{setChatTab('group');chatTabRef.current='group';setGroupUnread(0);}} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'transparent',border:'none',borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:'pointer',color:'#fff',width:'100%',textAlign:'left',position:'relative'}}>
                  <div style={{width:40,height:40,borderRadius:12,background:'linear-gradient(135deg,#6366f1,#a855f7)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <Users size={18} color="#fff"/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#fff'}}>{roomName}</div>
                    <div style={{fontSize:11,color:'#555',marginTop:2}}>{groupMessages.length > 0 ? groupMessages[groupMessages.length-1].message?.slice(0,32) : 'Group conversation'}</div>
                  </div>

                  {groupUnread > 0 && (
                    <span style={{width:20,height:20,borderRadius:'50%',background:'#ef4444',color:'#fff',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      {groupUnread > 9 ? '9+' : groupUnread}
                    </span>
                  )}
                </button>

                {/* DM rows */}
                {Array.from(new Set([...userList.filter(u=>u.username!==username).map(u=>u.username), ...Object.keys(dmThreads), ...Array.from(knownUsers)])).filter(n=>n!==username).map(uname => {
                  const unread = dmUnread[uname]||0;
                  const thread = dmThreads[uname]||[];
                  const last = thread[thread.length-1];
                  const uObj = userList.find(u=>u.username===uname);
                  const isOnline = !!uObj;

                  return (
                    <button key={uname} onClick={()=>openDM(uname)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'transparent',border:'none',borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:'pointer',color:'#fff',width:'100%',textAlign:'left',position:'relative'}}>
                      <div style={{position:'relative',flexShrink:0}}>
                        <Avatar name={uname} size={40}/>
                        <div style={{position:'absolute',bottom:0,right:0,width:11,height:11,borderRadius:'50%',background:isOnline?'#10b981':'#666',border:'2px solid #111'}}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:isOnline?'#fff':'#aaa',display:'flex',alignItems:'center',gap:5}}>
                          {uname}
                          {uObj?.isHost && <img src={crownImg} alt="host" style={{width:12,height:10}}/>}
                        </div>
                        <div style={{fontSize:11,color:'#555',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {last ? (last.isMe ? `You: ${last.message?.slice(0,28)}` : last.message?.slice(0,32)) : 'Start a private chat'}
                        </div>
                      </div>
                      <div style={{position:'relative',display:'flex',alignItems:'center'}}>
                        {unread > 0 && (
                          <span style={{width:20,height:20,borderRadius:'50%',background:'#ef4444',color:'#fff',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}

                {Array.from(new Set([...userList.filter(u=>u.username!==username).map(u=>u.username), ...Object.keys(dmThreads)])).length===0 && (
                  <div style={{padding:'20px',color:'#444',fontSize:12,textAlign:'center'}}>No other users in room</div>
                )}
              </div>
            </>

          ) : chatTab === 'group' ? (
            /* ===== GROUP CHAT THREAD ===== */
            <>
              {/* Thread header with back button */}
              <div style={{padding:'8px 14px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
                <button onClick={()=>{setChatTab('list');chatTabRef.current='list';}} style={{width:30,height:30,borderRadius:8,background:'rgba(255,255,255,0.06)',border:'none',color:'#aaa',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <ChevronLeft size={16}/>
                </button>
                <div style={{width:32,height:32,borderRadius:10,background:'linear-gradient(135deg,#6366f1,#a855f7)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Users size={15} color="#fff"/>
                </div>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:'#fff'}}>{roomName}</div>
                  <div style={{fontSize:10,color:'#555'}}>{userCount} members online</div>
                </div>
                <div style={{position:'relative', marginLeft:'auto', display:'flex', alignItems:'center'}}>
                  <div onClick={e=>{e.stopPropagation(); setShowGroupMenu(p=>!p);}} style={{background:'none',border:'none',color:'#aaa',cursor:'pointer',padding:4}}><MoreVertical size={16}/></div>
                  {showGroupMenu && (
                    <div style={{position:'absolute',right:0,top:'100%',background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:4,zIndex:100,minWidth:120,boxShadow:'0 4px 12px rgba(0,0,0,0.5)'}} onMouseLeave={()=>setShowGroupMenu(false)}>
                      <div onClick={e=>{e.stopPropagation(); setShowGroupMenu(false); if(isHost){ setRenameInput(roomName); setRenameModalOpen(true); } else toast.error('Only host can rename room');}} style={{display:'flex',alignItems:'center',gap:6,width:'100%',padding:'6px 8px',background:'transparent',border:'none',color:'#fff',fontSize:12,cursor:'pointer',textAlign:'left'}} className="menu-btn">
                        <Edit2 size={12}/> Edit Name
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Messages */}
              <div style={{flex:1,overflowY:'auto',padding:12,display:'flex',flexDirection:'column',gap:10}}>
                {groupMessages.length===0 && <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#444',gap:8}}><MessageSquare size={36} opacity={0.2}/><p style={{margin:0,fontSize:13}}>No messages yet. Say hi!</p></div>}
                {groupMessages.map((msg,i)=>{
                  const isMe = msg.userId===(mySocketIdRef.current||mySocketId);
                  const reactions = msg.reactions||{};
                  return (
                    <div key={msg.id||i} className="msg-row msg-enter" style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',gap:4}}>
                      {msg.replyTo && (
                        <div style={{background:'rgba(255,255,255,0.05)',borderLeft:'3px solid #6366f1',borderRadius:6,padding:'4px 8px',fontSize:11,color:'#888',maxWidth:'80%'}}>
                          <span style={{color:'#a0aab2',fontWeight:600}}>{msg.replyTo.username}: </span>{msg.replyTo.message?.slice(0,60)}
                        </div>
                      )}
                      <div style={{display:'flex',alignItems:'center',gap:8,flexDirection:isMe?'row-reverse':'row',maxWidth:'85%'}}>
                        {!isMe && <Avatar name={msg.username} size={28}/>}
                        <div style={{display:'flex',flexDirection:'column',gap:2,alignItems:isMe?'flex-end':'flex-start'}}>
                          <div style={{background:isMe?'linear-gradient(135deg,#6366f1,#a855f7)':'rgba(255,255,255,0.06)',padding:'8px 12px',borderRadius:isMe?'14px 14px 4px 14px':'14px 14px 14px 4px',fontSize:14,color:'#fff',maxWidth:'100%',wordBreak:'break-word'}}>
                            {msg.message}
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <span style={{fontSize:10,color:'#444'}}>{formatTime(msg.timestamp)}</span>
                            <button onClick={()=>setGroupReplyTo(msg)} style={{background:'none',border:'none',color:'#555',cursor:'pointer',padding:0,fontSize:10,display:'flex',alignItems:'center',gap:3}}><Reply size={10}/>Reply</button>
                            <button onClick={()=>reportMsg(msg)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.15)',cursor:'pointer',padding:0}}><Flag size={9}/></button>
                          </div>
                        </div>
                        <div style={{position:'relative', display:'flex', alignItems:'center', opacity: activeReactionMsg === msg.id ? 1 : undefined}} className="react-btn-container">
                          <button className="react-btn" onClick={()=>{ setActiveReactionMsg(activeReactionMsg===msg.id?null:msg.id); setShowAllEmojis(false); }} style={{background:'transparent',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#aaa',padding:2}}>
                            <SmilePlus size={16}/>
                          </button>
                          {activeReactionMsg === msg.id && (
                            <div style={{position:'absolute',bottom:'100%',left:isMe?'auto':0,right:isMe?0:'auto',marginBottom:8,background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',borderRadius: showAllEmojis ? 16 : 24,padding:'8px 10px',display:'flex',gap:4,flexWrap:'wrap',width: showAllEmojis ? 280 : 'max-content', maxHeight: showAllEmojis ? 250 : undefined, overflowY: showAllEmojis ? 'auto' : 'visible', boxShadow:'0 8px 24px rgba(0,0,0,0.6)', zIndex:100}}>
                              {(showAllEmojis ? ALL_EMOJIS : QUICK_EMOJIS).map(em=>(
                                <button key={em} onClick={(e)=>{e.stopPropagation(); socket.emit('chat:reaction',{roomId,messageId:msg.id,emoji:em});setActiveReactionMsg(null); setShowAllEmojis(false);}} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:22,padding:'6px',borderRadius:8,transition:'transform 0.1s',display:'flex',alignItems:'center',justifyContent:'center'}} className="menu-btn" onMouseEnter={(e)=>e.currentTarget.style.transform='scale(1.3)'} onMouseLeave={(e)=>e.currentTarget.style.transform='scale(1)'}>{em}</button>
                              ))}
                              {!showAllEmojis && (
                                <button onClick={(e)=>{e.stopPropagation(); setShowAllEmojis(true);}} style={{background:'rgba(255,255,255,0.1)',border:'none',cursor:'pointer',fontSize:14,width:34,height:34,borderRadius:'50%',marginLeft:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',transition:'background 0.2s'}} onMouseEnter={(e)=>e.currentTarget.style.background='rgba(255,255,255,0.2)'} onMouseLeave={(e)=>e.currentTarget.style.background='rgba(255,255,255,0.1)'}><Plus size={16}/></button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:isMe?'flex-end':'flex-start', marginTop:-4}}>
                        {Object.entries(reactions).filter(([,v])=>v.length>0).map(([emoji,uids])=>(
                          <button key={emoji} onClick={()=>socket.emit('chat:reaction',{roomId,messageId:msg.id,emoji})} style={{background:'rgba(255,255,255,0.07)',border:`1px solid ${uids.includes(mySocketIdRef.current)?'#6366f1':'rgba(255,255,255,0.1)'}`,borderRadius:12,padding:'2px 8px',cursor:'pointer',fontSize:12,color:'#ddd'}}>
                            {emoji} {uids.length}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {Object.values(typingUsers).length>0 && (
                  <div style={{display:'flex',alignItems:'center',gap:8,color:'#666',fontSize:12}}>
                    <div style={{display:'flex',gap:3}}><span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/></div>
                    {Object.values(typingUsers).join(', ')} {Object.values(typingUsers).length===1?'is':'are'} typing...
                  </div>
                )}
                <div ref={messagesEndRef}/>
              </div>
              {groupReplyTo && (
                <div style={{padding:'6px 12px',background:'rgba(99,102,241,0.08)',borderTop:'1px solid rgba(99,102,241,0.2)',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,color:'#a0aab2'}}>
                  <span><span style={{color:'#6366f1',fontWeight:600}}>{groupReplyTo.username || groupReplyTo.senderName}: </span>{groupReplyTo.message?.slice(0,50)}</span>
                  <button onClick={()=>setGroupReplyTo(null)} style={{background:'none',border:'none',color:'#666',cursor:'pointer'}}><X size={12}/></button>
                </div>
              )}
              <div style={{padding:'10px 12px',borderTop:'1px solid rgba(255,255,255,0.07)',flexShrink:0}}>
                {isMuted && <div style={{fontSize:11,color:'#ef4444',marginBottom:6,background:'rgba(239,68,68,0.1)',padding:'4px 8px',borderRadius:6}}>🔇 You are muted by the host</div>}
                <form onSubmit={sendGroupChat} style={{display:'flex',gap:8}}>
                  <input value={groupChatInput} onChange={e=>{handleChatInputChange(e.target.value); setGroupChatInput(e.target.value);}} placeholder="Message the room..." disabled={isMuted} style={{flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:'8px 12px',color:'#fff',fontSize:13,outline:'none'}}/>
                  <button type="submit" disabled={isMuted||!groupChatInput.trim()} style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#6366f1,#a855f7)',border:'none',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:isMuted||!groupChatInput.trim()?0.5:1}}>
                    <Send size={15}/>
                  </button>
                </form>
              </div>
            </>

          ) : (
            /* ── DM Thread ── */
            <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,minHeight:0}}>
                {dmTarget ? (() => {
                  const uObj = userList.find(u=>u.username===dmTarget);
                  const isOnline = !!uObj;
                  return (
                  <>
                    <div style={{padding:'8px 14px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
                      <button onClick={()=>{setChatTab('list');chatTabRef.current='list';setDmTarget(null);dmTargetRef.current=null;}} style={{width:30,height:30,borderRadius:8,background:'rgba(255,255,255,0.06)',border:'none',color:'#aaa',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <ChevronLeft size={16}/>
                      </button>
                      <Avatar name={dmTarget} size={32}/>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:isOnline?'#fff':'#aaa',display:'flex',alignItems:'center',gap:5}}>
                          {dmTarget}
                        </div>
                        <div style={{fontSize:10,color:isOnline?'#10b981':'#666',display:'flex',alignItems:'center',gap:4}}>
                          {isOnline ? <><Lock size={9}/>Online / E2E Encrypted</> : 'Offline'}
                        </div>
                      </div>
                      <div style={{position:'relative', marginLeft:'auto', display:'flex', alignItems:'center'}}>
                        <div onClick={e=>{e.stopPropagation(); setShowDmMenu(showDmMenu===dmTarget?null:dmTarget);}} style={{background:'none',border:'none',color:'#aaa',cursor:'pointer',padding:4}}><MoreVertical size={16}/></div>
                        {showDmMenu === dmTarget && (
                          <div style={{position:'absolute',right:0,top:'100%',background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:4,zIndex:100,minWidth:120,boxShadow:'0 4px 12px rgba(0,0,0,0.5)'}} onMouseLeave={()=>setShowDmMenu(null)}>
                            <div onClick={e=>{e.stopPropagation(); setShowDmMenu(null); setClearChatTarget(dmTarget); setClearChatModalOpen(true); }} style={{display:'flex',alignItems:'center',gap:6,width:'100%',padding:'6px 8px',background:'transparent',border:'none',color:'#ef4444',fontSize:12,cursor:'pointer',textAlign:'left'}} className="menu-btn">
                              <Trash2 size={12}/> Clear Chat
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{flex:1,overflowY:'auto',padding:10,display:'flex',flexDirection:'column',gap:8}}>
                      {(dmThreads[dmTarget]||[]).length===0 && (
                        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#444',gap:6}}>
                          <Lock size={28} opacity={0.2}/><p style={{margin:0,fontSize:12}}>Start a private conversation</p>
                        </div>
                      )}
                      {(dmThreads[dmTarget]||[]).map((msg,i)=>{
                        const isMe = msg.isMe;
                        const reactions = msg.reactions||{};
                        return (
                          <div key={msg.id||i} className="msg-row msg-enter" style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',gap:4}}>
                            {msg.replyTo && (
                              <div style={{background:'rgba(255,255,255,0.05)',borderLeft:`3px solid ${isMe?'#10b981':'#059669'}`,borderRadius:6,padding:'4px 8px',fontSize:11,color:'#888',maxWidth:'80%'}}>
                                <span style={{color:'#10b981',fontWeight:600}}>{msg.replyTo.username || msg.replyTo.senderName || msg.replyTo.targetName}: </span>{msg.replyTo.message?.slice(0,60)}
                              </div>
                            )}
                            <div style={{display:'flex',alignItems:'center',gap:8,flexDirection:isMe?'row-reverse':'row',maxWidth:'85%'}}>
                              {!isMe && <Avatar name={msg.senderName} size={28}/>}
                              <div style={{display:'flex',flexDirection:'column',gap:2,alignItems:isMe?'flex-end':'flex-start'}}>
                                <div style={{background:isMe?'linear-gradient(135deg,#10b981,#059669)':'rgba(255,255,255,0.06)',padding:'8px 12px',borderRadius:isMe?'14px 14px 4px 14px':'14px 14px 14px 4px',fontSize:14,color:isMe?'#fff':'#ddd',maxWidth:'100%',wordBreak:'break-word'}}>
                                  {msg.message}
                                </div>
                                <div style={{display:'flex',alignItems:'center',gap:6}}>
                                  <span style={{fontSize:10,color:'#444'}}>{formatTime(msg.timestamp)}</span>
                                  <button onClick={()=>setDmReplyTo(msg)} style={{background:'none',border:'none',color:'#555',cursor:'pointer',padding:0,fontSize:10,display:'flex',alignItems:'center',gap:3}}><Reply size={10}/>Reply</button>
                                </div>
                              </div>
                              <div style={{position:'relative', display:'flex', alignItems:'center', opacity: activeReactionMsg === msg.id ? 1 : undefined}} className="react-btn-container">
                                <button className="react-btn" onClick={()=>{ setActiveReactionMsg(activeReactionMsg===msg.id?null:msg.id); setShowAllEmojis(false); }} style={{background:'transparent',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#aaa',padding:2}}>
                                  <SmilePlus size={16}/>
                                </button>
                                {activeReactionMsg === msg.id && (
                                  <div style={{position:'absolute',bottom:'100%',left:isMe?'auto':0,right:isMe?0:'auto',marginBottom:8,background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',borderRadius: showAllEmojis ? 16 : 24,padding:'8px 10px',display:'flex',gap:4,flexWrap:'wrap',width: showAllEmojis ? 280 : 'max-content', maxHeight: showAllEmojis ? 250 : undefined, overflowY: showAllEmojis ? 'auto' : 'visible', boxShadow:'0 8px 24px rgba(0,0,0,0.6)', zIndex:100}}>
                                    {(showAllEmojis ? ALL_EMOJIS : QUICK_EMOJIS).map(em=>(
                                      <button key={em} onClick={(e)=>{e.stopPropagation(); socket.emit('chat:private_reaction',{targetName:dmTarget,messageId:msg.id,emoji:em});setActiveReactionMsg(null); setShowAllEmojis(false);}} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:22,padding:'6px',borderRadius:8,transition:'transform 0.1s',display:'flex',alignItems:'center',justifyContent:'center'}} className="menu-btn" onMouseEnter={(e)=>e.currentTarget.style.transform='scale(1.3)'} onMouseLeave={(e)=>e.currentTarget.style.transform='scale(1)'}>{em}</button>
                                    ))}
                                    {!showAllEmojis && (
                                      <button onClick={(e)=>{e.stopPropagation(); setShowAllEmojis(true);}} style={{background:'rgba(255,255,255,0.1)',border:'none',cursor:'pointer',fontSize:14,width:34,height:34,borderRadius:'50%',marginLeft:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',transition:'background 0.2s'}} onMouseEnter={(e)=>e.currentTarget.style.background='rgba(255,255,255,0.2)'} onMouseLeave={(e)=>e.currentTarget.style.background='rgba(255,255,255,0.1)'}><Plus size={16}/></button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:isMe?'flex-end':'flex-start', marginTop:-4}}>
                              {Object.entries(reactions).filter(([,v])=>v.length>0).map(([emoji,uids])=>(
                                <button key={emoji} onClick={()=>socket.emit('chat:private_reaction',{targetName:dmTarget,messageId:msg.id,emoji})} style={{background:'rgba(255,255,255,0.07)',border:`1px solid ${uids.includes(username)?'#10b981':'rgba(255,255,255,0.1)'}`,borderRadius:12,padding:'2px 8px',cursor:'pointer',fontSize:12,color:'#ddd'}}>
                                  {emoji} {uids.length}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {Object.values(typingUsers).length > 0 && (
                        <div style={{display:'flex',alignItems:'center',gap:8,color:'#666',fontSize:12,padding:'2px 0'}}>
                          <div style={{display:'flex',gap:3}}><span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/></div>
                          {Object.values(typingUsers).join(', ')} {Object.values(typingUsers).length===1?'is':'are'} typing...
                        </div>
                      )}
                      <div ref={messagesEndRef}/>
                    </div>
                    <div style={{padding:'10px 12px',borderTop:'1px solid rgba(255,255,255,0.07)',flexShrink:0}}>
                      {dmReplyTo && (
                        <div style={{padding:'6px 12px',marginBottom:6,background:'rgba(16,185,129,0.08)',borderTop:'1px solid rgba(16,185,129,0.2)',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,color:'#a0aab2'}}>
                          <span><span style={{color:'#10b981',fontWeight:600}}>{dmReplyTo.username || dmReplyTo.senderName || dmReplyTo.targetName}: </span>{dmReplyTo.message?.slice(0,50)}</span>
                          <button onClick={()=>setDmReplyTo(null)} style={{background:'none',border:'none',color:'#666',cursor:'pointer'}}><X size={12}/></button>
                        </div>
                      )}
                      <form onSubmit={sendDmChat} style={{display:'flex',gap:8}}>
                        <input value={dmChatInput} onChange={e=>{handleChatInputChange(e.target.value); setDmChatInput(e.target.value);}} disabled={!isOnline} placeholder={isOnline ? "Private message..." : "User is offline"} style={{flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:'8px 12px',color:'#fff',fontSize:13,outline:'none'}}/>
                        <button type="submit" disabled={!isOnline || !dmChatInput.trim()} style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#10b981,#059669)',border:'none',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:(!isOnline || !dmChatInput.trim())?0.5:1}}>
                          <Send size={14}/>
                        </button>
                      </form>
                    </div>
                  </>
                  );
                })() : (
                  <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#444',gap:8}}>
                    <MessageSquare size={36} opacity={0.2}/><p style={{margin:0,fontSize:13}}>Select a user to start a private chat</p>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
      {renameModalOpen && (
        <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div className="modal-enter" style={{background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,padding:24,width:'100%',maxWidth:360}}>
            <h3 style={{marginTop:0,color:'#fff',fontSize:18,marginBottom:16}}>Rename Room</h3>
            <input value={renameInput} onChange={e=>setRenameInput(e.target.value)} autoFocus style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'10px 14px',color:'#fff',marginBottom:20,fontSize:14,outline:'none'}} placeholder="Enter new name..."/>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={()=>setRenameModalOpen(false)} style={{padding:'8px 16px',background:'transparent',border:'none',color:'#aaa',cursor:'pointer',fontWeight:600}}>Cancel</button>
              <button onClick={()=>{ if(renameInput.trim()){ socket.emit('mod_rename_room',{roomId,newName:renameInput.trim()}); setRenameModalOpen(false); } }} style={{padding:'8px 16px',background:'linear-gradient(135deg,#6366f1,#a855f7)',border:'none',borderRadius:8,color:'#fff',cursor:'pointer',fontWeight:600}}>Save</button>
            </div>
          </div>
        </div>
      )}

      {clearChatModalOpen && (
        <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div className="modal-enter" style={{background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,padding:24,width:'100%',maxWidth:360}}>
            <h3 style={{marginTop:0,color:'#fff',fontSize:18,marginBottom:12}}>Clear Chat</h3>
            <p style={{color:'#aaa',fontSize:14,marginBottom:16,lineHeight:1.4}}>Are you sure you want to clear your chat history with <strong>{clearChatTarget}</strong>?</p>
            <label style={{display:'flex',alignItems:'center',gap:8,color:'#eee',fontSize:13,marginBottom:24,cursor:'pointer'}}>
              <input type="checkbox" checked={clearForBoth} onChange={e=>setClearForBoth(e.target.checked)} style={{accentColor:'#ef4444',cursor:'pointer'}}/>
              Also clear chat history for {clearChatTarget}
            </label>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={()=>setClearChatModalOpen(false)} style={{padding:'8px 16px',background:'transparent',border:'none',color:'#aaa',cursor:'pointer',fontWeight:600}}>Cancel</button>
              <button onClick={()=>{ socket.emit('clear_dm', {roomId, targetUsername:clearChatTarget, clearForBoth}); setClearChatModalOpen(false); setClearForBoth(false); }} style={{padding:'8px 16px',background:'linear-gradient(135deg,#ef4444,#dc2626)',border:'none',borderRadius:8,color:'#fff',cursor:'pointer',fontWeight:600}}>Clear Chat</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Room;





