Created At: 2026-06-18T15:36:26Z
Completed At: 2026-06-18T15:36:26Z
File Path: `file:///c:/Users/KrishnavamsiGurajala/.gemini/antigravity/scratch/watch-together/frontend/src/Room.jsx`
Total Lines: 7062
Total Bytes: 374456
Showing lines 6560 to 6800
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
6560:                   <div style={{ position: 'relative', height: 4, marginBottom: 10, display: 'flex', alignItems: 'center', pointerEvents: showControls ? 'auto' : 'none' }}>
6561:                     <div style={{
6562:                       position: 'absolute', left: 0, height: 4, borderRadius: 2,
6563:                       width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
6564:                       background: 'linear-gradient(90deg,#6366f1,#a855f7)',
6565:                       pointerEvents: 'none', zIndex: 1
6566:                     }} />
6567:                     <div style={{
6568:                       position: 'absolute', left: 0, right: 0, height: 4,
6569:                       borderRadius: 2, background: 'rgba(255,255,255,0.15)', zIndex: 0
6570:                     }} />
6571:                     <input
6572:                       type="range" className="player-scrubber"
6573:                       min={0} max={duration || 100} step={0.1}
6574:                       value={currentTime}
6575:                       onChange={handleScrubberChange}
6576:                       style={{
6577:                         position: 'absolute', inset: 0, zIndex: 2, width: '100%',
6578:                         '--track-fill': `${duration > 0 ? (currentTime / duration) * 100 : 0}%`
6579:                       }}
6580:                     />
6581:                   </div>
6582:                 )}
6583:                 {/* Controls row — always interactive for web iframes (iframe captures 
<truncated 12187 bytes>
5,255,255,0.2)'}`,
6770:                   display: 'flex', alignItems: 'center', justifyContent: 'center',
6771:                   color: '#fff', boxShadow: isOverRemoveZone ? '0 0 30px rgba(239,68,68,0.5)' : '0 10px 30px rgba(0,0,0,0.3)',
6772:                   transition: 'all 0.2s'
6773:                 }}>
6774:                   <X size={isOverRemoveZone ? 32 : 24} strokeWidth={2.5} color="#fff" />
6775:                 </div>
6776:                 <span style={{ 
6777:                   color: isOverRemoveZone ? '#ef4444' : '#fff', fontSize: 11, fontWeight: 800, 
6778:                   textTransform: 'uppercase', letterSpacing: '0.05em', 
6779:                   textShadow: '0 2px 4px rgba(0,0,0,0.5)'
6780:                 }}>
6781:                   {isOverRemoveZone ? 'Drop to Remove' : 'Drag here to hide'}
6782:                 </span>
6783:               </div>
6784:             )}
6785: 
6786:             {/* Unhide Videos Bubble */}
6787:             {hiddenCams.size > 0 && !isTvMode && (
6788:               <button
6789:                 onClick={() => {
6790:                   setHiddenCams(new Set());
6791:                   toast.success('All videos restored', { icon: '👁️' });
6792:                 }}
6793:                 style={{
6794:                   position: 'absolute', top: 20, right: 20,
6795:                   zIndex: 1100, padding: '8px 16px', borderRadius: 12,
6796:                   background: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 15, 15, 0.85)',
6797:                   color: isLight ? '#000' : '#fff',
6798:                   border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.15)',
6799:                   backdropFilter: 'blur(10px)',
6800:                   display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
