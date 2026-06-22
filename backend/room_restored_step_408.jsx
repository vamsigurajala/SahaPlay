Created At: 2026-06-18T15:37:03Z
Completed At: 2026-06-18T15:37:04Z
File Path: `file:///c:/Users/KrishnavamsiGurajala/.gemini/antigravity/scratch/watch-together/frontend/src/Room.jsx`
Total Lines: 7062
Total Bytes: 374456
Showing lines 6250 to 6350
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
6250:                                   background: (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be'))
6251:                                     ? 'linear-gradient(135deg, #ef4444 0%, #cc0000 100%)'
6252:                                     : (mediaUrl.includes('twitch.tv') 
6253:                                       ? 'linear-gradient(135deg, #9146ff 0%, #6441a5 100%)' 
6254:                                       : 'linear-gradient(135deg, #00adef 0%, #007bb5 100%)'),
6255:                                   color: '#fff', border: '1px solid rgba(255,255,255,0.2)', 
6256:                                   cursor: 'pointer',
6257:                                   boxShadow: (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be'))
6258:                                     ? '0 8px 24px rgba(204, 0, 0, 0.4)'
6259:                                     : (mediaUrl.includes('twitch.tv') 
6260:                                       ? '0 8px 24px rgba(100, 65, 165, 0.4)' 
6261:                                       : '0 8px 24px rgba(0, 173, 239, 0.4)'),
6262:                                   backdropFilter: uiVisible ? 'blur(8px)' : 'none', 
6263:                                   transition: 'all 0.3s'
6264:                                 }}
6265:                                 onMouseEnter={e => { 
6266:                                   e.currentTarget.style.transform = 'scale(1.1)'; 
6267:                                   e.currentTarget.style.boxShadow = mediaUrl.includes('youtube.com
<truncated 4265 bytes>
,
6324:                               background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)',
6325:                               padding: '40px 24px 20px', zIndex: 10,
6326:                               display: 'flex', alignItems: 'center', gap: 20,
6327:                               opacity: uiVisible ? 1 : 0,
6328:                               transition: 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
6329:                             }}>
6330:                               <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
6331:                                 <button 
6332:                                   onClick={togglePlayPause}
6333:                                   className="stay-white"
6334:                                   style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}
6335:                                   title={isPlaying ? 'Pause' : 'Play'}
6336:                                 >
6337:                                   {isPlaying ? <Pause fill="#fff" size={24} /> : <Play fill="#fff" size={24} />}
6338:                                 </button>
6339:                                 <button 
6340:                                   onClick={handleStopMedia}
6341:                                   className="stay-white"
6342:                                   style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}
6343:                                   title="Stop"
6344:                                 >
6345:                                   <Square fill="#fff" size={20} />
6346:                                 </button>
6347:                               </div>
6348:                               
6349:                               <div style={{ flex: 1 }} />
6350: 
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
