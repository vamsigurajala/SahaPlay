Created At: 2026-06-18T15:39:33Z
Completed At: 2026-06-18T15:39:33Z
File Path: `file:///c:/Users/KrishnavamsiGurajala/.gemini/antigravity/scratch/watch-together/frontend/src/Room.jsx`
Total Lines: 7061
Total Bytes: 373954
Showing lines 6540 to 6750
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
6540:             )}
6541: 
6542:             {/* Custom Control Bar Ã¢â‚¬â€ visible ONLY for Direct Videos (Hidden for WebRTC to avoid overlapping native streaming controls) */}
6543:             {/* Bottom control bar — shown for direct video AND web-iframe/HB URLs */}
6544:             {!isTvMode && (hasMounted && mediaUrl) && !(isScreensharing || isViewer) && !((mediaUrl.includes('twitch.tv') && useCustomTwitchControls) || (mediaUrl.includes('vimeo.com') && useCustomVimeoControls)) && (
6545:               <div className="gcw-force-dark" style={{
6546:                 position: 'absolute', bottom: isEmbedPlatform(mediaUrl) ? 46 : 0, left: 0, right: 0,
6547:                 // zIndex 25: above iframe container (5) and HB overlay (50 handled separately)
6548:                 zIndex: 25,
6549:                 background: isEmbedPlatform(mediaUrl) ? 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)' : 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
6550:                 padding: '24px 14px 10px',
6551:                 // For web iframes: always show (iframe captures hover events so showControls never triggers)
6552:                 opacity: isWebIframe(mediaUrl) ? 1 : (showControls ? 1 : 0),
6553:                 transition: 'opacity 0.3s ease',
6554:                 pointerEvents: 'none',
6555:                 borderRadius: isEmbedPlatform(mediaUrl) ? '0' : '0 0 16px 16px'
6556:               }}>
6557:                 {/* Scrubber — hidden for web
<truncated 10925 bytes>
                   style={{
6719:                               display: 'flex', alignItems: 'center', gap: 10,
6720:                               width: '100%', padding: '9px 12px',
6721:                               background: 'none', border: 'none',
6722:                               color: '#d1d5db', fontSize: 13, cursor: 'pointer',
6723:                               borderRadius: 8, textAlign: 'left', fontFamily: 'inherit',
6724:                               transition: 'background 0.15s',
6725:                             }}
6726:                             onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
6727:                             onMouseLeave={e => e.currentTarget.style.background = 'none'}
6728:                             onClick={() => { setShowSubtitleSettingsModal(true); setShowSubtitleMenu(false); }}
6729:                           >
6730:                             <Settings size={14} style={{ flexShrink: 0 }} />
6731:                             Subtitle Settings
6732:                           </button>
6733:                         </div>
6734:                       )}
6735:                     </div>
6736:                   )}
6737:  
6738:                   {/* Fullscreen */}
6739:                   <button className="player-ctrl-btn" onClick={handleFullscreen} title="Fullscreen">
6740:                     <Maximize size={18} />
6741:                   </button>
6742:                 </div>
6743:               </div>
6744:             )}
6745:             
6746:             {/* Camera Streams Overlay */}
6747:             <div style={{
6748:               position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
6749:               transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.4s'
6750:             }}>
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
