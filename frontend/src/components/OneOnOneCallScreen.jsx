// OneOnOneCallScreen.jsx — WhatsApp-style active-call screen for private
// DM calls (CallContext.jsx / GlobalCallOverlay.jsx), covering both the
// original 1:1 case and a call grown via "Add to call". Deliberately a
// separate component from CallingActivity.jsx rather than a rework of it:
// that component is also reused by Room.jsx for the room's own
// multi-participant camera calls, and this screen's behavior (avatar-only
// by default, tap anywhere to hide/show all chrome together — including the
// Add button, speaker/Bluetooth picker, PiP-tap-to-swap, camera flip
// without a black-frame gap) is specific to this feature, built standalone
// to avoid risking a regression in the already-shipped room group-call UI.
//
// Exactly one remote participant (the common case) keeps the original
// polished main-stage/PiP-swap layout. Two or more (an "Add to call" grew
// it past 1:1) switches to an equal-tile grid, everyone included — the
// mesh model (CallContext.jsx) means every tile here really is a direct,
// independently end-to-end-encrypted connection to that person.
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, Bluetooth, SwitchCamera, UserPlus } from 'lucide-react';
import { getInitials } from '../utils/avatarUtils';
import AddToCallSheet from './AddToCallSheet';

function Avatar({ url, name, size, pulsing }) {
  return (
    <div
      className={pulsing ? 'ooc-avatar-pulse' : ''}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: url ? undefined : 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
        overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
      }}
    >
      {url ? (
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ color: '#fff', fontWeight: 800, fontSize: size * 0.34 }}>{getInitials(name)}</span>
      )}
    </div>
  );
}

// Plays remote audio whenever no <video> element is on-screen for the peer
// (voice calls, or a video call with their camera off) — otherwise their
// voice would never be heard at all.
function AudioRenderer({ stream }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !stream) return;
    ref.current.srcObject = stream;
    ref.current.play().catch(() => {});
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline style={{ display: 'none' }} />;
}

function VideoTile({ stream, muted }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !stream) return;
    ref.current.srcObject = stream;
    ref.current.play().catch(() => {});
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}

