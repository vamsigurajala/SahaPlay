Created At: 2026-06-18T15:35:54Z
Completed At: 2026-06-18T15:35:55Z
File Path: `file:///c:/Users/KrishnavamsiGurajala/.gemini/antigravity/scratch/watch-together/frontend/src/Room.jsx`
Total Lines: 7062
Total Bytes: 374456
Showing lines 6560 to 6760
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
<truncated 9612 bytes>
               borderRadius: 8, textAlign: 'left', fontFamily: 'inherit',
6725:                               transition: 'background 0.15s',
6726:                             }}
6727:                             onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
6728:                             onMouseLeave={e => e.currentTarget.style.background = 'none'}
6729:                             onClick={() => { setShowSubtitleSettingsModal(true); setShowSubtitleMenu(false); }}
6730:                           >
6731:                             <Settings size={14} style={{ flexShrink: 0 }} />
6732:                             Subtitle Settings
6733:                           </button>
6734:                         </div>
6735:                       )}
6736:                     </div>
6737:                   )}
6738:  
6739:                   {/* Fullscreen */}
6740:                   <button className="player-ctrl-btn" onClick={handleFullscreen} title="Fullscreen">
6741:                     <Maximize size={18} />
6742:                   </button>
6743:                 </div>
6744:               </div>
6745:             )}
6746:             
6747:             {/* Camera Streams Overlay */}
6748:             <div style={{
6749:               position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
6750:               transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.4s'
6751:             }}>
6752:               {renderCameras(true)}
6753:             </div>
6754: 
6755:             {/* Drag-to-Remove Zone */}
6756:             {isDraggingCam && (
6757:               <div 
6758:                 id="cam-remove-zone"
6759:                 style={{
6760:                   position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
