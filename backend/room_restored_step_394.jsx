Created At: 2026-06-18T15:36:45Z
Completed At: 2026-06-18T15:36:46Z
File Path: `file:///c:/Users/KrishnavamsiGurajala/.gemini/antigravity/scratch/watch-together/frontend/src/Room.jsx`
Total Lines: 7062
Total Bytes: 374456
Showing lines 5800 to 5883
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
5800:                         }}
5801:                       >
5802:                         <iframe
5803:                           src={hyperbeamSession.embed_url}
5804:                           style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
5805:                           allow="autoplay; camera; microphone; clipboard-read; clipboard-write; encrypted-media; fullscreen"
5806:                           allowFullScreen
5807:                           title="Virtual Browser"
5808:                         />
5809:                         {/* Hover-revealed thin exit bar — invisible unless you move to the top edge */}
5810:                         {isEffectiveHost && (
5811:                           <div
5812:                             className="hb-exit-bar"
5813:                             style={{
5814:                               position: 'absolute', top: 0, left: 0, right: 0,
5815:                               height: 36, zIndex: 60,
5816:                               display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
5817:                               padding: '0 10px',
5818:                               background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
5819:                               opacity: 0, transition: 'opacity 0.25s'
5820:                             }}
5821:                             onMouseEnter={e => e.currentTarget.style.opacity = '1'}
5822:                             onMouseLeave={e => e.currentTarget
<truncated 1761 bytes>
           style={{ 
5851:                         position: 'absolute', inset: 0, 
5852:                         overflow: 'hidden', 
5853:                         borderRadius: 12,
5854:                         willChange: 'transform',
5855:                         background: '#000'
5856:                       }}
5857:                       onMouseMove={resetInactivityTimer}
5858:                       onMouseEnter={() => setUiVisible(true)}
5859:                     >
5860:                       {/* Audio Ducking toast — non-intrusive, visible during fullscreen */}
5861:                       {duckingNotice && (
5862:                         <div style={{
5863:                           position: 'absolute',
5864:                           bottom: 70,
5865:                           left: '50%',
5866:                           transform: 'translateX(-50%)',
5867:                           background: 'rgba(0,0,0,0.72)',
5868:                           color: '#fff',
5869:                           fontSize: '0.72rem',
5870:                           padding: '5px 14px',
5871:                           borderRadius: 999,
5872:                           zIndex: 30,
5873:                           pointerEvents: 'none',
5874:                           whiteSpace: 'nowrap',
5875:                         }}>
5876:                           🔇 Media lowered — {duckingNotice} is speaking
5877:                         </div>
5878:                       )}
5879:                       <div style={{
5880:                         position: 'absolute',
5881:                         inset: (useCustomTwitchControls && mediaUrl.includes('twitch.tv')) || (useCustomVimeoControls && mediaUrl.includes('vimeo.com')) ? '0 0 -40px 0' : 0,
5882:                         zIndex: 0
5883:                       }}>
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
