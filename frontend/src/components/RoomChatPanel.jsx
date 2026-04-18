import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import toast from 'react-hot-toast';
import { 
  Users, Send, MessageSquare, Reply, Flag, Lock, 
  X, ChevronLeft, MoreVertical, Edit2, Trash2, MoreHorizontal, SmilePlus, Plus, ChevronDown,
  Image as ImageIcon, Paperclip, FilePlus, Loader2, Play
} from 'lucide-react';
import crownImg from '../assets/crown.svg';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'];

function looksLikeCiphertext(str) {
  if (!str || typeof str !== 'string' || str.length < 20) return false;
  if (str.startsWith('🔒') || str.startsWith('🎥') || str.startsWith('📷')) return false;
  return /^[A-Za-z0-9+/\-_=]{20,}$/.test(str.trim()) && !str.includes(' ');
}

function getInitials(name) { return (name||'?').slice(0,2).toUpperCase(); }
function getAvatarColor(name) {
  const colors = ['#6366f1','#a855f7','#ec4899','#ef4444','#f97316','#10b981','#3b82f6','#06b6d4'];
  let h = 0; for (let c of (name||'')) h = c.charCodeAt(0) + ((h<<5)-h);
  return colors[Math.abs(h) % colors.length];
}
function formatTime(ts) {
  const d = new Date(Number(ts) || Date.now());
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Detect URLs (http/https AND bare domains like .com/.in/.org etc) and make them clickable
const URL_REGEX = /(https?:\/\/[^\s]+|(?:www\.)[^\s]+|[a-zA-Z0-9-]+\.(?:com|in|org|net|io|co|app|dev|xyz|info|me|tv|ai|uk|us|au|ca|gg|to|link|ly|store|online|tech|live)[^\s]*)/g;

function renderMessageText(text, isMe) {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    URL_REGEX.lastIndex = 0;
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer"
          style={{ color: isMe ? 'rgba(255,255,255,0.9)' : '#818cf8', textDecoration: 'underline', wordBreak: 'break-all', cursor: 'pointer', fontWeight: 500 }}
          onClick={e => e.stopPropagation()}
        >{part}</a>
      );
    }
    URL_REGEX.lastIndex = 0;
    return part;
  });
}

