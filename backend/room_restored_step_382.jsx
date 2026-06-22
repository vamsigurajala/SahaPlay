Created At: 2026-06-18T15:36:28Z
Completed At: 2026-06-18T15:36:28Z
File Path: `file:///c:/Users/KrishnavamsiGurajala/.gemini/antigravity/scratch/watch-together/frontend/src/Room.jsx`
Total Lines: 7062
Total Bytes: 374456
Showing lines 6400 to 6559
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
6400:                   width: '240px',
6401:                   height: '8px',
6402:                   background: 'rgba(255,255,255,0.2)',
6403:                   borderRadius: '999px',
6404:                   overflow: 'hidden'
6405:                 }}>
6406:                   <div style={{
6407:                     width: `${streamPending.progress || 0}%`,
6408:                     height: '100%',
6409:                     background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
6410:                     borderRadius: '999px',
6411:                     transition: 'width 0.3s ease'
6412:                   }} />
6413:                 </div>
6414:                 <div style={{ 
6415:                   fontSize: '0.9rem', 
6416:                   color: '#9ca3af' 
6417:                 }}>
6418:                   {streamPending.progress || 0}% — Video will play when ready
6419:                 </div>
6420:               </div>
6421:             ) : uploadState.isUploading ? (
6422:               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 16 }}>
6423:                 <div style={{ fontSize: '2.5rem' }}>📤</div>
6424:                 <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Uploading video...</div>
6425:                 <div style={{
6426:                   width: 220, height: 8,
6427:                   background: 'rgba(255,255,255,0.15)', borderRadius: 999, overflow: 'hidden'
6428:    
<truncated 6651 bytes>
der: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap'
6538:               }}>
6539:                 Host is loading: {streamPending.filename}
6540:               </div>
6541:             )}
6542: 
6543:             {/* Custom Control Bar Ã¢â‚¬â€ visible ONLY for Direct Videos (Hidden for WebRTC to avoid overlapping native streaming controls) */}
6544:             {/* Bottom control bar — shown for direct video AND web-iframe/HB URLs */}
6545:             {!isTvMode && (hasMounted && mediaUrl) && !(isScreensharing || isViewer) && !((mediaUrl.includes('twitch.tv') && useCustomTwitchControls) || (mediaUrl.includes('vimeo.com') && useCustomVimeoControls)) && (
6546:               <div className="gcw-force-dark" style={{
6547:                 position: 'absolute', bottom: isEmbedPlatform(mediaUrl) ? 46 : 0, left: 0, right: 0,
6548:                 // zIndex 25: above iframe container (5) and HB overlay (50 handled separately)
6549:                 zIndex: 25,
6550:                 background: isEmbedPlatform(mediaUrl) ? 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)' : 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
6551:                 padding: '24px 14px 10px',
6552:                 // For web iframes: always show (iframe captures hover events so showControls never triggers)
6553:                 opacity: isWebIframe(mediaUrl) ? 1 : (showControls ? 1 : 0),
6554:                 transition: 'opacity 0.3s ease',
6555:                 pointerEvents: 'none',
6556:                 borderRadius: isEmbedPlatform(mediaUrl) ? '0' : '0 0 16px 16px'
6557:               }}>
6558:                 {/* Scrubber — hidden for web iframes (no duration) and WebRTC */}
6559:                 {!(isScreensharing || isViewer) && !isWebIframe(mediaUrl) && (
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
