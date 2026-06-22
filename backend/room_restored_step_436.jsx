Created At: 2026-06-18T15:39:36Z
Completed At: 2026-06-18T15:39:36Z
File Path: `file:///c:/Users/KrishnavamsiGurajala/.gemini/antigravity/scratch/watch-together/frontend/src/Room.jsx`
Total Lines: 7061
Total Bytes: 373954
Showing lines 6240 to 6380
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
6240:                             {/* Smart Multi-Platform Home Navigation */}
6241:                             {(mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be') || mediaUrl.includes('twitch.tv') || mediaUrl.includes('vimeo.com')) && (
6242:                               <button
6243:                                 onClick={() => handleNavigateHome(mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be') ? 'youtube' : (mediaUrl.includes('twitch.tv') ? 'twitch' : 'vimeo'))}
6244:                                 title={`${mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be') ? 'YouTube' : (mediaUrl.includes('twitch.tv') ? 'Twitch' : 'Vimeo')} Home`}
6245:                                 style={{
6246:                                   pointerEvents: 'auto',
6247:                                   width: 44, height: 44, borderRadius: '50%',
6248:                                   display: 'flex', alignItems: 'center', justifyContent: 'center',
6249:                                   background: (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be'))
6250:                                     ? 'linear-gradient(135deg, #ef4444 0%, #cc0000 100%)'
6251:                                     : (mediaUrl.includes('twitch.tv') 
6252:                                       ? 'linear-gradient(135deg, #9146ff 0%, #6441a5 100%)' 
6253:                                       : 'linear-gradient(135deg, #00adef 0%, #007bb5 100%)'),
6254:                                   color: '#fff', 
<truncated 7162 bytes>
      {/* Volume */}
6351:                               <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
6352:                                 <button 
6353:                                   onClick={() => setPlayerMuted(!playerMuted)}
6354:                                   className="stay-white"
6355:                                   style={{ background: 'none', border: 'none', cursor: 'pointer' }}
6356:                                 >
6357:                                   {playerMuted || playerVolume === 0 ? <VolumeX size={18} color="#fff" /> : <Volume2 size={18} color="#fff" />}
6358:                                 </button>
6359:                                 <input 
6360:                                   type="range" min="0" max="1" step="0.01"
6361:                                   value={playerVolume}
6362:                                   onChange={e => setPlayerVolume(parseFloat(e.target.value))}
6363:                                   style={{ width: 80, accentColor: mediaUrl.includes('twitch.tv') ? '#9146ff' : '#00adef' }}
6364:                                 />
6365:                               </div>
6366: 
6367:                               <button 
6368:                                 onClick={handleFullscreen}
6369:                                 className="stay-white"
6370:                                 style={{ background: 'none', border: 'none', cursor: 'pointer' }}
6371:                               >
6372:                                 <Maximize size={20} color="#fff" />
6373:                               </button>
6374:                             </div>
6375:                           )}
6376:                         </>
6377:                       )}
6378:                     </div>
6379:                   </>
6380:                 )}
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
