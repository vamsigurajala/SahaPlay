Created At: 2026-06-18T15:35:48Z
Completed At: 2026-06-18T15:35:48Z
File Path: `file:///c:/Users/KrishnavamsiGurajala/.gemini/antigravity/scratch/watch-together/frontend/src/Room.jsx`
Total Lines: 7062
Total Bytes: 374456
Showing lines 5884 to 6020
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
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
5908:                                 if (!isEffectiveHost) return;
5909:                                 if (Date.now() - lastExternalUpdate.current < 500) return;
5910:                                 socket.emit('play', { roomId: (roomId || '').toLowerCase(), currentTime: e.target.currentTime });
5911:  
<truncated 5944 bytes>
                 width="100%" height="100%"
5997:                             controls={(mediaUrl.includes('twitch.tv') && !useCustomTwitchControls) || (mediaUrl.includes('vimeo.com') && !useCustomVimeoControls) || (!mediaUrl.includes('twitch.tv') && !mediaUrl.includes('vimeo.com') && isEmbedPlatform(mediaUrl))}
5998:                             playing={isPreparing || (isPlaying && !isPreparing)}
5999:                             volume={isPreparing ? 0 : playerVolume}
6000:                             muted={isPreparing || playerMuted}
6001:                             onPlay={handlePlay}
6002:                             onPause={handlePause}
6003:                             onReady={() => {
6004:                               // Playback started — clear the failure detection timer
6005:                               clearTimeout(loadTimeoutRef.current);
6006:                               setLoadFailed(false);
6007:                             }}
6008:                             onBuffer={() => !isPreparing && console.log('Buffering...')}
6009:                             onSeek={handleSeek}
6010:                             onProgress={({ playedSeconds }) => {
6011:                               if (Math.floor(playedSeconds) !== Math.floor(currentTime)) {
6012:                                 setCurrentTime(playedSeconds);
6013:                               }
6014:                             }}
6015:                             progressInterval={1000}
6016:                             onDuration={setDuration}
6017:                             onError={(e) => {
6018:                               console.error('[ReactPlayer] Error:', e);
6019:                               clearTimeout(loadTimeoutRef.current);
6020:                               // Show fallback overlay instead of stopping media
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
