Created At: 2026-06-18T14:49:28Z
Completed At: 2026-06-18T14:49:29Z
File Path: `file:///c:/Users/KrishnavamsiGurajala/.gemini/antigravity/scratch/watch-together/frontend/src/Room.jsx`
Total Lines: 7085
Total Bytes: 375980
Showing lines 5730 to 5870
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
5730:                   )}
5731:                 </div>
5732:                 {/* Removed local play/pause overlay and LIVE badge for cleaner screenshare */}
5733:               </>
5734:             ) : hasMounted && mediaUrl ? (
5735:               <>
5736:                 {isWebIframe(mediaUrl) ? (
5737:                   <div
5738:                     style={{ position: 'absolute', inset: 0, zIndex: 5, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
5739:                     onMouseMove={resetControlsTimer}
5740:                     onMouseEnter={resetControlsTimer}
5741:                   >
5742:                     {/* ── Browser toolbar ── */}
5743:                     <div style={{
5744:                       flexShrink: 0, height: 46,
5745:                       background: 'rgba(10,10,18,0.97)', backdropFilter: 'blur(12px)',
5746:                       borderBottom: '1px solid rgba(255,255,255,0.08)',
5747:                       display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px',
5748:                       zIndex: 20
5749:                     }}>
5750:                       {/* Globe icon */}
5751:                       <div style={{ color: hbSessionId ? '#a855f7' : '#6366f1', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
5752:                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
5753:                           <circle 
<truncated 7126 bytes>
                             <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.15)' }} />
5855:                             <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid transparent', borderTopColor: '#6366f1', borderRightColor: '#a855f7', animation: 'spin 0.9s linear infinite' }} />
5856:                             <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#a855f7', animation: 'spin 1.4s linear infinite reverse' }} />
5857:                           </div>
5858:                           <div style={{ textAlign: 'center' }}>
5859:                             <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{hbSessionId ? 'Starting virtual browser…' : 'Loading page…'}</div>
5860:                             <div style={{ color: '#6366f1', fontSize: 13 }}>{(browserDisplayUrl || mediaUrl).length > 55 ? (browserDisplayUrl || mediaUrl).slice(0,55)+'…' : (browserDisplayUrl || mediaUrl)}</div>
5861:                           </div>
5862:                           <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
5863:                             {[0,1,2].map(i => (
5864:                               <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1', animation: `bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
5865:                             ))}
5866:                           </div>
5867:                           <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes bounce{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
5868:                         </div>
5869:                       )}
5870:                     </div>
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
