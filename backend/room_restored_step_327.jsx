Created At: 2026-06-18T15:29:32Z
Completed At: 2026-06-18T15:29:33Z
File Path: `file:///c:/Users/KrishnavamsiGurajala/.gemini/antigravity/scratch/watch-together/frontend/src/Room.jsx`
Total Lines: 7075
Total Bytes: 375139
Showing lines 5574 to 5610
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
5574:                       }}>{Math.min(totalUnread, 99)}</span>
5575:                     )}
5576:                   </div>
5577:                 )}
5578: 
5579:                 {/* No Cloud Browser button here — shown automatically only when page fails to load */}
5580: 
5581:                 {/* Fullscreen Toggle / Exit */}
5582:                 {!isLocalStream && (
5583:                   <button 
5584:                     className="player-ctrl-btn stay-white" 
5585:                     onClick={handleFullscreen} 
5586:                     title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
5587:                     style={{ 
5588:                       width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
5589:                       background: 'rgba(15,15,20,0.8)', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', 
5590:                       backdropFilter: 'blur(12px)', transition: 'all 0.2s', cursor: 'pointer'
5591:                     }}
5592:                     onMouseEnter={e => { e.currentTarget.style.background = 'rgba(25,25,35,0.9)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
5593:                     onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15,15,20,0.8)'; e.currentTarget.style.transform = 'scale(1)'; }}
5594:                   >
5595:                     {isFullscreen ? <X size={20} color="#fff" /> : <Maximize size={20} color="#fff" />}
5596:                   </button>
5597:                 )}
5598:               </div>
5599:             </div>
5600:             )}
5601: 
5602:             {!isTvMode && room?.settings?.playerCustomName && (isScreensharing || isViewer) && !isFullscreen && (
5603:               <div style={{ 
5604:                 position: 'absolute', top: 12, left: 12, zIndex: 10, 
5605:                 background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', 
5606:                 padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, 
5607:                 color: '#fff', border: '1px solid rgba(255,255,255,0.1)', 
5608:                 pointerEvents: 'none',
5609:                 opacity: (showPlayerBranding && showControls) ? 1 : 0,
5610:                 display: (showPlayerBranding && showControls) ? 'block' : 'none',
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
