import React from 'react';
import { useTranslation } from 'react-i18next';

export default function RoomModals({
  renameModalOpen,
  setRenameModalOpen,
  renameInput,
  setRenameInput,
  socket,
  roomId,
  clearChatModalOpen,
  setClearChatModalOpen,
  clearChatTarget,
  clearForBoth,
  setClearForBoth
}) {
  const { t } = useTranslation();

  return (
    <>
      {renameModalOpen && (
        <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div className="modal-enter" style={{background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,padding:24,width:'100%',maxWidth:360}}>
            <h3 style={{marginTop:0,color:'#fff',fontSize:18,marginBottom:16}}>Rename Room</h3>
            <input 
              value={renameInput} 
              onChange={e=>setRenameInput(e.target.value)} 
              autoFocus 
              style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'10px 14px',color:'#fff',marginBottom:20,fontSize:14,outline:'none'}} 
              placeholder="Enter new name..."
            />
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button 
                onClick={()=>setRenameModalOpen(false)} 
                style={{padding:'8px 16px',background:'transparent',border:'none',color:'#aaa',cursor:'pointer',fontWeight:600}}>
                Cancel
              </button>
              <button 
                onClick={()=>{ 
                  if(renameInput.trim()){ 
                    socket.emit('mod_rename_room',{roomId,newName:renameInput.trim()}); 
                    setRenameModalOpen(false); 
                  } 
                }} 
                style={{padding:'8px 16px',background:'linear-gradient(135deg,#6366f1,#a855f7)',border:'none',borderRadius:8,color:'#fff',cursor:'pointer',fontWeight:600}}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {clearChatModalOpen && (
        <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div className="modal-enter" style={{background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,padding:24,width:'100%',maxWidth:360}}>
            <h3 style={{marginTop:0,color:'#fff',fontSize:18,marginBottom:12}}>{t('clearChat', 'Clear Chat')}</h3>
            <p style={{color:'#aaa',fontSize:14,marginBottom:16,lineHeight:1.4}}>
              Are you sure you want to clear your chat history with <strong>{clearChatTarget}</strong>?
            </p>
            <label style={{display:'flex',alignItems:'center',gap:8,color:'#eee',fontSize:13,marginBottom:24,cursor:'pointer'}}>
              <input 
                type="checkbox" 
                checked={clearForBoth} 
                onChange={e=>setClearForBoth(e.target.checked)} 
                style={{accentColor:'#ef4444',cursor:'pointer'}}
              />
              Also clear chat history for {clearChatTarget}
            </label>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button 
                onClick={()=>setClearChatModalOpen(false)} 
                style={{padding:'8px 16px',background:'transparent',border:'none',color:'#aaa',cursor:'pointer',fontWeight:600}}>
                Cancel
              </button>
              <button 
                onClick={()=>{ 
                  socket.emit('clear_dm', {targetUsername:clearChatTarget, clearForBoth}); 
                  setClearChatModalOpen(false); 
                  setClearForBoth(false); 
                }} 
                style={{padding:'8px 16px',background:'linear-gradient(135deg,#ef4444,#dc2626)',border:'none',borderRadius:8,color:'#fff',cursor:'pointer',fontWeight:600}}>
                {t('clearChat', 'Clear Chat')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
