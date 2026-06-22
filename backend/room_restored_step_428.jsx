Created At: 2026-06-18T15:39:22Z
Completed At: 2026-06-18T15:39:23Z
File Path: `file:///c:/Users/KrishnavamsiGurajala/.gemini/antigravity/scratch/watch-together/frontend/src/Room.jsx`
Total Lines: 7062
Total Bytes: 374456
Showing lines 5880 to 6065
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
5880:                         position: 'absolute',
5881:                         inset: (useCustomTwitchControls && mediaUrl.includes('twitch.tv')) || (useCustomVimeoControls && mediaUrl.includes('vimeo.com')) ? '0 0 -40px 0' : 0,
5882:                         zIndex: 0
5883:                       }}>
5884:                         {(() => {
5885:                           console.log('[PLAYER] mediaUrl:', mediaUrl, 
5886:                             'isLocalStream:', isLocalStream,
5887:                             'isPreparing:', isPreparing);
5888:                           return null;
5889:                         })()}
5890:                         {isLocalStream ? (
5891:                           <>
5892:                             <video
5893:                               key={mediaUrl}
5894:                               ref={localVideoRef}
5895:                               src={mediaUrl}
5896:                               autoPlay
5897:                               muted={playerMuted}
5898:                               playsInline
5899:                               width="100%"
5900:                               height="100%"
5901:                               style={{
5902:                                 background: '#000',
5903:                                 display: 'block',
5904:                                 zIndex: 9999,
5905:                                 position: 'relative'
5906:                               }}
5907:                               onPlay={(e) => {
590
<truncated 8797 bytes>
   maxMaxBufferLength: 120,
6034:                                   startLevel: -1,
6035:                                   enableWorker: true
6036:                                 }
6037:                               },
6038:                               youtube: {
6039:                                 playerVars: {
6040:                                   modestbranding: 1,
6041:                                   rel: 0,
6042:                                   playsinline: 1,
6043:                                   origin: window.location.origin
6044:                                 }
6045:                               },
6046:                               twitch: {
6047:                                 options: {
6048:                                   parent: [window.location.hostname]
6049:                                 }
6050:                               }
6051:                             }}
6052:                           />
6053:                         )}
6054: 
6055:                         {/* ─── Hyperbeam Cloud Browser iframe — renders when session is active ─── */}
6056:                         {hyperbeamSession && (
6057:                           <div style={{
6058:                             position: 'absolute', inset: 0, zIndex: 30,
6059:                             borderRadius: 12, overflow: 'hidden',
6060:                             display: 'flex', flexDirection: 'column'
6061:                           }}>
6062:                             <iframe
6063:                               src={hyperbeamSession.embed_url}
6064:                               style={{ flex: 1, width: '100%', border: 'none', display: 'block' }}
6065:                               allow="autoplay; camera; microphone; clipboard-read; clipboard-write; encrypted-media; fullscreen"
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
