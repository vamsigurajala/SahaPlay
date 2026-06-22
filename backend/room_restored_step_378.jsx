Created At: 2026-06-18T15:36:24Z
Completed At: 2026-06-18T15:36:25Z
File Path: `file:///c:/Users/KrishnavamsiGurajala/.gemini/antigravity/scratch/watch-together/frontend/src/Room.jsx`
Total Lines: 7062
Total Bytes: 374456
Showing lines 6041 to 6200
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
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
6066:                               allowFullScreen
6067:                         
<truncated 9166 bytes>
  </div>
6183: 
6184:                           <div style={{ textAlign: 'center', maxWidth: 400 }}>
6185:                             <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' }}>Smoothing Experience...</h2>
6186:                             <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 24 }}>Optimizing high-bitrate clusters for buffer-free playback</p>
6187: 
6188:                             <div style={{ width: 300, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden', position: 'relative', margin: '0 auto 16px' }}>
6189:                               <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${prepProgress}%`, background: 'linear-gradient(90deg, #6366f1, #a855f7)', boxShadow: '0 0 12px rgba(168, 85, 247, 0.6)', transition: 'width 1s linear' }} />
6190:                             </div>
6191: 
6192:                             <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)' }}>
6193:                               {bufferedSeconds > 0 ? (
6194:                                 <>
6195:                                   <span style={{ color: '#a855f7', fontWeight: 800 }}>{bufferedSeconds}s / 25s</span>
6196:                                   <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>buffered in 'Fueling' stage</span>
6197:                                 </>
6198:                               ) : (
6199:                                 <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>OPTIMIZING CONNECTION...</span>
6200:                               )}
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
