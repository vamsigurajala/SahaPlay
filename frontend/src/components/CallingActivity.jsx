import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Lock, Maximize2, Minimize2, Grid, VolumeX } from 'lucide-react';
import { getAvatarUrl } from '../utils/avatarUtils';

export default function CallingActivity({
  mode,
  isLight,
  isCamOn,
  isMicOn,
  localCamStream,
  remoteStreams,
  toggleCamera,
  toggleMic,
  username,
  isFullscreen,
  onToggleFullscreen,
  onEndCall,
  onStopCall,
  localAvatarUrl,
  knownAvatars,
}) {
  const [joined, setJoined] = useState(false);
  const localVideoRef = useRef(null);

  // WhatsApp-style main/PiP layout state (1-on-1 video calls only)
  const [mainParticipantId, setMainParticipantId] = useState(null);
  const [pipPos, setPipPos] = useState(null);
  const stageRef = useRef(null);
  const pipDragRef = useRef(null);
  const PIP_W = 112;
  const PIP_H = 152;
  const PIP_MARGIN = 14;

  // Sync state if already streaming
  useEffect(() => {
    if (isCamOn || isMicOn) {
      setJoined(true);
    }
  }, [isCamOn, isMicOn]);

  // Handle local video preview/rendering
  useEffect(() => {
    if (localVideoRef.current && localCamStream && isCamOn && mode === 'video') {
      localVideoRef.current.srcObject = localCamStream;
    }
  }, [localCamStream, isCamOn, mode]);

  const handleJoin = async () => {
    if (mode === 'video') {
      if (!isCamOn) {
        await toggleCamera();
      }
    } else {
      if (!isMicOn) {
        await toggleMic();
      }
    }
    setJoined(true);
  };

  const handleEnd = () => {
    setJoined(false);
    setMainParticipantId(null);
    setPipPos(null);
    onEndCall();
  };

  // Resolve avatar URL (relative → absolute, or already-absolute Supabase URL)
  const resolveAvatar = (path) => {
    if (!path || typeof path !== 'string' || path.trim().length < 5) return null;
    return getAvatarUrl(path);
  };

  // Compile list of participants
  const participants = [];
  if (joined) {
    const localHasVideo = mode === 'video' && isCamOn;
    // TEMP DEBUG — camera visibility re-investigation, remove after diagnosis.
    console.log('[CAM DEBUG] CallingActivity local participant', {
      hasVideo: localHasVideo, hasStream: !!localCamStream, isCamOn, mode
    });
    participants.push({
      id: 'local',
      username: username + ' (You)',
      isLocal: true,
      stream: localCamStream,
      isMuted: !isMicOn,
      hasVideo: localHasVideo,
      avatarUrl: localAvatarUrl || null,
    });
  }

  Object.entries(remoteStreams).forEach(([sid, data]) => {
    const rawAvatar = knownAvatars?.[data.username];
    const remoteHasVideo = mode === 'video' && !!data.stream?.getVideoTracks().length;
    // TEMP DEBUG — camera visibility re-investigation, remove after diagnosis.
    console.log('[CAM DEBUG] CallingActivity remote participant', {
      sid, username: data.username, hasVideo: remoteHasVideo, hasStream: !!data.stream
    });
    participants.push({
      id: sid,
      username: data.username,
      isLocal: false,
      stream: data.stream,
      isMuted: data.isMuted,
      hasVideo: remoteHasVideo,
      avatarUrl: resolveAvatar(rawAvatar),
    });
  });

  const getInitials = (name) => {
    if (!name) return '?';
    return name.slice(0, 2).toUpperCase();
  };

  const cardBg = isLight ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)';
  const borderStyle = '1px solid rgba(255,255,255,0.1)';

  // ── WhatsApp-style layout: 1-on-1 video calls show the other person full-screen
  // with your own camera as a small draggable box that swaps to full-screen on tap ──
  const isDuoVideo = mode === 'video' && participants.length === 2;
  const remoteParticipant = participants.find(p => !p.isLocal);
  const localParticipant = participants.find(p => p.isLocal);
  const effectiveMainId = (mainParticipantId && participants.some(p => p.id === mainParticipantId))
    ? mainParticipantId
    : (remoteParticipant ? remoteParticipant.id : localParticipant?.id);
  const mainParticipant = participants.find(p => p.id === effectiveMainId) || remoteParticipant || localParticipant;
  const pipParticipant = isDuoVideo ? participants.find(p => p.id !== mainParticipant?.id) : null;

  // Default PiP position: top-right corner of the stage
  useEffect(() => {
    if (!isDuoVideo || pipPos) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (rect && rect.width && rect.height) {
      setPipPos({
        x: Math.max(PIP_MARGIN, rect.width - PIP_W - PIP_MARGIN),
        y: PIP_MARGIN,
      });
    }
  }, [isDuoVideo, pipPos]);

  // Keep the PiP box on-screen if the stage is resized (e.g. fullscreen toggle)
  useEffect(() => {
    if (!isDuoVideo) return;
    const handleResize = () => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPipPos(prev => {
        if (!prev) return prev;
        const maxX = Math.max(0, rect.width - PIP_W);
        const maxY = Math.max(0, rect.height - PIP_H);
        return { x: Math.min(prev.x, maxX), y: Math.min(prev.y, maxY) };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isDuoVideo]);

  const handlePipPointerDown = (e) => {
    if (!pipPos) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = stageRef.current?.getBoundingClientRect();
    pipDragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: pipPos.x,
      startY: pipPos.y,
      moved: false,
      rect,
    };
  };

  const handlePipPointerMove = (e) => {
    const ds = pipDragRef.current;
    if (!ds || ds.pointerId !== e.pointerId || !ds.rect) return;
    const dx = e.clientX - ds.startClientX;
    const dy = e.clientY - ds.startClientY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) ds.moved = true;
    if (!ds.moved) return;
    const maxX = Math.max(0, ds.rect.width - PIP_W);
    const maxY = Math.max(0, ds.rect.height - PIP_H);
    setPipPos({
      x: Math.min(maxX, Math.max(0, ds.startX + dx)),
      y: Math.min(maxY, Math.max(0, ds.startY + dy)),
    });
  };

  const handlePipPointerUp = () => {
    const ds = pipDragRef.current;
    pipDragRef.current = null;
    if (ds && !ds.moved && pipParticipant) {
      setMainParticipantId(pipParticipant.id);
    }
  };

  // Shared tile content: video, or avatar + (for remote participants) hidden audio playback
  const renderParticipantMedia = (p) => (
    mode === 'video' && p.hasVideo ? (
      <VideoTileRenderer stream={p.stream} isLocal={p.isLocal} />
    ) : (
      <div className="participant-voice-avatar-wrapper">
        {p.avatarUrl ? (
          <img
            src={p.avatarUrl}
            alt={p.username}
            className={`avatar-img-mid ${!p.isMuted ? 'active-pulse' : ''}`}
          />
        ) : (
          <div className={`avatar-circle-mid ${!p.isMuted ? 'active-pulse' : ''}`} style={{
            background: p.isLocal
              ? 'linear-gradient(135deg, var(--brand-1), var(--brand-2))'
              : 'linear-gradient(135deg, #ec4899, #8b5cf6)'
          }}>
            {getInitials(p.username)}
          </div>
        )}
        {!p.isMuted && (
          <div className="voice-indicator">
            <span className="wave-bar bar-1"></span>
            <span className="wave-bar bar-2"></span>
            <span className="wave-bar bar-3"></span>
          </div>
        )}
        {/* No video element is rendered here, so this is the only way remote audio
            (voice calls, or video calls with the camera off) actually plays. */}
        {!p.isLocal && <AudioRenderer stream={p.stream} />}
      </div>
    )
  );

  const renderOverlayInfo = (p, compact) => (
    <div className={`tile-overlay-info ${compact ? 'compact' : ''}`}>
      <span className="p-name stay-white">{p.username}</span>
      <div className="p-icons">
        {p.isMuted ? (
          <span className="status-badge mute-active"><MicOff size={compact ? 10 : 11} /></span>
        ) : (
          <span className="status-badge mic-active"><Mic size={compact ? 10 : 11} /></span>
        )}
      </div>
    </div>
  );

  return (
    <div className="calling-container">

      {/* E2EE badge — only in lobby, hidden once call is active */}
      {!joined && (
        <div className="calling-e2ee-float">
          <Lock size={12} style={{ marginRight: 4, color: '#10b981' }} />
          <span style={{ color: '#10b981' }}>E2EE Secure</span>
        </div>
      )}

      {/* Main Content Pane */}
      {!joined ? (
        <div className="call-lobby">
          <div className="lobby-preview-wrapper">
            {mode === 'video' ? (
              isCamOn && localCamStream ? (
                <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
              ) : (
                <div className="lobby-placeholder">
                  {localAvatarUrl ? (
                    <img
                      src={localAvatarUrl}
                      alt={username}
                      className="avatar-img-large"
                    />
                  ) : (
                    <div className="avatar-circle-large" style={{ background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))' }}>
                      {getInitials(username)}
                    </div>
                  )}
                  <span className="lobby-sub-text stay-white">Camera is off</span>
                </div>
              )
            ) : (
              <div className="lobby-placeholder">
                {localAvatarUrl ? (
                  <img
                    src={localAvatarUrl}
                    alt={username}
                    className="avatar-img-large pulsing"
                  />
                ) : (
                  <div className="avatar-circle-large pulsing" style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)' }}>
                    {getInitials(username)}
                  </div>
                )}
                <span className="lobby-sub-text stay-white">Voice Call Ready</span>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <h3 className="stay-white" style={{ margin: '0 0 6px 0', fontSize: 18, fontWeight: 800, color: '#fff' }}>Ready to join?</h3>
            <p className="stay-white" style={{ margin: '0 0 20px 0', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>This connection is secure and encrypted end-to-end.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', maxWidth: '92vw' }}>
              <button onClick={handleJoin} className="join-call-btn stay-white">
                Join {mode === 'video' ? 'Video' : 'Voice'} Call
              </button>
              <button
                onClick={onStopCall}
                title="Stop & Choose Activity"
                className="join-call-btn stay-white"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  boxShadow: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <Grid size={16} />
                <span>Exit</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="call-grid-container">
          {isDuoVideo && mainParticipant && pipParticipant ? (
            <div className="call-stage" ref={stageRef}>
              <div className="stage-main-tile" style={{ background: cardBg, border: borderStyle }}>
                {renderParticipantMedia(mainParticipant)}
                {renderOverlayInfo(mainParticipant, false)}
              </div>
              {pipPos && (
                <div
                  className="stage-pip-tile"
                  style={{ left: pipPos.x, top: pipPos.y, background: cardBg, border: borderStyle }}
                  onPointerDown={handlePipPointerDown}
                  onPointerMove={handlePipPointerMove}
                  onPointerUp={handlePipPointerUp}
                  onPointerCancel={handlePipPointerUp}
                  title="Drag to move · Tap to switch"
                >
                  {renderParticipantMedia(pipParticipant)}
                  {renderOverlayInfo(pipParticipant, true)}
                </div>
              )}
            </div>
          ) : (
            <div className={`participants-grid count-${participants.length}`}>
              {participants.map((p) => (
                <div key={p.id} className="participant-tile" style={{ background: cardBg, border: borderStyle }}>
                  {renderParticipantMedia(p)}
                  {renderOverlayInfo(p, false)}
                </div>
              ))}
            </div>
          )}

          {/* Active Call Controls Dock */}
          <div className="call-controls-dock">
            <button
              onClick={toggleMic}
              title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
              className={`dock-btn ${isMicOn ? 'active' : ''}`}
              style={{ background: isMicOn ? 'rgba(var(--brand-1-rgb), 0.18)' : 'rgba(239, 68, 68, 0.18)', color: isMicOn ? 'var(--brand-1-light)' : '#ef4444' }}
            >
              {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            {mode === 'video' && (
              <button
                onClick={toggleCamera}
                title={isCamOn ? 'Turn Camera Off' : 'Turn Camera On'}
                className={`dock-btn ${isCamOn ? 'active' : ''}`}
                style={{ background: isCamOn ? 'rgba(var(--brand-1-rgb), 0.18)' : 'rgba(239, 68, 68, 0.18)', color: isCamOn ? 'var(--brand-1-light)' : '#ef4444' }}
              >
                {isCamOn ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
            )}

            <button
              onClick={handleEnd}
              title="End Call"
              className="dock-btn end-call stay-white"
              style={{ background: '#ef4444', color: '#fff' }}
            >
              <PhoneOff size={20} />
            </button>

            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.12)' }} />

            <button
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              className="dock-btn stay-white"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>

            <button
              onClick={onStopCall}
              title="Stop & Choose Activity"
              className="dock-btn stay-white"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
            >
              <Grid size={18} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        .calling-container {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          font-family: 'Outfit', 'Inter', sans-serif;
          user-select: none;
          overflow: hidden;
          border-radius: 16px;
          background: #0b0f1a;
          color: #fff;
        }

        .calling-e2ee-float {
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          z-index: 150;
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.2);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .call-lobby {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          overflow-y: auto;
        }

        .lobby-preview-wrapper {
          position: relative;
          width: min(320px, 88vw);
          height: min(200px, 30vh, 34dvh);
          min-height: 110px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #131928;
          border: 1px solid rgba(255,255,255,0.08);
        }

        .lobby-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .lobby-sub-text {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.5);
        }

        .avatar-circle-large {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 800;
          color: #fff;
          box-shadow: 0 8px 24px rgba(var(--brand-1-rgb),0.3);
        }

        .avatar-img-large {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          object-fit: cover;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }

        .avatar-circle-large.pulsing,
        .avatar-img-large.pulsing {
          animation: lobby-pulse 2s infinite ease-in-out;
        }

        @keyframes lobby-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 8px 24px rgba(6,182,212,0.25); }
          50% { transform: scale(1.05); box-shadow: 0 12px 30px rgba(6,182,212,0.45); }
        }

        .join-call-btn {
          background: linear-gradient(135deg, var(--brand-1), var(--brand-2));
          border: none;
          color: white;
          padding: 12px 36px;
          border-radius: 12px;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(var(--brand-1-rgb),0.35);
          transition: all 0.2s;
        }

        .join-call-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(var(--brand-1-rgb),0.5);
        }

        .call-grid-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
          padding: 16px;
          overflow: hidden;
        }

        .call-stage {
          position: relative;
          flex: 1;
          min-height: 0;
          border-radius: 14px;
          overflow: hidden;
        }

        .stage-main-tile {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-radius: 14px;
        }

        .stage-pip-tile {
          position: absolute;
          width: 112px;
          height: 152px;
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid rgba(255,255,255,0.55) !important;
          box-shadow: 0 10px 28px rgba(0,0,0,0.55);
          cursor: grab;
          z-index: 30;
          touch-action: none;
          transition: box-shadow 0.15s;
        }

        .stage-pip-tile:active {
          cursor: grabbing;
          box-shadow: 0 14px 34px rgba(0,0,0,0.7);
        }

        .participants-grid {
          flex: 1;
          display: grid;
          gap: 12px;
          overflow-y: auto;
          padding-bottom: 80px;
        }

        .participants-grid.count-1 { grid-template-columns: 1fr; }
        .participants-grid.count-2 { grid-template-columns: repeat(2, 1fr); }
        .participants-grid.count-3, .participants-grid.count-4 { grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(2, 1fr); }
        .participants-grid.count-5, .participants-grid.count-6 { grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr); }
        .participants-grid.count-7, .participants-grid.count-8, .participants-grid.count-9 { grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); }

        .participant-tile {
          position: relative;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          min-height: 140px;
        }

        .participant-voice-avatar-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .avatar-circle-mid {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: white;
          font-size: 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
          transition: all 0.3s;
        }

        .avatar-img-mid {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          object-fit: cover;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          transition: all 0.3s;
        }

        .avatar-circle-mid.active-pulse,
        .avatar-img-mid.active-pulse {
          animation: active-pulse-anim 1.6s infinite ease-in-out;
        }

        @keyframes active-pulse-anim {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(var(--brand-1-rgb),0.4); }
          50% { transform: scale(1.08); box-shadow: 0 0 0 12px rgba(var(--brand-1-rgb),0); }
        }

        .voice-indicator {
          display: flex;
          align-items: flex-end;
          gap: 3px;
          height: 18px;
          margin-top: 10px;
        }

        .wave-bar {
          width: 3px;
          height: 6px;
          background: #10b981;
          border-radius: 3px;
          animation: wave-anim 0.8s infinite ease-in-out alternate;
        }

        .wave-bar.bar-1 { animation-delay: 0.1s; }
        .wave-bar.bar-2 { animation-delay: 0.25s; height: 12px; }
        .wave-bar.bar-3 { animation-delay: 0.4s; }

        @keyframes wave-anim {
          0% { height: 4px; }
          100% { height: 16px; }
        }

        .tile-overlay-info {
          position: absolute;
          bottom: 8px;
          left: 8px;
          right: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(4px);
          padding: 4px 10px;
          border-radius: 8px;
          color: white;
        }

        .tile-overlay-info.compact {
          bottom: 5px;
          left: 5px;
          right: 5px;
          padding: 2px 6px;
        }

        .tile-overlay-info.compact .p-name {
          font-size: 9px;
        }

        .p-name {
          font-size: 11px;
          font-weight: 700;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .status-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 50%;
        }

        .status-badge.mute-active {
          background: rgba(239, 68, 68, 0.25);
          color: #ef4444;
        }

        .status-badge.mic-active {
          background: rgba(16, 185, 129, 0.25);
          color: #10b981;
        }

        .call-controls-dock {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 20px;
          border-radius: 24px;
          z-index: 10;
          background: rgba(15, 23, 42, 0.95);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.08);
          max-width: calc(100vw - 24px);
        }

        .dock-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.22s;
        }

        .dock-btn:hover {
          transform: scale(1.1);
        }

        .dock-btn.end-call:hover {
          transform: scale(1.1) rotate(-10deg);
        }

        .media-unblock-btn {
          position: absolute;
          inset: 0;
          z-index: 25;
          background: rgba(0,0,0,0.6);
          border: none;
          color: #fff !important;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          transition: background 0.2s;
        }

        .media-unblock-btn:hover {
          background: rgba(0,0,0,0.8);
        }

        .media-unblock-btn.compact {
          gap: 0;
          background: rgba(0,0,0,0.55);
        }

        @media (max-width: 640px) {
          .lobby-preview-wrapper {
            width: 100%;
            height: 160px;
          }
          .avatar-circle-large,
          .avatar-img-large {
            width: 64px;
            height: 64px;
            font-size: 24px;
          }
          .call-controls-dock {
            padding: 6px 12px;
            gap: 8px;
          }
          .dock-btn {
            width: 34px;
            height: 34px;
          }
          .participants-grid {
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
}

function VideoTileRenderer({ stream, isLocal }) {
  const videoRef = useRef(null);
  const [playBlocked, setPlayBlocked] = useState(false);

  useEffect(() => {
    if (!videoRef.current || !stream) return;
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(err => {
      console.warn('Video play blocked:', err);
      if (err.name === 'NotAllowedError') setPlayBlocked(true);
    });
  }, [stream]);

  const handleUnblock = (e) => {
    e.stopPropagation();
    videoRef.current?.play().then(() => setPlayBlocked(false)).catch(err => console.error('Manual video play failed:', err));
  };

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: 12
        }}
      />
      {playBlocked && !isLocal && (
        <button onClick={handleUnblock} className="media-unblock-btn" title="Tap to enable audio">
          <VolumeX size={18} />
          <span>Tap for sound</span>
        </button>
      )}
    </>
  );
}

// Plays a remote participant's audio when no <video> element is on-screen for them
// (voice calls, or a video call while their camera is off). Browsers can silently
// refuse to autoplay unmuted audio, so we explicitly call play() and surface a
// tappable fallback if it's blocked rather than failing silently.
function AudioRenderer({ stream }) {
  const audioRef = useRef(null);
  const [playBlocked, setPlayBlocked] = useState(false);

  useEffect(() => {
    if (!audioRef.current || !stream) return;
    audioRef.current.srcObject = stream;
    audioRef.current.play().then(() => setPlayBlocked(false)).catch(err => {
      console.warn('Audio play blocked:', err);
      if (err.name === 'NotAllowedError') setPlayBlocked(true);
    });
  }, [stream]);

  const handleUnblock = (e) => {
    e.stopPropagation();
    audioRef.current?.play().then(() => setPlayBlocked(false)).catch(err => console.error('Manual audio play failed:', err));
  };

  return (
    <>
      <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
      {playBlocked && (
        <button onClick={handleUnblock} className="media-unblock-btn compact" title="Tap to hear audio">
          <VolumeX size={14} />
        </button>
      )}
    </>
  );
}
