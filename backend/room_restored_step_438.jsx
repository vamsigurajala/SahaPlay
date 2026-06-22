Created At: 2026-06-18T15:39:38Z
Completed At: 2026-06-18T15:39:39Z
File Path: `file:///c:/Users/KrishnavamsiGurajala/.gemini/antigravity/scratch/watch-together/frontend/src/Room.jsx`
Total Lines: 7061
Total Bytes: 373954
Showing lines 6200 to 6245
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
6200:                             </div>
6201:                             <button
6202:                               onClick={handleStopMedia}
6203:                               className="stay-white"
6204:                               style={{
6205:                                 display: 'block', margin: '16px auto 0', padding: '10px 24px', borderRadius: 20,
6206:                                 background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444',
6207:                                 border: '1px solid rgba(239, 68, 68, 0.5)', cursor: 'pointer',
6208:                                 fontWeight: 600, transition: 'all 0.2s'
6209:                               }}
6210:                               onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.4)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
6211:                               onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.transform = 'scale(1)'; }}
6212:                             >
6213:                               Cancel & Return
6214:                             </button>
6215:                           </div>
6216:                           
6217:                           <style>{`
6218:                             @keyframes prepPulse {
6219:                               0%, 100% { transform: scale(1); opacity: 0.8; filter: drop-shadow(0 0 0px #a855f7); }
6220:                               50% { transform: scale(1.05); opacity: 4; filter: drop-shad
<truncated 304 bytes>
0deg); } }
6224:                           `}</style>
6225:                         </div>
6226:                       )}
6227:                       
6228:                       {/* --- Platform UI Layer (Twitch/Vimeo) --- */}
6229:                       {(mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be') || mediaUrl.includes('twitch.tv') || mediaUrl.includes('vimeo.com')) && (
6230:                         <>
6231:                           {/* Top Navigation & Settings */}
6232:                           <div style={{
6233:                             position: 'absolute', top: 16, left: 16, right: 16, zIndex: 1000,
6234:                             display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
6235:                             pointerEvents: 'none',
6236:                             opacity: uiVisible ? 1 : 0,
6237:                             visibility: uiVisible ? 'visible' : 'hidden',
6238:                             transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.2s'
6239:                           }}>
6240:                             {/* Smart Multi-Platform Home Navigation */}
6241:                             {(mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be') || mediaUrl.includes('twitch.tv') || mediaUrl.includes('vimeo.com')) && (
6242:                               <button
6243:                                 onClick={() => handleNavigateHome(mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be') ? 'youtube' : (mediaUrl.includes('twitch.tv') ? 'twitch' : 'vimeo'))}
6244:                                 title={`${mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be') ? 'YouTube' : (mediaUrl.includes('twitch.tv') ? 'Twitch' : 'Vimeo')} Home`}
6245:                                 style={{
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