function Avatar({ name, size=36, isHost=false, isMuted=false, src, style={} }) {
  const bg = getAvatarColor(name);
  return (
    <div style={{ position:'relative', display:'inline-flex', flexShrink:0, ...style }}>
      <div style={{ width:size, height:size, borderRadius:'50%', background:bg,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:size*0.35, fontWeight:700, color:'#fff', flexShrink:0,
        border: isHost ? '2px solid #FFD700' : '2px solid rgba(255,255,255,0.15)',
        boxShadow: isHost ? '0 0 8px #FFD70055' : 'none',
        overflow:'hidden' }}>
        {src ? (
          <img src={src} alt={name} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none'; e.target.nextSibling.style.display='flex';}} />
        ) : null}
        <span style={{display: src ? 'none' : 'flex'}}>{getInitials(name)}</span>
      </div>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Media Lightbox Ã¢â€â‚¬Ã¢â€â‚¬
function MediaLightbox({ url, type, onClose }) {
  const isImg = type?.startsWith('image/');
  const isVid = type?.startsWith('video/');
  React.useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(6px)'
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.1)', border: 'none',
          borderRadius: '50%', width: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', cursor: 'pointer', zIndex: 1
        }}
      >
        <X size={20} />
      </button>
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
        {isImg ? (
          <img
            src={url}
            alt="Media"
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, display: 'block', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}
          />
        ) : isVid ? (
          <video
            src={url}
            controls
            autoPlay
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, display: 'block', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function RoomChatPanel({ p }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = React.useState(false);
  const [lightbox, setLightbox] = React.useState(null); // { url, type }
  const [activeMessageMenu, setActiveMessageMenu] = React.useState(null);
  const [hoveredMsgId, setHoveredMsgId] = React.useState(null);
  const fileInputRef = React.useRef(null);
  const dmFileInputRef = React.useRef(null);

  const handleFileSelect = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check if it's an image or video
    const isImg = file.type.startsWith('image/');
    const isVid = file.type.startsWith('video/');

    if (!isImg && !isVid) {
      toast.error('Only images and videos are supported');
      return;
    }

    // Permission check for images/videos in rooms
    if (type === 'group' && p.allowMedia === false) {
      toast.error('Sharing media is disabled in this room');
      return;
    }

    setIsUploading(true);
    const objectUrl = URL.createObjectURL(file);
    setIsUploading(true);
    
    try {
      if (type === 'group') {
        p.sendMediaGroupChat(objectUrl, file.type, p.groupReplyTo, file);
        p.setGroupReplyTo(null);
      } else {
        p.sendMediaDmChat(objectUrl, file.type, p.dmReplyTo, file);
        p.setDmReplyTo(null);
      }
      toast.success('Media sent!');
    } catch (err) {
      console.error('Media processing error:', err);
      toast.error('Error handling media');
    } finally {
      setIsUploading(false);
      e.target.value = null;
    }
  };

  const renderMedia = (url, type) => {
    if (!url) return null;
    const isImg = type?.startsWith('image/');
    const isVid = type?.startsWith('video/');

    return (
      <div style={{ marginTop: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: '#000', maxWidth: 220, position: 'relative', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        {isImg ? (
          <img 
            src={url} 
            alt="Shared media" 
            style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} 
            onClick={() => setLightbox({ url, type })}
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = 'none';
              e.target.parentNode.innerHTML = '<div style="color:#666;font-size:11px;padding:16px;text-align:center">Failed to load image</div>';
            }}
          />
        ) : isVid ? (
          <div onClick={() => setLightbox({ url, type })} style={{ position: 'relative', width: '100%', height: 140, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} muted />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(99,102,241,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(99,102,241,0.5)' }}>
                <Play size={18} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 20, color: '#666', fontSize: 11 }}>Unsupported media type</div>
        )}
      </div>
    );
  };

  return (
    <>
      {lightbox && <MediaLightbox url={lightbox.url} type={lightbox.type} onClose={() => setLightbox(null)} />}
      <div id="room-chat-panel" style={{width:340,display:'flex',flexDirection:'column',background:'#111',borderRadius:16,border:'1px solid rgba(255,255,255,0.07)',overflow:'hidden',flexShrink:0}}>
      {p.chatTab === 'list' ? (
        /* ===== CHAT LIST VIEW ===== */
        <>
          <div style={{padding:'12px 14px',borderBottom:'1px solid rgba(255,255,255,0.07)',fontWeight:700,fontSize:14,color:'#ddd',letterSpacing:'0.2px'}}>
            Chats
          </div>
          <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>
            <button onClick={()=>{
              p.setChatTab('group');
              p.chatTabRef.current='group';
              p.setGroupUnread(0);
              // Also clear the global navbar badge for this room
              if (p.onMarkRead) p.onMarkRead(p.roomId);
            }} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'transparent',border:'none',borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:'pointer',color:'#fff',width:'100%',textAlign:'left',position:'relative'}}>
              <div style={{width:40,height:40,borderRadius:12,background:'linear-gradient(135deg,#6366f1,#a855f7)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <Users size={18} color="#fff"/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:'#fff'}}>{p.roomName}</div>
                  {(() => {
                    const lastMsg = p.groupMessages.length > 0 ? p.groupMessages[p.groupMessages.length-1] : null;
                    if (!lastMsg) return t('groupConv', 'Group conversation');
                    return lastMsg.decryptedText || (lastMsg.mediaUrl && !lastMsg.message ? (lastMsg.mediaType?.startsWith('video') ? 'Video' : 'Photo') : (lastMsg.message && looksLikeCiphertext(lastMsg.message) ? '🔒 Encrypted message' : (lastMsg.message?.slice(0,32) || '...')));
                  })()}
              </div>
              {p.groupUnread > 0 && (
                <span style={{width:20,height:20,borderRadius:'50%',background:'#ef4444',color:'#fff',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {p.groupUnread > 9 ? '9+' : p.groupUnread}
                </span>
              )}
            </button>

            {Array.from(new Set([...p.userList.filter(u=>u.username!==p.username).map(u=>u.username), ...Object.keys(p.dmThreads), ...Array.from(p.knownUsers)])).filter(n=>n!==p.username).map(uname => {
              const unread = p.dmUnread[uname]||0;
              const thread = p.dmThreads[uname]||[];
              const last = thread[thread.length-1];
              const uObj = p.userList.find(u=>u.username===uname);
              const isOnline = !!uObj;

              return (
                <button key={uname} onClick={()=>p.openDM(uname)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'transparent',border:'none',borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:'pointer',color:'#fff',width:'100%',textAlign:'left',position:'relative'}}>
                  <div style={{position:'relative',flexShrink:0}}>
                    <Avatar name={uname} size={40} src={uObj?.avatarPath ? `http://127.0.0.1:3001${uObj.avatarPath}` : null}/>
                    <div style={{position:'absolute',bottom:0,right:0,width:11,height:11,borderRadius:'50%',background:isOnline?'#10b981':'#666',border:'2px solid #111'}}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:isOnline?'#fff':'#aaa',display:'flex',alignItems:'center',gap:5}}>
                      {uname}
                      {uObj?.isHost && <img src={crownImg} alt="host" style={{width:12,height:10}}/>}
                    </div>
                    <div style={{fontSize:11,color:'#555',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {last ? (() => {
                        const preview = last.decryptedText || (last.mediaUrl && !last.message ? (last.mediaType?.startsWith('video') ? 'Video' : 'Photo') : (last.message && looksLikeCiphertext(last.message) ? '🔒 Encrypted message' : (last.message?.slice(0,32) || '')));
                        return last.isMe ? `You: ${preview}` : preview;
                      })() : 'Start a private chat'}
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
            {Array.from(new Set([...p.userList.filter(u=>u.username!==p.username).map(u=>u.username), ...Object.keys(p.dmThreads)])).length===0 && (
              <div style={{padding:'20px',color:'#444',fontSize:12,textAlign:'center'}}>No other users in room</div>
            )}
          </div>
        </>
      ) : p.chatTab === 'group' ? (
        /* ===== GROUP CHAT THREAD ===== */
        <>
          <div style={{padding:'8px 14px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
            <button onClick={()=>{p.setChatTab('list');p.chatTabRef.current='list';}} style={{width:30,height:30,borderRadius:8,background:'rgba(255,255,255,0.06)',border:'none',color:'#aaa',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <ChevronLeft size={16}/>
            </button>
            <div style={{width:32,height:32,borderRadius:10,background:'linear-gradient(135deg,#6366f1,#a855f7)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Users size={15} color="#fff"/>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:'#fff'}}>{p.roomName}</div>
              <div style={{fontSize:10,color:'#555'}}>{p.userCount} members online</div>
            </div>
            <div style={{position:'relative', marginLeft:'auto', display:'flex', alignItems:'center'}}>
              <div onClick={e=>{e.stopPropagation(); p.setShowGroupMenu(prev=>!prev);}} style={{background:'none',border:'none',color:'#aaa',cursor:'pointer',padding:4}}><MoreVertical size={16}/></div>
              {p.showGroupMenu && (
                <div style={{position:'absolute',right:0,top:'100%',background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:4,zIndex:100,minWidth:120,boxShadow:'0 4px 12px rgba(0,0,0,0.5)'}} onMouseLeave={()=>p.setShowGroupMenu(false)}>
                  <div onClick={e=>{e.stopPropagation(); p.setShowGroupMenu(false); if(p.isHost){ p.setRenameInput(p.roomName); p.setRenameModalOpen(true); } else toast.error(t('onlyHostRename', 'Only host can rename room'));}} style={{display:'flex',alignItems:'center',gap:6,width:'100%',padding:'6px 8px',background:'transparent',border:'none',color:'#fff',fontSize:12,cursor:'pointer',textAlign:'left'}} className="menu-btn">
                    <Edit2 size={12}/> {t('editName', 'Edit Name')}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div onClick={() => { p.setActiveReactionMsg(null); p.setShowAllEmojis(false); p.setShowGroupEmojiPicker(false); p.setShowDmEmojiPicker(false); setActiveMessageMenu(null); }} style={{flex:1,overflowY:'auto',padding:12,display:'flex',flexDirection:'column',gap:10}}>
            {p.groupMessages.length===0 && <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#444',gap:8}}><MessageSquare size={36} opacity={0.2}/><p style={{margin:0,fontSize:13}}>{t('sayHi', 'No messages yet. Say hi!')}</p></div>}
            {p.groupMessages.map((msg,i)=>{
              const isMe = msg.isMe || (msg.username && msg.username === p.username) || (msg.senderName && msg.senderName === p.username);
              const reactions = msg.reactions||{};
              const resolvedMedia = (p.groupDecryptedMediaUrls?.current && (
                p.groupDecryptedMediaUrls.current[msg.id] ||
                p.groupDecryptedMediaUrls.current[msg.tempId] ||
                p.groupDecryptedMediaUrls.current[String(msg.timestamp)]
              )) || (msg.nonce ? null : msg.mediaUrl);
              const isMediaOnly = !!(msg.mediaType && (!msg.message || !msg.message.trim()) && (!msg.decryptedText || msg.decryptedText === ''));
              
              return (
                <div key={msg.id||i} className="msg-row msg-enter" style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',gap:4}}>
                  {msg.replyTo && (
                    <div style={{background:'rgba(255,255,255,0.05)',borderLeft:'3px solid #6366f1',borderRadius:6,padding:'4px 8px',fontSize:11,color:'#888',maxWidth:'80%'}}>
                      <span style={{color:'#a0aab2',fontWeight:600}}>{msg.replyTo.username}: </span>{(msg.replyTo.message || 'Media').slice(0,60)}
                    </div>
                  )}
                  <div style={{display:'flex',alignItems:'center',gap:8,flexDirection:isMe?'row-reverse':'row',maxWidth:'85%'}}>
                    {!isMe && <span onClick={() => navigate(`/profile/${msg.username}`)} title={`View ${msg.username}'s profile`} style={{cursor:'pointer'}}><Avatar name={msg.username} size={28} src={msg.senderAvatar ? `http://127.0.0.1:3001${msg.senderAvatar}` : null}/></span>}
                    <div style={{display:'flex',flexDirection:'column',gap:2,alignItems:isMe?'flex-end':'flex-start'}}>
                      <div style={{position:'relative', display:'flex', alignItems:'center'}}>
                        <div style={{
                          position: 'relative',
                          background: isMediaOnly ? 'transparent' : (isMe ? 'linear-gradient(135deg,#6366f1,#a855f7)' : 'rgba(255,255,255,0.06)'),
                          padding: isMediaOnly ? '0' : '8px 12px',
                          borderRadius:isMe?'14px 14px 4px 14px':'14px 14px 14px 4px',
                          fontSize:14,
                          color:'#fff',
                          maxWidth:'100%',
                          wordBreak:'break-word'
                        }}
                        onMouseEnter={() => setHoveredMsgId(msg.id||i)}
                        onMouseLeave={() => setHoveredMsgId(null)}>
                          {msg.decryptedText !== null ? (
                            <div style={{whiteSpace:"pre-wrap"}}>{renderMessageText(msg.decryptedText, isMe)}</div>
                          ) : (
                            (msg.message && looksLikeCiphertext(msg.message)) ? (
                              <div style={{whiteSpace:'pre-wrap', opacity:0.5, fontSize:12, display:'flex', alignItems:'center', gap:4}}>🔒 <em>Encrypted message</em></div>
                            ) : (
                              msg.message && <div style={{whiteSpace:"pre-wrap"}}>{renderMessageText(msg.message, isMe)}</div>
                            )
                          )}
                          {renderMedia(resolvedMedia, msg.mediaType)}
                          
                          {(hoveredMsgId === (msg.id||i) || activeMessageMenu === msg.id) && (
                            <div style={{position: 'absolute', top: isMediaOnly ? 4 : 2, right: isMediaOnly ? 4 : 2, zIndex: 20}}>
                              <button onClick={(e)=>{ e.stopPropagation(); setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id); p.setShowAllEmojis(false); p.setActiveReactionMsg(null); }} style={{background:isMediaOnly ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.1)',backdropFilter:'blur(4px)',border:'none',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#fff',padding:2, opacity: 0.8}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.8}>
                                <ChevronDown size={14}/>
                              </button>
                              {activeMessageMenu === msg.id && (
                                 <div style={{position:'absolute', top:'100%', [isMe?'right':'left']:0, marginTop:4, background:'#1a1a2e', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:4, zIndex:100, boxShadow:'0 4px 12px rgba(0,0,0,0.5)', minWidth: 140}} onClick={e => e.stopPropagation()}>
                                   {isMe ? (
                                     <>
                                       <button onClick={(e) => { e.stopPropagation(); p.handleDeleteMessage(msg.id || msg.timestamp, 'global'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:6, width:'100%', background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', padding:'6px 8px', fontSize:12, borderRadius:4, whiteSpace:'nowrap'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,0.1)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                         <Trash2 size={12}/> Unsend
                                       </button>
                                       <button onClick={(e) => { e.stopPropagation(); p.handleDeleteMessage(msg.id || msg.timestamp, 'local'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:6, width:'100%', background:'transparent', border:'none', color:'#aaa', cursor:'pointer', padding:'6px 8px', fontSize:12, borderRadius:4, whiteSpace:'nowrap'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.06)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                         <Trash2 size={12}/> Delete for me
                                       </button>
                                     </>
                                   ) : (
                                     <button onClick={(e) => { e.stopPropagation(); p.handleDeleteMessage(msg.id || msg.timestamp, 'local'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:6, width:'100%', background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', padding:'6px 8px', fontSize:12, borderRadius:4, whiteSpace:'nowrap'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,0.1)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                       <Trash2 size={12}/> Delete
                                     </button>
                                   )}
                                 </div>
                               )}
                            </div>
                          )}
                          
                          {p.activeReactionMsg === msg.id && !p.showAllEmojis && (
                            <div style={{position:'absolute', bottom:'100%', [isMe?'right':'left']:0, marginBottom:8, zIndex:100}}>
                              <div style={{background:'rgba(26,26,46,0.95)',backdropFilter:'blur(4px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:30,padding:'6px 8px',display:'flex',alignItems:'center',gap:6,width:'max-content',boxShadow:'0 8px 24px rgba(0,0,0,0.6)'}}>
                                {QUICK_EMOJIS.map(em=>(
                                  <button key={em} onClick={(e)=>{e.stopPropagation(); p.handleGroupReact(msg.id || msg.timestamp, em);}} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:16,padding:'4px',borderRadius:8,transition:'transform 0.1s',display:'flex',alignItems:'center',justifyContent:'center'}} className="menu-btn" onMouseEnter={(e)=>e.currentTarget.style.transform='scale(1.3)'} onMouseLeave={(e)=>e.currentTarget.style.transform='scale(1)'}>{em}</button>
                                ))}
                                <button onClick={(e)=>{e.stopPropagation(); p.setShowAllEmojis(true);}} style={{background:'rgba(255,255,255,0.1)',border:'none',cursor:'pointer',fontSize:14,width:34,height:34,borderRadius:'50%',marginLeft:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',transition:'background 0.2s'}} onMouseEnter={(e)=>e.currentTarget.style.background='rgba(255,255,255,0.2)'} onMouseLeave={(e)=>e.currentTarget.style.background='rgba(255,255,255,0.1)'}><Plus size={16}/></button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={{position:'absolute', top:'50%', transform:'translateY(-50%)', [isMe?'right':'left']:'100%', padding:isMe?'0 6px 0 0':'0 0 0 6px', opacity: p.activeReactionMsg === msg.id ? 1 : undefined, transition:'opacity 0.2s', zIndex:10, display:'flex', alignItems:'center', gap:2}} className="react-btn-container">
                          <button className="react-btn" onClick={(e)=>{ e.stopPropagation(); p.setActiveReactionMsg(p.activeReactionMsg===msg.id?null:msg.id); p.setShowAllEmojis(false); setActiveMessageMenu(null); }} style={{background:'transparent',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#aaa',padding:2}}>
                            <SmilePlus size={16}/>
                          </button>
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontSize:10,color:'#444'}}>{formatTime(msg.timestamp)}</span>
                        <button onClick={()=>p.setGroupReplyTo(msg)} style={{background:'none',border:'none',color:'#555',cursor:'pointer',padding:0,fontSize:10,display:'flex',alignItems:'center',gap:3}}><Reply size={10}/>Reply</button>
                        <button onClick={()=>p.reportMsg(msg)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.15)',cursor:'pointer',padding:0}}><Flag size={9}/></button>
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:isMe?'flex-end':'flex-start', marginTop:-4}}>
                    {Object.entries(reactions).filter(([,v])=>v.length>0).map(([emoji,uids])=>(
                      <button key={emoji} onClick={()=>p.handleGroupReact(msg.id || msg.timestamp, emoji)} style={{background:'rgba(255,255,255,0.07)',border:`1px solid ${uids.includes(p.username)?'#6366f1':'rgba(255,255,255,0.1)'}`,borderRadius:12,padding:'2px 8px',cursor:'pointer',fontSize:12,color:'#ddd'}}>
                        {emoji} {uids.length}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {Object.values(p.typingUsers).length>0 && (
              <div style={{display:'flex',alignItems:'center',gap:8,color:'#666',fontSize:12}}>
                <div style={{display:'flex',gap:3}}><span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/></div>
                {Object.values(p.typingUsers).join(', ')} {Object.values(p.typingUsers).length===1?'is':'are'} typing...
              </div>
            )}
            <div ref={p.messagesEndRef}/>
          </div>
          {p.groupReplyTo && (
            <div style={{padding:'6px 12px',background:'rgba(99,102,241,0.08)',borderTop:'1px solid rgba(99,102,241,0.2)',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,color:'#a0aab2'}}>
              <span><span style={{color:'#6366f1',fontWeight:600}}>{p.groupReplyTo.username || p.groupReplyTo.senderName}: </span>{p.groupReplyTo.message?.slice(0,50)}</span>
              <button onClick={()=>p.setGroupReplyTo(null)} style={{background:'none',border:'none',color:'#666',cursor:'pointer'}}><X size={12}/></button>
            </div>
          )}
          <div style={{padding:'10px 12px',borderTop:'1px solid rgba(255,255,255,0.07)',flexShrink:0,position:'relative'}}>
            {/* Restriction badges */}
            {(() => {
              const isGuest = localStorage.getItem('watch_is_guest') === 'true';
              const chatLocked = p.chatPerm === 'host' && !p.isHost;
              const showBadges = isGuest || p.isMuted || chatLocked || p.allowLinks === false || p.allowMedia === false;
              if (!showBadges) return null;
              return (
                <div style={{display:'flex',gap:6,marginBottom:6,flexWrap:'wrap'}}>
                  {isGuest && <div style={{fontSize:10,background:'rgba(239,68,68,0.1)',color:'#ef4444',padding:'2px 6px',borderRadius:4,display:'flex',alignItems:'center',gap:3}}><Lock size={10}/> Guests cannot chat</div>}
                  {p.isMuted && !isGuest && <div style={{fontSize:10,background:'rgba(239,68,68,0.1)',color:'#ef4444',padding:'2px 6px',borderRadius:4,display:'flex',alignItems:'center',gap:3}}><Lock size={10}/> You are muted</div>}
                  {chatLocked && !isGuest && <div style={{fontSize:10,background:'rgba(239,68,68,0.1)',color:'#ef4444',padding:'2px 6px',borderRadius:4,display:'flex',alignItems:'center',gap:3}}><Lock size={10}/> Host-only messaging</div>}
                  {p.allowLinks === false && <div style={{fontSize:10,background:'rgba(239,68,68,0.1)',color:'#ef4444',padding:'2px 6px',borderRadius:4,display:'flex',alignItems:'center',gap:3}}><Lock size={10}/> Links Disabled</div>}
                  {p.allowMedia === false && <div style={{fontSize:10,background:'rgba(239,68,68,0.1)',color:'#ef4444',padding:'2px 6px',borderRadius:4,display:'flex',alignItems:'center',gap:3}}><Lock size={10}/> Media Disabled</div>}
                </div>
              );
            })()}
            
            {p.showGroupEmojiPicker && (
              <div style={{position:'absolute', bottom:'100%', left:12, marginBottom:10, zIndex:100, boxShadow:'0 8px 32px rgba(0,0,0,0.6)', borderRadius:10}} onClick={(e) => e.stopPropagation()}>
                <Picker data={data} onEmojiSelect={(e) => p.setGroupChatInput(prev => prev + e.native)} theme="dark" previewPosition="none" searchPosition="none" navPosition="bottom" />
              </div>
            )}
            
            {(() => {
              const isGuest = localStorage.getItem('watch_is_guest') === 'true';
              const chatLocked = p.chatPerm === 'host' && !p.isHost;
              const isDisabled = isGuest || p.isMuted || chatLocked;
              return (
                <form onSubmit={(e) => { 
                    const val = p.groupChatInput.trim();
                    const hasLink = /(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?)/.test(val);
                    const hasImage = /data:image\/[a-zA-Z]*;base64,/.test(val);
                    if (isGuest) { e.preventDefault(); toast.error('Guests cannot chat'); return; }
                    if (chatLocked) { e.preventDefault(); toast.error('Only the host can send messages'); return; }
                    if (hasLink && p.allowLinks === false) { e.preventDefault(); toast.error('Links are not allowed in this room'); return; }
                    if (hasImage && p.allowMedia === false) { e.preventDefault(); toast.error('Media (images/videos) are not allowed in this room'); return; }
                    p.sendGroupChat(e); 
                    p.setShowGroupEmojiPicker(false); 
                  }} style={{display:'flex',gap:8, alignItems:'center'}}>
                <button type="button" onClick={(e) => { e.stopPropagation(); p.setShowGroupEmojiPicker(!p.showGroupEmojiPicker); }} style={{background:'transparent',border:'none',color:'#aaa',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4}}>
                  <SmilePlus size={20}/>
                </button>
                <button type="button" disabled={isUploading || isDisabled || p.allowMedia === false} onClick={() => fileInputRef.current?.click()} style={{background:'transparent',border:'none',color:isUploading?'#6366f1':'#aaa',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4,opacity:isDisabled || p.allowMedia === false ? 0.4 : 1}}>
                  {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18}/>}
                </button>
                <input type="file" ref={fileInputRef} style={{display:'none'}} accept="image/*,video/*" onChange={(e) => handleFileSelect(e, 'group')} />
                <input ref={p.groupInputRef} value={p.groupChatInput} onChange={e=>{p.handleChatInputChange(e.target.value, 'room'); p.setGroupChatInput(e.target.value);}} onFocus={() => p.setShowGroupEmojiPicker(false)} placeholder={isGuest ? 'Guests cannot chat' : t('msgRoomPlace', 'Message the room...')} disabled={isDisabled} style={{flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:'8px 12px',color:'#fff',fontSize:13,outline:'none'}}/>
                <button type="submit" disabled={isDisabled||!p.groupChatInput.trim()} style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#6366f1,#a855f7)',border:'none',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:isDisabled||!p.groupChatInput.trim()?0.5:1}}>
                  <Send size={15}/>
                </button>
              </form>
              );
            })()}
          </div>
        </>
      ) : (
        /* Ã¢â€â‚¬Ã¢â€â‚¬ DM Thread Ã¢â€â‚¬Ã¢â€â‚¬ */
        <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,minHeight:0}}>
            {p.dmTarget ? (() => {
              const uObj = p.userList.find(u=>u.username===p.dmTarget);
              const isOnline = !!uObj;
              return (
              <>
                <div style={{padding:'8px 14px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
                  <button onClick={()=>{p.setChatTab('list');p.chatTabRef.current='list';p.setDmTarget(null);if(p.dmTargetRef)p.dmTargetRef.current=null;}} style={{width:30,height:30,borderRadius:8,background:'rgba(255,255,255,0.06)',border:'none',color:'#aaa',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <ChevronLeft size={16}/>
                  </button>
                  <Avatar name={p.dmTarget} size={32} src={p.userList.find(u=>u.username===p.dmTarget)?.avatarPath ? `http://127.0.0.1:3001${p.userList.find(u=>u.username===p.dmTarget)?.avatarPath}` : null}/>
                  <div>
                    <div
                      onClick={() => navigate(`/profile/${p.dmTarget}`)}
                      title={`View ${p.dmTarget}'s profile`}
                      style={{fontSize:13,fontWeight:700,color:isOnline?'#fff':'#aaa',display:'flex',alignItems:'center',gap:5,cursor:'pointer'}}
                    >
                      {p.dmTarget}
                    </div>
                    <div style={{fontSize:10,color:isOnline?'#10b981':'#666',display:'flex',alignItems:'center',gap:4}}>
                      {isOnline ? <><Lock size={9}/>Online / E2E Encrypted</> : 'Offline'}
                    </div>
                  </div>
                  <div style={{position:'relative', marginLeft:'auto', display:'flex', alignItems:'center'}}>
                    <div onClick={e=>{e.stopPropagation(); p.setShowDmMenu(p.showDmMenu===p.dmTarget?null:p.dmTarget);}} style={{background:'none',border:'none',color:'#aaa',cursor:'pointer',padding:4}}><MoreVertical size={16}/></div>
                    {p.showDmMenu === p.dmTarget && (
                      <div style={{position:'absolute',right:0,top:'100%',background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:4,zIndex:100,minWidth:120,boxShadow:'0 4px 12px rgba(0,0,0,0.5)'}} onMouseLeave={()=>p.setShowDmMenu(null)}>
                        <div onClick={e=>{e.stopPropagation(); p.setShowDmMenu(null); p.setClearChatTarget(p.dmTarget); p.setClearChatModalOpen(true); }} style={{display:'flex',alignItems:'center',gap:6,width:'100%',padding:'6px 8px',background:'transparent',border:'none',color:'#ef4444',fontSize:12,cursor:'pointer',textAlign:'left'}} className="menu-btn">
                          <Trash2 size={12}/> {t('clearChat', 'Clear Chat')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div onClick={() => { p.setActiveReactionMsg(null); p.setShowAllEmojis(false); p.setShowGroupEmojiPicker(false); p.setShowDmEmojiPicker(false); setActiveMessageMenu(null); }} style={{flex:1,overflowY:'auto',padding:10,display:'flex',flexDirection:'column',gap:8}}>
                  {(p.dmThreads[p.dmTarget]||[]).length===0 && (
                    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#444',gap:6}}>
                      <Lock size={28} opacity={0.2}/><p style={{margin:0,fontSize:12}}>Start a private conversation</p>
                    </div>
                  )}
                  {(p.dmThreads[p.dmTarget]||[]).map((msg,i)=>{
                    const isMe = msg.isMe;
                    const reactions = msg.reactions||{};
                    const resolvedMedia = (p.dmDecryptedMediaUrls?.current && (
                      p.dmDecryptedMediaUrls.current[msg.id] ||
                      p.dmDecryptedMediaUrls.current[msg.tempId] ||
                      p.dmDecryptedMediaUrls.current[String(msg.timestamp)]
                    )) || (msg.nonce ? null : msg.mediaUrl);
                    const isMediaOnly = !!(msg.mediaType && (!msg.message || !msg.message.trim()) && (!msg.decryptedText || msg.decryptedText === ''));

                    return (
                      <div key={msg.id||i} className="msg-row msg-enter" style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',gap:4}}>
                        {msg.replyTo && (
                          <div style={{background:'rgba(255,255,255,0.05)',borderLeft:`3px solid ${isMe?'#6366f1':'#a855f7'}`,borderRadius:6,padding:'4px 8px',fontSize:11,color:'#888',maxWidth:'80%'}}>
                            <span style={{color:'#6366f1',fontWeight:600}}>{msg.replyTo.username || msg.replyTo.senderName || msg.replyTo.targetName}: </span>{(msg.replyTo.message || 'Media').slice(0,60)}
                          </div>
                        )}
                        <div style={{display:'flex',alignItems:'center',gap:8,flexDirection:isMe?'row-reverse':'row',maxWidth:'85%'}}>
                          {!isMe && (() => {
                            const uObj = p.userList.find(u => u.username === msg.senderName);
                            const avatarSrc = msg.senderAvatar
                              ? `${p.SOCKET_SERVER_URL}${msg.senderAvatar}`
                              : (uObj?.avatarPath ? `${p.SOCKET_SERVER_URL}${uObj.avatarPath}` : null);
                            return <Avatar name={msg.senderName} size={28} src={avatarSrc}/>;
                          })()}
                          <div style={{display:'flex',flexDirection:'column',gap:2,alignItems:isMe?'flex-end':'flex-start'}}>
                            <div style={{position:'relative', display:'flex', alignItems:'center'}}>
                              <div style={{
                                position: 'relative',
                                background: isMediaOnly ? 'transparent' : (isMe ? 'linear-gradient(135deg,#6366f1,#a855f7)' : 'rgba(255,255,255,0.06)'),
                                padding: isMediaOnly ? '0' : '8px 12px',
                                borderRadius:isMe?'14px 14px 4px 14px':'14px 14px 14px 4px',
                                fontSize:14,
                                color:isMe?'#fff':'#ddd',
                                maxWidth:'100%',
                                wordBreak:'break-word'
                              }}
                              onMouseEnter={() => setHoveredMsgId(msg.id||i)}
                              onMouseLeave={() => setHoveredMsgId(null)}>
                                {msg.decryptedText !== null ? (
                                  <div style={{whiteSpace:"pre-wrap"}}>{renderMessageText(msg.decryptedText, isMe)}</div>
                                ) : (
                                  (msg.message && looksLikeCiphertext(msg.message)) ? (
                                    <div style={{whiteSpace:'pre-wrap', opacity:0.5, fontSize:12, display:'flex', alignItems:'center', gap:4}}>🔒 <em>Encrypted message</em></div>
                                  ) : (
                                    msg.message && <div style={{whiteSpace:"pre-wrap"}}>{renderMessageText(msg.message, isMe)}</div>
                                  )
                                )}
                                {renderMedia(resolvedMedia, msg.mediaType)}
                                
                                {(hoveredMsgId === (msg.id||i) || activeMessageMenu === msg.id) && (
                                  <div style={{position: 'absolute', top: isMediaOnly ? 4 : 2, right: isMediaOnly ? 4 : 2, zIndex: 20}}>
                                    <button onClick={(e)=>{ e.stopPropagation(); setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id); p.setShowAllEmojis(false); p.setActiveReactionMsg(null); }} style={{background: isMediaOnly ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.1)',backdropFilter:'blur(4px)',border:'none',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#fff',padding:2, opacity: 0.8}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.8}>
                                      <ChevronDown size={14}/>
                                    </button>
                                    {activeMessageMenu === msg.id && (
                                 <div style={{position:'absolute', top:'100%', [isMe?'right':'left']:0, marginTop:4, background:'#1a1a2e', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:4, zIndex:100, boxShadow:'0 4px 12px rgba(0,0,0,0.5)', minWidth: 140}} onClick={e => e.stopPropagation()}>
                                   {isMe ? (
                                     <>
                                       <button onClick={(e) => { e.stopPropagation(); p.handleDeleteMessage(msg.id || msg.timestamp, 'global'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:6, width:'100%', background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', padding:'6px 8px', fontSize:12, borderRadius:4, whiteSpace:'nowrap'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,0.1)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                         <Trash2 size={12}/> Unsend
                                       </button>
                                       <button onClick={(e) => { e.stopPropagation(); p.handleDeleteMessage(msg.id || msg.timestamp, 'local'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:6, width:'100%', background:'transparent', border:'none', color:'#aaa', cursor:'pointer', padding:'6px 8px', fontSize:12, borderRadius:4, whiteSpace:'nowrap'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.06)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                         <Trash2 size={12}/> Delete for me
                                       </button>
                                     </>
                                   ) : (
                                     <button onClick={(e) => { e.stopPropagation(); p.handleDeleteMessage(msg.id || msg.timestamp, 'local'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:6, width:'100%', background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', padding:'6px 8px', fontSize:12, borderRadius:4, whiteSpace:'nowrap'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,0.1)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                       <Trash2 size={12}/> Delete
                                     </button>
                                   )}
                                 </div>
                               )}
                                  </div>
                                )}
                                
                                {p.activeReactionMsg === msg.id && !p.showAllEmojis && (
                                  <div style={{position:'absolute', bottom:'100%', [isMe?'right':'left']:0, marginBottom:8, zIndex:100}}>
                                    <div style={{background:'rgba(26,26,46,0.95)',backdropFilter:'blur(4px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:30,padding:'6px 8px',display:'flex',alignItems:'center',gap:6,width:'max-content',boxShadow:'0 8px 24px rgba(0,0,0,0.6)'}}>
                                      {QUICK_EMOJIS.map(em=>(
                                        <button key={em} onClick={(e)=>{e.stopPropagation(); p.handleDmReact(msg.id || msg.timestamp, em);}} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:16,padding:'4px',borderRadius:8,transition:'transform 0.1s',display:'flex',alignItems:'center',justifyContent:'center'}} className="menu-btn" onMouseEnter={(e)=>e.currentTarget.style.transform='scale(1.3)'} onMouseLeave={(e)=>e.currentTarget.style.transform='scale(1)'}>{em}</button>
                                      ))}
                                      <button onClick={(e)=>{e.stopPropagation(); p.setShowAllEmojis(true);}} style={{background:'rgba(255,255,255,0.1)',border:'none',cursor:'pointer',fontSize:14,width:34,height:34,borderRadius:'50%',marginLeft:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',transition:'background 0.2s'}} onMouseEnter={(e)=>e.currentTarget.style.background='rgba(255,255,255,0.2)'} onMouseLeave={(e)=>e.currentTarget.style.background='rgba(255,255,255,0.1)'}><Plus size={16}/></button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div style={{position:'absolute', top:'50%', transform:'translateY(-50%)', [isMe?'right':'left']:'100%', padding:isMe?'0 6px 0 0':'0 0 0 6px', opacity: p.activeReactionMsg === msg.id ? 1 : undefined, transition:'opacity 0.2s', zIndex:10, display:'flex', alignItems:'center', gap:2}} className="react-btn-container">
                                <button className="react-btn" onClick={(e)=>{ e.stopPropagation(); p.setActiveReactionMsg(p.activeReactionMsg===msg.id?null:msg.id); p.setShowAllEmojis(false); setActiveMessageMenu(null); }} style={{background:'transparent',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#aaa',padding:2}}>
                                  <SmilePlus size={16}/>
                                </button>
                              </div>
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:6}}>
                              <span style={{fontSize:10,color:'#444'}}>{formatTime(msg.timestamp)}</span>
                              <button onClick={()=>p.setDmReplyTo(msg)} style={{background:'none',border:'none',color:'#555',cursor:'pointer',padding:0,fontSize:10,display:'flex',alignItems:'center',gap:3}}><Reply size={10}/>Reply</button>
                            </div>
                          </div>
                        </div>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:isMe?'flex-end':'flex-start', marginTop:-4}}>
                          {Object.entries(reactions).filter(([,v])=>v.length>0).map(([emoji,uids])=>(
                            <button key={emoji} onClick={()=>p.handleDmReact(msg.id || msg.timestamp, emoji)} style={{background:'rgba(255,255,255,0.07)',border:`1px solid ${uids.includes(p.username)?'#6366f1':'rgba(255,255,255,0.1)'}`,borderRadius:12,padding:'2px 8px',cursor:'pointer',fontSize:12,color:'#ddd'}}>
                              {emoji} {uids.length}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {Object.values(p.typingUsers).length > 0 && (
                    <div style={{display:'flex',alignItems:'center',gap:8,color:'#666',fontSize:12,padding:'2px 0'}}>
                      <div style={{display:'flex',gap:3}}><span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/></div>
                      {Object.values(p.typingUsers).join(', ')} {Object.values(p.typingUsers).length===1?'is':'are'} typing...
                    </div>
                  )}
                  <div ref={p.messagesEndRef}/>
                </div>
                <div style={{padding:'10px 12px',borderTop:'1px solid rgba(255,255,255,0.07)',flexShrink:0,position:'relative'}}>
                  {p.dmReplyTo && (
                    <div style={{padding:'6px 12px',marginBottom:6,background:'rgba(99,102,241,0.08)',borderTop:'1px solid rgba(99,102,241,0.2)',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,color:'#a0aab2'}}>
                      <span><span style={{color:'#6366f1',fontWeight:600}}>{p.dmReplyTo.username || p.dmReplyTo.senderName || p.dmReplyTo.targetName}: </span>{(p.dmReplyTo.message || 'Media').slice(0,50)}</span>
                      <button onClick={()=>p.setDmReplyTo(null)} style={{background:'none',border:'none',color:'#666',cursor:'pointer'}}><X size={12}/></button>
                    </div>
                  )}
                  
                  {p.showDmEmojiPicker && (
                    <div style={{position:'absolute', bottom:'100%', left:12, marginBottom:10, zIndex:100, boxShadow:'0 8px 32px rgba(0,0,0,0.6)', borderRadius:10}} onClick={(e) => e.stopPropagation()}>
                      <Picker data={data} onEmojiSelect={(e) => p.setDmChatInput(prev => prev + e.native)} theme="dark" previewPosition="none" searchPosition="none" navPosition="bottom" />
                    </div>
                  )}
                  
                  {(() => {
                    const isGuest = localStorage.getItem('watch_is_guest') === 'true';
                    return (
                      <form onSubmit={(e) => { 
                          if (isGuest) { e.preventDefault(); toast.error('Guests cannot chat'); return; }
                          p.sendDmChat(e); 
                          p.setShowDmEmojiPicker(false); 
                        }} style={{display:'flex',gap:8,alignItems:'center'}}>
                        <button type="button" disabled={isGuest} onClick={(e) => { e.stopPropagation(); p.setShowDmEmojiPicker(!p.showDmEmojiPicker); }} style={{background:'transparent',border:'none',color:isGuest?'#555':'#aaa',cursor:isGuest?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4}}>
                          <SmilePlus size={20}/>
                        </button>
                        <button type="button" disabled={isUploading || isGuest} onClick={() => dmFileInputRef.current?.click()} style={{background:'transparent',border:'none',color:isUploading?'#6366f1':(isGuest?'#555':'#aaa'),cursor:isGuest?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4}}>
                          {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18}/>}
                        </button>
                        <input type="file" ref={dmFileInputRef} style={{display:'none'}} accept="image/*,video/*" onChange={(e) => handleFileSelect(e, 'dm')} />
                        <input ref={p.dmInputRef} value={p.dmChatInput} onChange={e=>{p.handleChatInputChange(e.target.value, 'private'); p.setDmChatInput(e.target.value);}} onFocus={() => p.setShowDmEmojiPicker(false)} placeholder={isGuest ? 'Guests cannot chat' : p.userList.some(u => u.username === p.dmTarget) ? "Private message..." : "Offline message..."} disabled={isGuest} style={{flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:'8px 12px',color:'#fff',fontSize:13,outline:'none'}}/>
                        <button type="submit" disabled={!p.dmChatInput.trim() || isGuest} style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#6366f1,#a855f7)',border:'none',color:'#fff',cursor:isGuest?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:(!p.dmChatInput.trim()||isGuest)?0.5:1}}>
                          <Send size={14}/>
                        </button>
                      </form>
                    );
                  })()}
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

      {/* Global Emoji Picker positioned inside chat container */}
      {p.showAllEmojis && p.activeReactionMsg && (
        <div style={{position:'absolute', bottom: 76, right: 16, zIndex: 99999, boxShadow:'0 8px 32px rgba(0,0,0,0.8)', borderRadius:10, transform: 'scale(0.85)', transformOrigin: 'bottom right'}}>
          <Picker data={data} theme="dark" previewPosition="none" searchPosition="none" navPosition="bottom" perLine={6} onEmojiSelect={(emojiObj) => { 
             p.setShowAllEmojis(false);
             if (p.chatTab === 'group') p.handleGroupReact(p.activeReactionMsg, emojiObj.native);
             else p.handleDmReact(p.activeReactionMsg, emojiObj.native);
          }}/>
        </div>
      )}
    </div>
    </>
  );
}







