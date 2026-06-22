Created At: 2026-06-18T15:38:53Z
Completed At: 2026-06-18T15:38:53Z
File Path: `file:///c:/Users/KrishnavamsiGurajala/.gemini/antigravity/scratch/watch-together/frontend/src/Room.jsx`
Total Lines: 7062
Total Bytes: 374456
Showing lines 5650 to 5720
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
5650:                         })()}
5651:                       </button>
5652:                     </div>
5653:                   )}
5654: 
5655:                   <div style={{ 
5656:                     position: 'absolute', bottom: 20, right: 20, 
5657:                     display: 'flex', alignItems: 'center', gap: 16, 
5658:                     pointerEvents: (isFullscreen && !showControls) ? 'none' : 'auto',
5659:                     opacity: (isFullscreen && !showControls) ? 0 : 1,
5660:                     transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
5661:                   }}>
5662:                     {/* Redundant Fullscreen/Chat buttons removed - relying on Global Overlay at same position */}
5663:                   </div>
5664: 
5665:                   {/* ── Minimal Single Stop Button (Bottom-Left, auto-hides on idle) ── */}
5666:                   {(isScreensharing || isViewer) && (
5667:                     <div style={{
5668:                       position: 'absolute',
5669:                       bottom: 24,
5670:                       left: 20,
5671:                       zIndex: 100,
5672:                       pointerEvents: showControls ? 'auto' : 'none',
5673:                       opacity: showControls ? 1 : 0,
5674:                       transform: showControls ? 'translateY(0)' : 'translateY(12px)',
5675:                       transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
5676:                     }}>
5677:                       <button
5678:           
<truncated 958 bytes>
ansform = 'scale(1.05)'; }}
5693:                         onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15, 15, 20, 0.8)'; e.currentTarget.style.transform = 'scale(1)'; }}
5694:                       >
5695:                         <div style={{ width: 14, height: 14, background: '#ef4444', borderRadius: 2 }} />
5696:                       </button>
5697:                     </div>
5698:                   )}
5699:                 </div>
5700:                 {/* Removed local play/pause overlay and LIVE badge for cleaner screenshare */}
5701:               </>
5702:             ) : hasMounted && mediaUrl ? (
5703:               <>
5704:                 {isWebIframe(mediaUrl) ? (
5705:                   <div
5706:                     style={{ position: 'absolute', inset: 0, zIndex: 5, borderRadius: 16, overflow: 'hidden' }}
5707:                     onMouseMove={resetControlsTimer}
5708:                     onMouseEnter={resetControlsTimer}
5709:                   >
5710:                     {/* ── iframe content area — no browser toolbar, uses shared bottom control bar ── */}
5711:                     <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
5712:                       <iframe
5713:                         key={mediaUrl}
5714:                         src={mediaUrl}
5715:                         style={{ width: '100%', height: '100%', border: 'none', display: iframeLoading ? 'none' : 'block' }}
5716:                         allow="autoplay; fullscreen; camera; microphone; clipboard-read; clipboard-write; encrypted-media; picture-in-picture; payment"
5717:                         allowFullScreen
5718:                         onLoad={() => {
5719:                           setIframeLoading(false);
5720:                           setIframeError(false);
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