function fmtDuration(secs) {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// Normalizes "everyone else in the call" into one list regardless of
// whether I'm the original caller/callee or someone added later — see the
// comment on callState.groupMembers in CallContext.jsx for why those two
// cases start from different shapes.
function getRemoteParticipants(callState, remoteStreams, participantMeta) {
  const members = callState.groupMembers || [];
  const base = callState.isGroupJoin
    ? members
    : [{ username: callState.peerUsername, displayName: callState.peerDisplayName, avatarUrl: callState.peerAvatar },
       ...members.filter(m => m.username !== callState.peerUsername)];
  return base.map(m => {
    const meta = participantMeta[m.username] || {};
    const stream = remoteStreams[m.username] || null;
    return {
      username: m.username,
      displayName: m.displayName || m.username,
      avatarUrl: m.avatarUrl || null,
      stream,
      micOn: meta.micOn !== false,
      camOn: !!meta.camOn,
      hasVideo: !!meta.camOn && !!stream?.getVideoTracks().length,
    };
  });
}

export default function OneOnOneCallScreen({
  mode, // 'voice' | 'video'
  isMicOn,
  isCamOn,
  localStream,
  myUsername,
  myAvatarUrl,
  callState,
  remoteStreams,
  participantMeta,
  toggleMic,
  toggleCamera,
  flipCamera,
  audioRoute,
  setAudioRoute,
  bluetoothAudioAvailable,
  addMemberToCall,
  isCoarsePointer,
  onEndCall,
}) {
  const isVideo = mode === 'video';
  const remotes = getRemoteParticipants(callState, remoteStreams, participantMeta);
  const isGroup = remotes.length > 1;
  const answeredAt = callState.answeredAt;

  // Tap-anywhere-to-toggle chrome — top bar + bottom dock (and, per the
  // product ask, the Add-to-call button that lives in the top bar) fade
  // together.
  const [chromeVisible, setChromeVisible] = useState(true);
  const hideTimerRef = useRef(null);
  const resetHideTimer = () => {
    setChromeVisible(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setChromeVisible(false), 4000);
  };
  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimerRef.current);
  }, []);
  const handleStageTap = () => {
    if (chromeVisible) { clearTimeout(hideTimerRef.current); setChromeVisible(false); }
    else resetHideTimer();
  };

  const [durationSecs, setDurationSecs] = useState(0);
  useEffect(() => {
    if (!answeredAt) return;
    const tick = () => setDurationSecs(Math.floor((Date.now() - answeredAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [answeredAt]);

  const [routePickerOpen, setRoutePickerOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const routeIcon = audioRoute === 'bluetooth' ? Bluetooth : Volume2;
  const RouteIcon = routeIcon;

  const headerLine = isGroup
    ? remotes.map(r => r.displayName).join(', ')
    : remotes[0]?.displayName;
  const mutedOthers = remotes.filter(r => !r.micOn).map(r => r.displayName);
  const statusLine = mutedOthers.length > 0
    ? (mutedOthers.length === 1 ? `${mutedOthers[0]} is muted` : `${mutedOthers.length} people muted`)
    : (answeredAt ? fmtDuration(durationSecs) : 'Connecting…');

  return (
    <div className="ooc-root" onClick={handleStageTap}>
      <style>{`
        .ooc-root { position: absolute; inset: 0; overflow: hidden; background: #0b0f1a; font-family: 'Outfit', 'Inter', sans-serif; user-select: none; }
        @keyframes ooc-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(var(--brand-1-rgb), 0.35); }
          50% { transform: scale(1.05); box-shadow: 0 0 0 16px rgba(var(--brand-1-rgb), 0); }
        }
        .ooc-avatar-pulse { animation: ooc-pulse 1.8s infinite ease-in-out; }
        .ooc-topbar {
          position: absolute; top: 0; left: 0; right: 0; z-index: 20;
          display: flex; align-items: center; justify-content: space-between;
          padding: calc(14px + var(--sp-status-bar-inset, env(safe-area-inset-top, 0px))) 16px 40px;
          background: linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0));
          transition: opacity 0.3s ease, transform 0.3s ease;
        }
        .ooc-dock {
          position: absolute; left: 0; right: 0; bottom: 0; z-index: 20;
          display: flex; align-items: center; justify-content: center; gap: 20px;
          padding: 20px 16px calc(28px + env(safe-area-inset-bottom, 0px));
          background: linear-gradient(0deg, rgba(0,0,0,0.6), rgba(0,0,0,0));
          transition: opacity 0.3s ease, transform 0.3s ease;
        }
        .ooc-hidden { opacity: 0; pointer-events: none; }
        .ooc-topbar.ooc-hidden { transform: translateY(-8px); }
        .ooc-dock.ooc-hidden { transform: translateY(8px); }
        .ooc-ctrl-btn {
          width: 54px; height: 54px; border-radius: 50%; border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: transform 0.15s ease; flex-shrink: 0;
        }
        .ooc-ctrl-btn:active { transform: scale(0.92); }
        .ooc-ctrl-label { font-size: 10px; color: rgba(255,255,255,0.6); text-align: center; margin-top: 6px; }
        .ooc-pip {
          position: absolute; width: 104px; height: 148px; border-radius: 14px;
          overflow: hidden; z-index: 15; border: 2px solid rgba(255,255,255,0.5);
          box-shadow: 0 10px 26px rgba(0,0,0,0.55); cursor: pointer;
          background: #131928; display: flex; align-items: center; justify-content: center;
          transition: opacity 0.3s ease;
        }
        .ooc-route-sheet {
          position: absolute; z-index: 40; bottom: 108px; left: 50%; transform: translateX(-50%);
          background: rgba(24,26,36,0.97); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px; padding: 6px; min-width: 190px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.5);
        }
        .ooc-route-opt {
          display: flex; align-items: center; gap: 10px; width: 100%;
          padding: 12px 14px; background: transparent; border: none; border-radius: 10px;
          color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; text-align: left;
        }
        .ooc-route-opt.active { background: rgba(var(--brand-1-rgb), 0.18); color: var(--brand-1-light); }
        .ooc-grid {
          position: absolute; inset: 0; display: grid; gap: 6px; padding: 6px;
          padding-top: calc(6px + var(--sp-status-bar-inset, env(safe-area-inset-top, 0px)) + 76px);
          padding-bottom: 120px;
        }
        .ooc-grid.n-2 { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
        .ooc-grid.n-3, .ooc-grid.n-4 { grid-template-columns: 1fr 1fr; grid-template-rows: repeat(2, 1fr); }
        .ooc-grid.n-5, .ooc-grid.n-6 { grid-template-columns: 1fr 1fr; grid-template-rows: repeat(3, 1fr); }
        .ooc-tile {
          position: relative; border-radius: 14px; overflow: hidden; background: #131928;
          display: flex; align-items: center; justify-content: center;
        }
        .ooc-tile-label {
          position: absolute; bottom: 8px; left: 8px; right: 8px; display: flex; align-items: center; gap: 6px;
          background: rgba(0,0,0,0.5); padding: 4px 8px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 700;
          opacity: ${chromeVisible ? 1 : 0}; transition: opacity 0.3s ease;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        @media (max-width: 380px) {
          .ooc-dock { gap: 12px; }
          .ooc-ctrl-btn { width: 48px; height: 48px; }
        }
        /* Desktop web: same full-window call takeover (matches how WhatsApp
           Web/Meet/Discord's own web call views behave), but keep the grid
           and floating sheets from stretching edge-to-edge across a wide
           monitor — centers everything in a comfortably call-sized column
           instead of a giant blown-up mobile layout. */
        @media (min-width: 900px) {
          .ooc-grid { max-width: 1100px; margin: 0 auto; }
        }
      `}</style>

      {!isGroup ? (
        <SoloStage
          remote={remotes[0]}
          isVideo={isVideo}
          localStream={localStream}
          isCamOn={isCamOn}
          isMicOn={isMicOn}
          myAvatarUrl={myAvatarUrl}
          isCoarsePointer={isCoarsePointer}
          flipCamera={flipCamera}
          chromeVisible={chromeVisible}
        />
      ) : (
        <div className={`ooc-grid n-${Math.min(6, remotes.length + 1)}`}>
          {remotes.map(r => (
            <div key={r.username} className="ooc-tile">
              {r.hasVideo ? (
                <VideoTile stream={r.stream} muted={false} />
              ) : (
                <Avatar url={r.avatarUrl} name={r.displayName} size={64} pulsing={r.micOn} />
              )}
              {!r.hasVideo && <AudioRenderer stream={r.stream} />}
              <div className="ooc-tile-label">
                {!r.micOn && <MicOff size={11} color="#f87171" />}
                {r.displayName}
              </div>
            </div>
          ))}
          <div className="ooc-tile">
            {isVideo && isCamOn && localStream ? (
              <VideoTile stream={localStream} muted />
            ) : (
              <Avatar url={myAvatarUrl} name={myUsername} size={64} pulsing={isMicOn} />
            )}
            <div className="ooc-tile-label">
              {!isMicOn && <MicOff size={11} color="#f87171" />}
              You
            </div>
          </div>
        </div>
      )}

      {/* ── Top bar: name(s) + duration/mute status + add-person ── */}
      <div className={`ooc-topbar ${chromeVisible ? '' : 'ooc-hidden'}`} onClick={(e) => e.stopPropagation()}>
        <div style={{ minWidth: 0 }}>
          <div className="stay-white" style={{ color: '#fff', fontWeight: 800, fontSize: 17, textShadow: '0 1px 3px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {headerLine}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: mutedOthers.length > 0 ? '#fbbf24' : 'rgba(255,255,255,0.7)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
            {statusLine}
          </div>
        </div>
        <button
          title="Add to call"
          onClick={() => setAddSheetOpen(true)}
          style={{
            width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <UserPlus size={17} />
        </button>
      </div>

      {/* ── Speaker/Bluetooth picker sheet ── */}
      {routePickerOpen && (
        <div className="ooc-route-sheet" onClick={(e) => e.stopPropagation()}>
          <button className={`ooc-route-opt ${audioRoute !== 'bluetooth' ? 'active' : ''}`} onClick={() => { setAudioRoute(audioRoute === 'speaker' ? 'earpiece' : 'speaker'); setRoutePickerOpen(false); }}>
            <Volume2 size={17} /> Speaker {audioRoute === 'speaker' ? '(on)' : ''}
          </button>
          {bluetoothAudioAvailable && (
            <button className={`ooc-route-opt ${audioRoute === 'bluetooth' ? 'active' : ''}`} onClick={() => { setAudioRoute('bluetooth'); setRoutePickerOpen(false); }}>
              <Bluetooth size={17} /> Bluetooth
            </button>
          )}
        </div>
      )}

      {/* ── Bottom controls dock ── */}
      <div className={`ooc-dock ${chromeVisible ? '' : 'ooc-hidden'}`} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button
            className="ooc-ctrl-btn"
            onClick={() => setRoutePickerOpen(v => !v)}
            style={{ background: audioRoute !== 'earpiece' ? 'rgba(var(--brand-1-rgb),0.3)' : 'rgba(255,255,255,0.14)' }}
          >
            <RouteIcon size={22} color="#fff" />
          </button>
          <span className="ooc-ctrl-label">{audioRoute === 'bluetooth' ? 'Bluetooth' : audioRoute === 'speaker' ? 'Speaker' : 'Audio'}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button
            className="ooc-ctrl-btn"
            onClick={toggleCamera}
            style={{ background: (isVideo && isCamOn) ? 'rgba(var(--brand-1-rgb),0.3)' : 'rgba(255,255,255,0.14)' }}
          >
            {/* Voice call: tapping upgrades to video (toggleCamera handles both
                the upgrade AND, once already video, the plain on/off toggle —
                see CallContext.jsx's toggleCamera). Icon tracks whether the
                camera is actually on, not just whether this is a video call. */}
            {isVideo && !isCamOn ? <VideoOff size={22} color="#fff" /> : <Video size={22} color="#fff" />}
          </button>
          <span className="ooc-ctrl-label">Video</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button
            className="ooc-ctrl-btn"
            onClick={toggleMic}
            style={{ background: isMicOn ? 'rgba(255,255,255,0.14)' : '#ef4444' }}
          >
            {isMicOn ? <Mic size={22} color="#fff" /> : <MicOff size={22} color="#fff" />}
          </button>
          <span className="ooc-ctrl-label">{isMicOn ? 'Mute' : 'Muted'}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button className="ooc-ctrl-btn" onClick={onEndCall} style={{ background: '#ef4444' }}>
            <PhoneOff size={22} color="#fff" />
          </button>
          <span className="ooc-ctrl-label">{isGroup ? 'Leave' : 'End'}</span>
        </div>
      </div>

      {addSheetOpen && (
        <AddToCallSheet
          alreadyInCall={[myUsername, ...remotes.map(r => r.username)]}
          onClose={() => setAddSheetOpen(false)}
          onAdd={(username) => { addMemberToCall(username); toast(`Ringing ${username}…`); }}
        />
      )}
    </div>
  );
}

// The original 2-person layout — main stage (defaults to the remote
// person, tap the PiP to swap to my own video full-screen) unchanged from
// before "Add to call" existed.
function SoloStage({ remote, isVideo, localStream, isCamOn, isMicOn, myAvatarUrl, isCoarsePointer, flipCamera, chromeVisible }) {
  const [mainIsLocal, setMainIsLocal] = useState(false);
  useEffect(() => { if (!isVideo) setMainIsLocal(false); }, [isVideo]);

  const localHasVideo = isVideo && isCamOn && !!localStream;
  const mainHasVideo = mainIsLocal ? localHasVideo : remote.hasVideo;
  const mainAvatarUrl = mainIsLocal ? myAvatarUrl : remote.avatarUrl;
  const mainName = mainIsLocal ? 'You' : remote.displayName;
  const pipHasVideo = mainIsLocal ? remote.hasVideo : localHasVideo;
  const pipAvatarUrl = mainIsLocal ? remote.avatarUrl : myAvatarUrl;

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {mainHasVideo ? (
          <VideoTile stream={mainIsLocal ? localStream : remote.stream} muted={mainIsLocal} />
        ) : (
          <Avatar url={mainAvatarUrl} name={mainName} size={132} pulsing={mainIsLocal ? isMicOn : remote.micOn} />
        )}
        {/* Remote audio must always play even when they're the PiP tile (or
            have no video at all) — a plain <video> only exists for whichever
            side is showing video, so this covers every other case. */}
        {!mainIsLocal && !mainHasVideo && <AudioRenderer stream={remote.stream} />}
        {mainIsLocal && pipHasVideo === false && <AudioRenderer stream={remote.stream} />}
      </div>

      {isVideo && (
        <div
          className="ooc-pip"
          style={{ top: 'calc(96px + var(--sp-status-bar-inset, env(safe-area-inset-top, 0px)))', right: 16 }}
          onClick={(e) => { e.stopPropagation(); setMainIsLocal(v => !v); }}
        >
          {pipHasVideo ? (
            <VideoTile stream={mainIsLocal ? remote.stream : localStream} muted={!mainIsLocal} />
          ) : (
            <Avatar url={pipAvatarUrl} name={mainIsLocal ? remote.displayName : 'You'} size={56} />
          )}
          {/* Camera flip lives on MY OWN tile specifically — when I'm in the PiP
              (the default), that's here; when I've swapped to main, the other
              flip button below (rendered over the main stage) takes over. */}
          {isCoarsePointer && !mainIsLocal && localHasVideo && (
            <button
              onClick={(e) => { e.stopPropagation(); flipCamera?.(); }}
              title="Switch camera"
              style={{
                position: 'absolute', bottom: 6, right: 6, width: 26, height: 26, borderRadius: '50%',
                background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <SwitchCamera size={13} />
            </button>
          )}
        </div>
      )}
      {isVideo && mainIsLocal && isCoarsePointer && localHasVideo && (
        <button
          onClick={(e) => { e.stopPropagation(); flipCamera?.(); }}
          title="Switch camera"
          style={{
            position: 'absolute', bottom: chromeVisible ? 110 : 24, right: 16, zIndex: 16,
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            transition: 'bottom 0.3s ease',
          }}
        >
          <SwitchCamera size={18} />
        </button>
      )}
    </>
  );
}
