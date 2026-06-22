Created At: 2026-06-18T15:36:47Z
Completed At: 2026-06-18T15:36:47Z
File Path: `file:///c:/Users/KrishnavamsiGurajala/.gemini/antigravity/scratch/watch-together/frontend/src/Room.jsx`
Total Lines: 7062
Total Bytes: 374456
Showing lines 5700 to 5799
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
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
5721:                           // Page loaded — may still be a block page (Infoblox etc).
5722:                           // Subtle "Page blocked?" hint app
<truncated 4543 bytes>
lex', alignItems: 'center', gap: 6, transition: 'all 0.2s'
5778:                             }}
5779:                             onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.3)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; }}
5780:                             onMouseLeave={e => { e.currentTarget.style.background = 'rgba(10,10,20,0.85)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
5781:                           >
5782:                             <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
5783:                               <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
5784:                               <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
5785:                             </svg>
5786:                             Page blocked? Use Virtual Browser
5787:                           </button>
5788:                         </div>
5789:                       )}
5790:                     </div>
5791: 
5792:                     {/* ── Hyperbeam Virtual Browser overlay — seamless, no badges ──
5793:                         Covers the entire iframe area when a virtual browser session is active.
5794:                         Only a thin exit bar appears on hover at the top — invisible otherwise. */}
5795:                     {hyperbeamSession && (
5796:                       <div
5797:                         style={{
5798:                           position: 'absolute', inset: 0, zIndex: 50,
5799:                           borderRadius: 16, overflow: 'hidden'
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
