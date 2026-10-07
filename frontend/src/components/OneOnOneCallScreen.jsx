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
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, Bluetooth, Ear, SwitchCamera, UserPlus, MoreVertical, ScreenShare, MessageCircle, WifiOff, Maximize2, Minimize2, X } from 'lucide-react';
import { getInitials } from '../utils/avatarUtils';
import AddToCallSheet from './AddToCallSheet';
import { isCapacitorApp } from '../lib/platform';
import { useSpeakingDetection } from '../hooks/useSpeakingDetection';

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

// ── Laptop/tablet video fit preference ──────────────────────────────────────
// A phone's camera is portrait; on a laptop/tablet screen 'cover' stretches it
// to fill the whole window and crops it. On larger screens people can choose:
//   'fit'  = mobile view (default) — whole portrait frame, centred, uncropped
//   'fill' = expanded — fills the screen (the previous behaviour)
// Phones always keep 'cover'. The choice is remembered on this device.
const FIT_KEY = 'sp_call_video_fit';
const FIT_EVENT = 'sp-call-video-fit-change';
const isLargeScreen = () => typeof window !== 'undefined'
  && Math.min(window.innerWidth, window.innerHeight) >= 600;
const readFitPref = () => {
  try { return localStorage.getItem(FIT_KEY) === 'fill' ? 'fill' : 'fit'; } catch { return 'fit'; }
};

function useVideoFit() {
  const [large, setLarge] = useState(isLargeScreen);
  const [mode, setMode] = useState(readFitPref);
  useEffect(() => {
    const onResize = () => setLarge(isLargeScreen());
    const onChange = () => setMode(readFitPref());
    window.addEventListener('resize', onResize);
    window.addEventListener(FIT_EVENT, onChange);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener(FIT_EVENT, onChange);
    };
  }, []);
  const toggle = () => {
    const next = readFitPref() === 'fill' ? 'fit' : 'fill';
    try { localStorage.setItem(FIT_KEY, next); } catch { /* storage blocked: still switch for this session */ }
    setMode(next);
    window.dispatchEvent(new Event(FIT_EVENT));
  };
  // Fit to use for a normal (non screen-share) camera video.
  const faceFit = large && mode === 'fit' ? 'contain' : 'cover';
  return { large, mode, toggle, faceFit };
}

// Small round button, laptop/tablet only. Rendered over the call stage.
function FitToggleButton({ large, mode, onToggle }) {
  if (!large) return null;
  const expanded = mode === 'fill';
  const label = expanded ? 'Mobile view' : 'Full screen';
  return (
    <button
      type="button"
      className="ooc-fit-toggle"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      title={label}
      aria-label={label}
      style={{
        position: 'absolute', top: 'calc(16px + var(--sp-status-bar-inset, 0px))', left: 16, zIndex: 6,
        width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)', color: '#fff', padding: 0,
      }}
    >
      {expanded ? <Minimize2 size={18} color="#fff" /> : <Maximize2 size={18} color="#fff" />}
    </button>
  );
}

// fit: 'cover' (default, fills the tile — right for a face-cam, where
// cropping the edges is normal/expected) or 'contain' (letterboxed, shows
// the whole frame uncropped — right for a shared screen, where cropping
// cuts off content the sharer actually meant to show, especially a
// portrait phone screen shared into a landscape-ish grid tile).
function VideoTile({ stream, muted, fit = 'cover' }) {
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
      style={{ width: '100%', height: '100%', objectFit: fit, background: '#000' }}
    />
  );
}

// Per-tile "..." button in the group-call grid — opens a tiny one-item menu
// with "View full screen". A plain button rather than the whole tile being
// clickable, since a tap on the tile itself is already meaningful in some
// call UIs (and consistency with the rest of this screen's own tap-to-
// toggle-chrome gesture elsewhere) — this keeps "make this one full screen"
// an explicit, discoverable action instead of an accidental one.
function TileMenuButton({ isOpen, onOpen, onFullscreen, visible = true }) {
  return (
    <div style={{
      position: 'absolute', top: 6, right: 6, zIndex: 2,
      opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'opacity 0.3s ease',
    }}>
      <button
        className="ooc-tile-menu-btn"
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        style={{
          width: 26, height: 26, borderRadius: '50%', border: 'none',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0,
        }}
        aria-label="Tile options"
      >
        <MoreVertical size={15} color="#fff" />
      </button>
      {isOpen && (
        // stay-white: this menu is always a dark popover regardless of app
        // theme (matches the fullscreen bar's own opt-out below) — without
        // it, the light-mode stylesheet's blanket "force inline #fff text
        // dark" rule makes "View full screen" unreadable against this
        // popover's own always-dark background.
        <div
          className="ooc-tile-menu stay-white"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: 30, right: 0, background: '#1c1e2a', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)',
            overflow: 'hidden', minWidth: 168,
          }}
        >
          <button
            className="stay-white"
            onClick={onFullscreen}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px',
              background: 'transparent', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <Maximize2 size={15} color="#fff" /> View full screen
          </button>
        </div>
      )}
    </div>
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
      sharingScreen: !!meta.sharingScreen,
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
  networkStatus,
  toggleMic,
  toggleCamera,
  flipCamera,
  isFlippingCamera,
  audioRoute,
  setAudioRoute,
  bluetoothAudioAvailable,
  addMemberToCall,
  isCoarsePointer,
  onEndCall,
  isScreenSharing,
  screenShareStream,
  startScreenShare,
  stopScreenShare,
  onSendMessage,
}) {
  const isVideo = mode === 'video';
  const { large: largeScreen, mode: fitMode, toggle: toggleFit, faceFit } = useVideoFit();
  // While sharing, the local tile should show the shared screen, not the
  // (deliberately disabled) camera feed sitting unchanged in localStream.
  const localDisplayStream = isScreenSharing && screenShareStream ? screenShareStream : localStream;
  const remotes = getRemoteParticipants(callState, remoteStreams, participantMeta);
  const isGroup = remotes.length > 1;
  const answeredAt = callState.answeredAt;
  // Real-time "who's actually talking" for the group grid below — keyed by
  // username (localStream, not the screen-share substitute, since a screen
  // share stream carries no mic audio to measure).
  const speakingStreams = {};
  if (isGroup) {
    remotes.forEach(r => { if (r.stream && r.micOn) speakingStreams[r.username] = r.stream; });
    // Web Audio's MediaStreamAudioSourceNode taps a track's raw capture
    // data and, on Chromium, keeps doing so even once track.enabled is
    // false — unlike RTCPeerConnection senders/media playback, which do
    // correctly go silent. Analyzing (and therefore visually "speaking"-
    // highlighting) your own muted mic showed a pulsing/speaking ring
    // directly contradicting the mic-off badge right next to it. Skipping
    // it outright while muted fixes the visual contradiction; it has no
    // bearing on what's actually SENT to anyone else, which is already
    // fully cut off via replaceTrack(null) in CallContext.jsx's toggleMic
    // regardless of what this local analysis does.
    if (localStream && isMicOn) speakingStreams.__me__ = localStream;
  }
  const speakingKeys = useSpeakingDetection(speakingStreams);
  // Screen share only actually works from the installed app — most mobile
  // browsers either don't implement getDisplayMedia at all (iOS Safari) or
  // support it too inconsistently to rely on, so a plain mobile browser tab
  // (isCoarsePointer true, not the Capacitor-wrapped app) never gets a
  // working option in the first place rather than a button that silently
  // fails. Desktop browsers/Tauri aren't affected — coarse-pointer is
  // specifically a touch-primary-input signal, not "not installed."
  const canScreenShare = !isCoarsePointer || isCapacitorApp();

  // Tap-anywhere-to-toggle chrome — top bar + bottom dock (and, per the
  // product ask, the Add-to-call button that lives in the top bar) fade
  // together. Stays up a bit longer (6s) than the original 4s — reported as
  // disappearing too quickly to actually use on some devices.
  const [chromeVisible, setChromeVisible] = useState(true);
  const hideTimerRef = useRef(null);
  const resetHideTimer = () => {
    setChromeVisible(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setChromeVisible(false), 6000);
  };
  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimerRef.current);
  }, []);
  // Some mobile browsers/WebViews fire a second, near-instant synthetic
  // click for a single physical tap (a known quirk on certain OEM builds) —
  // this toggle handler treated that as two real taps: the first correctly
  // showed the chrome, the second (arriving milliseconds later, while it's
  // now visible) immediately hid it again, reading as "it shows then
  // disappears right away." Ignoring a repeat tap within a short window
  // fixes that without weakening the real toggle-on-a-genuine-second-tap
  // behavior at all (a deliberate second tap is never that fast).
  const lastTapAtRef = useRef(0);
  const handleStageTap = () => {
    const now = Date.now();
    if (now - lastTapAtRef.current < 300) return;
    lastTapAtRef.current = now;
    if (chromeVisible) { clearTimeout(hideTimerRef.current); setChromeVisible(false); }
    else resetHideTimer();
  };

  // The more-options and speaker/route menus float above the dock and read
  // as part of it — leaving them open after the dock itself has faded out
  // from inactivity looked like a stray, disconnected popup with no visible
  // way back to it. Closing them the moment the dock hides keeps the two in
  // sync, same as they visually appear to be one unit.
  useEffect(() => {
    if (chromeVisible) return;
    setMoreMenuOpen(false);
    setRoutePickerOpen(false);
  }, [chromeVisible]);

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
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  // Which group-grid tile's own "..." menu is open, and which tile (if any)
  // is currently blown up to fill the whole call view — usernames, or
  // '__me__' for the local tile, matching the keys already used for
  // speaking-detection above. Only one of each at a time; a new call
  // resets both automatically since this state doesn't survive an unmount.
  const [tileMenuFor, setTileMenuFor] = useState(null);
  const [fullscreenTile, setFullscreenTile] = useState(null);
  // The fullscreened person leaving mid-view (or their video ending, e.g.
  // toggling their camera off) shouldn't leave a frozen/blank fullscreen
  // overlay stuck open with no obvious way out beyond guessing to tap it.
  useEffect(() => {
    if (!fullscreenTile || fullscreenTile === '__me__') return;
    if (!remotes.some(r => r.username === fullscreenTile)) setFullscreenTile(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remotes.map(r => r.username).join(',')]);
  // Both menus below used to anchor via a hardcoded CSS offset (More: a flat
  // left:40px; the route picker: left:calc(50% + 30px)) — close enough on a
  // narrow phone, where the dock spans nearly the full width and its buttons
  // sit near those same positions, but .ooc-dock centers its (fixed-width)
  // .ooc-dock-box on any wider screen, so on a laptop the actual More/
  // Speaker buttons end up well to the right of where either menu opened.
  // Measuring the real trigger button's position when the menu opens keeps
  // it correctly anchored regardless of viewport width.
  const [moreMenuLeft, setMoreMenuLeft] = useState(40);
  const [routeMenuLeft, setRouteMenuLeft] = useState(null);
  const primaryRemote = remotes[0];

  const routeIcon = audioRoute === 'bluetooth' ? Bluetooth : audioRoute === 'speaker' ? Volume2 : Ear;
  const RouteIcon = routeIcon;

  // Click/tap ANYWHERE outside an open menu closes it — previously only the
  // menu's own option buttons (and, for the more-menu, tapping the video
  // stage) closed it; tapping another dock button, the top bar, or empty
  // space around a menu left it stuck open. Listens on the capture phase so
  // it always sees the tap before any inner stopPropagation() (the dock and
  // both menus call it on their own onClick) could block it — those calls
  // only affect the later bubble phase, not a capture listener that already
  // ran on the way down.
  const moreMenuRef = useRef(null);
  const moreBtnRef = useRef(null);
  const routeMenuRef = useRef(null);
  const routeBtnRef = useRef(null);
  useEffect(() => {
    if (!moreMenuOpen && !routePickerOpen && !tileMenuFor) return;
    const handleOutside = (e) => {
      if (moreMenuOpen && !moreMenuRef.current?.contains(e.target) && !moreBtnRef.current?.contains(e.target)) {
        setMoreMenuOpen(false);
      }
      if (routePickerOpen && !routeMenuRef.current?.contains(e.target) && !routeBtnRef.current?.contains(e.target)) {
        setRoutePickerOpen(false);
      }
      // A dynamic list of tiles each get their own "..." button/menu rather
      // than one shared ref pair — tagged by class instead, same effect.
      if (tileMenuFor && !e.target.closest?.('.ooc-tile-menu') && !e.target.closest?.('.ooc-tile-menu-btn')) {
        setTileMenuFor(null);
      }
    };
    document.addEventListener('pointerdown', handleOutside, true);
    return () => document.removeEventListener('pointerdown', handleOutside, true);
  }, [moreMenuOpen, routePickerOpen, tileMenuFor]);

  // Short tap = instantly toggle speaker on/off (the common case, no menu in
  // the way). Long press = open the full route picker (Normal/Speaker/
  // Bluetooth) instead of toggling. Not picking anything from that picker
  // just leaves the route exactly as it was — CallContext already defaults
  // every call to 'earpiece' ("normal") unless the user explicitly picks
  // something else, so there's nothing extra to do for that case here.
  const speakerPressTimerRef = useRef(null);
  const speakerLongPressedRef = useRef(false);
  const handleSpeakerPointerDown = () => {
    speakerLongPressedRef.current = false;
    speakerPressTimerRef.current = setTimeout(() => {
      speakerLongPressedRef.current = true;
      const rect = routeBtnRef.current?.getBoundingClientRect();
      if (rect) setRouteMenuLeft(rect.left + rect.width / 2 + 30);
      setRoutePickerOpen(true);
    }, 450);
  };
  const handleSpeakerPointerUp = () => {
    clearTimeout(speakerPressTimerRef.current);
    if (!speakerLongPressedRef.current) {
      setAudioRoute(audioRoute === 'speaker' ? 'earpiece' : 'speaker');
    }
  };
  const cancelSpeakerPress = () => clearTimeout(speakerPressTimerRef.current);

  const headerLine = isGroup
    ? remotes.map(r => r.displayName).join(', ')
    : remotes[0]?.displayName;
  const mutedOthers = remotes.filter(r => !r.micOn).map(r => r.displayName);
  // Duration and muted status used to be mutually exclusive (muted text
  // replaced the timer entirely) — showing both together, duration first,
  // is what was actually wanted: the call's still going, someone just also
  // happens to be muted right now.
  const durationOrConnecting = answeredAt ? fmtDuration(durationSecs) : 'Connecting…';
  const mutedNote = mutedOthers.length > 0
    ? (mutedOthers.length === 1 ? `${mutedOthers[0]} is muted` : `${mutedOthers.length} people muted`)
    : null;
  const statusLine = mutedNote ? `${durationOrConnecting} · ${mutedNote}` : durationOrConnecting;
  const isPoorConnection = networkStatus === 'poor';

  return (
    // onMouseMove keeps/reveals the chrome on desktop mouse movement, same as
    // CallingActivity.jsx's own auto-hide dock — without it, a desktop user
    // who lets the mouse sit idle for 6s gets the dock hidden behind
    // pointer-events:none, and their first click on End Call/Mute/Video is
    // swallowed by the stage underneath (it only reveals the dock); a touch
    // user is unaffected since touch input never fires mousemove.
    <div className="ooc-root" onClick={handleStageTap} onMouseMove={resetHideTimer}>
      <style>{`
        /* color-scheme: dark tells the WebView this surface already handles
           its own (permanently dark, by design) styling — without it, some
           OEM Android skins' algorithmic WebView dark-mode re-coloring
           (Samsung/Xiaomi's system-wide "Dark mode for all apps" especially)
           repaints already-white text into a dim, low-contrast grey, which
           no CSS !important can override since it happens after render.
           MainActivity.java also disables this at the native WebView-settings
           level as the more complete fix; this is the standards-based CSS
           signal for whichever layer respects it first. */
        .ooc-root { position: absolute; inset: 0; overflow: hidden; background: #0b0f1a; font-family: 'Outfit', 'Inter', sans-serif; user-select: none; color-scheme: dark; }
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
          /* clamp(), not a fixed px size + one breakpoint override — a fixed
             54px x up to 6 buttons + gaps + padding genuinely doesn't fit on
             narrow phones (~320-360px wide), which is exactly the "fits on
             some phones, cut off on others" report. Scaling fluidly with
             viewport width means there's no specific screen size this can
             overflow at, from the narrowest phone up through iPad — the
             bounds (40-58px) and the dock's own gap/padding below are tuned
             together so even 6 buttons on a 320px-wide screen still fit,
             while typical phones and tablets get noticeably bigger buttons
             than a one-size-fits-all 54px could safely allow everywhere. */
          width: clamp(40px, 11.5vw, 58px); height: clamp(40px, 11.5vw, 58px);
          border-radius: 50%; border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: transform 0.15s ease; flex-shrink: 0;
        }
        .ooc-ctrl-btn:active { transform: scale(0.92); }
        /* This whole screen is a permanently-dark surface by design
           regardless of the app's own light/dark theme setting (see
           GlobalCallOverlay.jsx's matching status-bar-icon comment). Plain
           color: ... !important alone was NOT enough on the app's light
           theme specifically — html[data-theme='light'] body sets a
           -webkit-text-fill-color on the page (see index.css's own
           .stay-white utility, which exists for exactly this reason).
           WebKit/Chromium paints text glyphs from -webkit-text-fill-color
           when it's present ANYWHERE in the inherited chain, ignoring
           color for the actual paint even though color itself is
           correctly white — that's why dark mode (no such rule active)
           looked fine while light mode still rendered these dark. Forcing
           -webkit-text-fill-color here too, everywhere color is forced,
           is what actually fixes it in both themes. */
        .ooc-ctrl-label { font-size: clamp(8.5px, 2.2vw, 10px); color: rgba(255,255,255,0.7) !important; -webkit-text-fill-color: rgba(255,255,255,0.7) !important; text-align: center; margin-top: 6px; white-space: nowrap; }
        /* Same reasoning as the top bar's Add button: buttons/labels sitting
           directly on top of a bright/light background (a plain window
           gradient scrim isn't always enough contrast) were hard to read.
           One rounded box behind the whole control row fixes that
           regardless of what's behind the call screen. */
        .ooc-dock-box {
          display: flex; align-items: center; justify-content: center;
          gap: clamp(3px, 1.8vw, 16px);
          background: rgba(20,20,20,0.55); border-radius: 28px;
          padding: clamp(6px, 2vw, 14px) clamp(6px, 2vw, 18px);
          max-width: 100%;
        }
        .ooc-more-menu {
          /* bottom uses the same safe-area-aware clearance as .ooc-dock
             itself (28px pad + env(safe-area-inset-bottom)) plus the dock's
             own content height (icon + label + dock-box padding) — a plain
             fixed 108px left less room than that on phones with a tall
             gesture-nav bottom inset, so the menu's bottom edge sat right on
             top of the More/Speaker icons instead of clear above them.
             left is nudged in from the screen edge (rather than pinned to
             it) since the dock itself is centered, not full-width — on
             wider screens/tablets the More button sits well right of the
             true left edge, so anchoring flush to x=16px drifted away from
             the button it's supposed to open under. */
          position: absolute; z-index: 40;
          bottom: calc(128px + env(safe-area-inset-bottom, 0px)); left: 40px;
          background: rgba(24,26,36,0.97); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px; padding: 6px; min-width: 190px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.5);
        }
        .ooc-more-opt {
          display: flex; align-items: center; gap: 10px; width: 100%;
          padding: 12px 14px; background: transparent; border: none; border-radius: 10px;
          color: #fff !important; -webkit-text-fill-color: #fff !important;
          font-size: 14px; font-weight: 600; cursor: pointer; text-align: left;
        }
        .ooc-more-opt:active { background: rgba(255,255,255,0.08); }
        .ooc-pip {
          position: absolute; width: 128px; height: 176px; border-radius: 14px;
          overflow: hidden; z-index: 15;
          box-shadow: 0 10px 26px rgba(0,0,0,0.55); cursor: pointer;
          background: #131928; display: flex; align-items: center; justify-content: center;
          transition: opacity 0.3s ease;
        }
        .ooc-route-sheet {
          /* Same clearance fix as .ooc-more-menu above. Shifted right of
             dead-center (rather than exactly centered over the Speaker
             button) for the same reason — centered puts its left edge
             close to the More button just to its left, which is exactly
             the overlap being fixed here. */
          position: absolute; z-index: 40;
          bottom: calc(128px + env(safe-area-inset-bottom, 0px)); left: calc(50% + 30px); transform: translateX(-50%);
          background: rgba(24,26,36,0.97); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px; padding: 6px; min-width: 190px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.5);
        }
        .ooc-route-opt {
          display: flex; align-items: center; gap: 10px; width: 100%;
          padding: 12px 14px; background: transparent; border: none; border-radius: 10px;
          color: #fff !important; -webkit-text-fill-color: #fff !important;
          font-size: 14px; font-weight: 600; cursor: pointer; text-align: left;
        }
        .ooc-route-opt.active { background: rgba(var(--brand-1-rgb), 0.18); color: var(--brand-1-light) !important; -webkit-text-fill-color: var(--brand-1-light) !important; }
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
          border: 2.5px solid transparent; transition: border-color 0.15s ease;
        }
        /* Real-time active-speaker highlight (see useSpeakingDetection) —
           a plain border rather than a box-shadow glow so it reads clearly
           on both a video tile and a plain avatar-on-dark-background tile. */
        .ooc-tile-speaking { border-color: #22c55e; }
        .ooc-tile-ringing-dot {
          width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; flex-shrink: 0;
          animation: ooc-ringing-pulse 1s infinite ease-in-out;
        }
        @keyframes ooc-ringing-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .ooc-fullscreen-tile {
          position: absolute; inset: 0; z-index: 30; background: #000;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .ooc-fullscreen-tile-bar {
          position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; gap: 10px;
          padding: 16px 16px calc(16px + env(safe-area-inset-top, 0px));
          background: linear-gradient(180deg, rgba(0,0,0,0.6), transparent);
          color: #fff; font-weight: 700; font-size: 15px;
        }
        .ooc-fullscreen-tile-back {
          width: 32px; height: 32px; border-radius: 50%; border: none; background: rgba(255,255,255,0.12);
          display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
        }
        .ooc-tile-label {
          position: absolute; bottom: 8px; left: 8px; right: 8px; display: flex; align-items: center; gap: 6px;
          background: rgba(0,0,0,0.5); padding: 4px 8px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 700;
          opacity: ${chromeVisible ? 1 : 0}; transition: opacity 0.3s ease;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
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
          // On the Android app the shared screen is a canvas stream; also rendering it
          // back into a <video> here (your own screen mirrored in a corner) doubled the
          // decode/paint work for no benefit and made the app sluggish while sharing.
          localStream={isScreenSharing && isCapacitorApp() ? null : localDisplayStream}
          isCamOn={isCamOn}
          isScreenSharing={isScreenSharing}
          isMicOn={isMicOn}
          myAvatarUrl={myAvatarUrl}
          isFlippingCamera={isFlippingCamera}
        />
      ) : !fullscreenTile ? (
        <div className={`ooc-grid n-${Math.min(6, remotes.length + 1)}`}>
          {isVideo && <FitToggleButton large={largeScreen} mode={fitMode} onToggle={toggleFit} />}
          {remotes.map(r => {
            // A member just added via "Add to call" gets a placeholder tile
            // the instant the invite goes out (see addMemberToCall/
            // call:member-invited in CallContext.jsx) rather than only
            // appearing once they actually join — the absence of a stream
            // is exactly "invited but not connected yet," no separate
            // status field needed.
            const isRinging = !r.stream;
            return (
              <div key={r.username} className={`ooc-tile${speakingKeys.has(r.username) ? ' ooc-tile-speaking' : ''}`}>
                {r.hasVideo ? (
                  <VideoTile stream={r.stream} fit={r.sharingScreen ? 'contain' : faceFit} />
                ) : (
                  <Avatar url={r.avatarUrl} name={r.displayName} size={64} pulsing={!isRinging && r.micOn} />
                )}
                {!r.hasVideo && <AudioRenderer stream={r.stream} />}
                {/* Restricted to tiles that actually have video — an
                    audio-only tile's sound already plays via the grid's own
                    AudioRenderer below; full-screening it would mount a
                    SECOND <video> element playing the same stream's audio
                    at the same time (a video element isn't muted just for
                    lacking visible video), doubling it up. */}
                {r.hasVideo && (
                  <TileMenuButton
                    visible={chromeVisible}
                    isOpen={tileMenuFor === r.username}
                    onOpen={() => setTileMenuFor(t => (t === r.username ? null : r.username))}
                    onFullscreen={() => { setFullscreenTile(r.username); setTileMenuFor(null); }}
                  />
                )}
                <div className="ooc-tile-label stay-white">
                  {isRinging ? (
                    <span className="ooc-tile-ringing-dot" />
                  ) : (!r.micOn && <MicOff size={11} color="#f87171" />)}
                  {r.displayName}
                  {isRinging && <span style={{ opacity: 0.65, fontWeight: 500 }}>&nbsp;· Ringing…</span>}
                </div>
              </div>
            );
          })}
          <div className={`ooc-tile${speakingKeys.has('__me__') ? ' ooc-tile-speaking' : ''}`}>
            {isVideo && (isCamOn || isScreenSharing) && localDisplayStream ? (
              <VideoTile stream={localDisplayStream} muted fit={isScreenSharing ? 'contain' : 'cover'} />
            ) : (
              <Avatar url={myAvatarUrl} name={myUsername} size={64} pulsing={isMicOn} />
            )}
            {isVideo && (isCamOn || isScreenSharing) && localDisplayStream && (
              <TileMenuButton
                visible={chromeVisible}
                isOpen={tileMenuFor === '__me__'}
                onOpen={() => setTileMenuFor(t => (t === '__me__' ? null : '__me__'))}
                onFullscreen={() => { setFullscreenTile('__me__'); setTileMenuFor(null); }}
              />
            )}
            <div className="ooc-tile-label stay-white">
              {!isMicOn && <MicOff size={11} color="#f87171" />}
              You
            </div>
          </div>
        </div>
      ) : null}

      {fullscreenTile && (() => {
        const isMe = fullscreenTile === '__me__';
        const target = isMe ? null : remotes.find(x => x.username === fullscreenTile);
        if (!isMe && !target) return null; // they left — see the cleanup effect below
        const stream = isMe ? localDisplayStream : target.stream;
        const sharingScreen = isMe ? isScreenSharing : target.sharingScreen;
        const name = isMe ? 'You' : target.displayName;
        return (
          <div className="ooc-fullscreen-tile" onClick={() => setFullscreenTile(null)}>
            <VideoTile stream={stream} muted={isMe} fit={sharingScreen ? 'contain' : faceFit} />
            {/* stay-white: the app's light-mode stylesheet forces most
                un-colored text/icons dark for readability elsewhere — this
                bar sits on a permanently-dark video backdrop regardless of
                app theme, so it needs the same opt-out every other
                always-dark call surface on this screen uses (see the
                header's own name/status text above). */}
            <div className="ooc-fullscreen-tile-bar stay-white">
              <button
                className="ooc-fullscreen-tile-back"
                onClick={(e) => { e.stopPropagation(); setFullscreenTile(null); }}
                aria-label="Exit full screen"
              >
                <X size={18} color="#fff" />
              </button>
              <span>{name}</span>
            </div>
          </div>
        );
      })()}

      {/* ── Top bar: name(s) + duration/mute status (centered) + add-person ── */}
      <div className={`ooc-topbar ${chromeVisible ? '' : 'ooc-hidden'}`} onClick={(e) => e.stopPropagation()}>
        {/* Invisible spacer matching the Add button's width, so the centered
            name/status block is centered against the FULL bar width, not
            just the remaining space next to the button. */}
        <div style={{ width: 38, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div className="stay-white" style={{ color: '#fff', fontWeight: 800, fontSize: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {headerLine}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: mutedOthers.length > 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.7)', WebkitTextFillColor: mutedOthers.length > 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.7)' }}>
            {statusLine}
          </div>
          {/* Real WebRTC connection health (see CallContext.jsx's
              oniceconnectionstatechange wiring), not a guess — only appears
              once a peer that was actually connected has stayed disconnected
              or failed past the debounce, so a brief network blip that
              self-heals never flickers this on. */}
          {isPoorConnection && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', marginTop: 3 }}>
              <WifiOff size={11} color="#f59e0b" />
              <span className="stay-white" style={{ fontSize: 11.5, fontWeight: 700, color: '#f59e0b', WebkitTextFillColor: '#f59e0b' }}>Poor connection</span>
            </div>
          )}
        </div>
        <button
          title="Add to call"
          onClick={() => setAddSheetOpen(true)}
          style={{
            width: 38, height: 38, borderRadius: '50%', border: 'none',
            background: 'rgba(20,20,20,0.55)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <UserPlus size={17} color="#fff" />
        </button>
      </div>

      {/* ── Normal/Speaker/Bluetooth picker sheet (opened by long-pressing
          the speaker dock button — a short tap toggles speaker directly) ── */}
      {routePickerOpen && (
        <div className="ooc-route-sheet" ref={routeMenuRef} onClick={(e) => e.stopPropagation()} style={routeMenuLeft != null ? { left: routeMenuLeft, transform: 'translateX(-50%)' } : undefined}>
          <button className={`ooc-route-opt ${audioRoute === 'earpiece' ? 'active' : ''}`} style={{ color: '#fff' }} onClick={() => { setAudioRoute('earpiece'); setRoutePickerOpen(false); }}>
            <Ear size={17} color="#fff" /> <span style={{ color: audioRoute === 'earpiece' ? 'var(--brand-1-light)' : '#fff' }}>Normal</span>
          </button>
          <button className={`ooc-route-opt ${audioRoute === 'speaker' ? 'active' : ''}`} style={{ color: '#fff' }} onClick={() => { setAudioRoute('speaker'); setRoutePickerOpen(false); }}>
            <Volume2 size={17} color="#fff" /> <span style={{ color: audioRoute === 'speaker' ? 'var(--brand-1-light)' : '#fff' }}>Speaker</span>
          </button>
          {bluetoothAudioAvailable && (
            <button className={`ooc-route-opt ${audioRoute === 'bluetooth' ? 'active' : ''}`} style={{ color: '#fff' }} onClick={() => { setAudioRoute('bluetooth'); setRoutePickerOpen(false); }}>
              <Bluetooth size={17} color="#fff" /> <span style={{ color: audioRoute === 'bluetooth' ? 'var(--brand-1-light)' : '#fff' }}>Bluetooth</span>
            </button>
          )}
        </div>
      )}

      {/* ── More options: screen share / send message ── */}
      {moreMenuOpen && (
        <div className="ooc-more-menu" ref={moreMenuRef} onClick={(e) => e.stopPropagation()} style={{ left: moreMenuLeft }}>
          {canScreenShare && (
            <button
              className="ooc-more-opt"
              style={{ color: '#fff' }}
              onClick={() => { setMoreMenuOpen(false); isScreenSharing ? stopScreenShare?.() : startScreenShare?.(); }}
            >
              <ScreenShare size={17} color="#fff" /> <span style={{ color: '#fff' }}>{isScreenSharing ? 'Stop screen share' : 'Screen share'}</span>
            </button>
          )}
          {primaryRemote && (
            <button
              className="ooc-more-opt"
              style={{ color: '#fff' }}
              onClick={() => { setMoreMenuOpen(false); onSendMessage?.(primaryRemote.username); }}
            >
              <MessageCircle size={17} color="#fff" /> <span style={{ color: '#fff' }}>Send message</span>
            </button>
          )}
        </div>
      )}

      {/* ── Bottom controls dock ── */}
      <div className={`ooc-dock ${chromeVisible ? '' : 'ooc-hidden'}`} onClick={(e) => e.stopPropagation()}>
        <div className="ooc-dock-box">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              ref={moreBtnRef}
              className="ooc-ctrl-btn"
              onClick={() => {
                if (!moreMenuOpen) {
                  const rect = moreBtnRef.current?.getBoundingClientRect();
                  if (rect) setMoreMenuLeft(Math.max(12, Math.min(rect.left, window.innerWidth - 210)));
                }
                setMoreMenuOpen(v => !v);
              }}
              style={{ width: 46, height: 46, background: moreMenuOpen ? 'rgba(var(--brand-1-rgb),0.3)' : 'rgba(255,255,255,0.14)' }}
            >
              <MoreVertical size={20} color="#fff" />
            </button>
            <span className="ooc-ctrl-label" style={{ color: 'rgba(255,255,255,0.7)' }}>More</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              ref={routeBtnRef}
              className="ooc-ctrl-btn"
              onPointerDown={handleSpeakerPointerDown}
              onPointerUp={handleSpeakerPointerUp}
              onPointerLeave={cancelSpeakerPress}
              onPointerCancel={cancelSpeakerPress}
              style={{ background: audioRoute !== 'earpiece' ? 'rgba(var(--brand-1-rgb),0.3)' : 'rgba(255,255,255,0.14)' }}
            >
              <RouteIcon size={22} color="#fff" />
            </button>
            <span className="ooc-ctrl-label" style={{ color: 'rgba(255,255,255,0.7)' }}>{audioRoute === 'bluetooth' ? 'Bluetooth' : audioRoute === 'speaker' ? 'Speaker' : 'Normal'}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              className="ooc-ctrl-btn"
              // Disabled while screen sharing: the camera track is
              // deliberately held disabled for the duration of the share, and
              // toggling it here would fight with that (and do nothing
              // useful, since the video sender is carrying the screen, not
              // the camera, until the share ends).
              onClick={() => { if (!isScreenSharing) toggleCamera(); }}
              style={{
                background: (isVideo && isCamOn) ? 'rgba(var(--brand-1-rgb),0.3)' : 'rgba(255,255,255,0.14)',
                opacity: isScreenSharing ? 0.4 : 1,
              }}
            >
              {/* Voice call: tapping upgrades to video (toggleCamera handles both
                  the upgrade AND, once already video, the plain on/off toggle —
                  see CallContext.jsx's toggleCamera). Icon tracks whether the
                  camera is actually on, not just whether this is a video call. */}
              {isVideo && !isCamOn ? <VideoOff size={22} color="#fff" /> : <Video size={22} color="#fff" />}
            </button>
            <span className="ooc-ctrl-label" style={{ color: 'rgba(255,255,255,0.7)' }}>Video</span>
          </div>

          {/* Moved here from a floating button on the PiP tile — that button
              lived inside the SAME draggable element that handles PiP
              drag/tap-to-swap, and a tap starting on it kept getting
              swallowed by that gesture handling (see the PiP drag code
              above), so it never reliably fired. An ordinary dock button has
              no such conflict and just works. Only shown once the camera is
              actually on — nothing to flip otherwise. Also gated on
              isCoarsePointer (same signal CallingActivity.jsx's own Flip
              button already uses): "flip" means switching between a
              phone's/tablet's front/back camera (facingMode), a concept
              that doesn't exist on a laptop/desktop with one built-in
              webcam and a mouse — flipCamera would just silently re-request
              the same camera there, so the button had no real effect on
              desktop (Tauri .exe included, but also a plain desktop
              browser tab). */}
          {isVideo && isCamOn && isCoarsePointer && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button className="ooc-ctrl-btn" onClick={flipCamera} style={{ background: 'rgba(255,255,255,0.14)' }}>
                <SwitchCamera size={22} color="#fff" />
              </button>
              <span className="ooc-ctrl-label" style={{ color: 'rgba(255,255,255,0.7)' }}>Flip</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              className="ooc-ctrl-btn"
              onClick={toggleMic}
              style={{ background: isMicOn ? 'rgba(255,255,255,0.14)' : '#ef4444' }}
            >
              {isMicOn ? <Mic size={22} color="#fff" /> : <MicOff size={22} color="#fff" />}
            </button>
            <span className="ooc-ctrl-label" style={{ color: 'rgba(255,255,255,0.7)' }}>{isMicOn ? 'Mute' : 'Muted'}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button className="ooc-ctrl-btn" onClick={onEndCall} style={{ background: '#ef4444' }}>
              <PhoneOff size={22} color="#fff" />
            </button>
            <span className="ooc-ctrl-label" style={{ color: 'rgba(255,255,255,0.7)' }}>{isGroup ? 'Leave' : 'End'}</span>
          </div>
        </div>
      </div>

      {addSheetOpen && (
        <AddToCallSheet
          alreadyInCall={[myUsername, ...remotes.map(r => r.username)]}
          onClose={() => setAddSheetOpen(false)}
          onAdd={(p) => { addMemberToCall(p.username, p.displayName, p.avatarUrl); setAddSheetOpen(false); }}
        />
      )}
    </div>
  );
}

// The original 2-person layout — main stage (defaults to the remote
// person, tap the PiP to swap to my own video full-screen) unchanged from
// before "Add to call" existed.
// Free-drag position, matching the width/height/margins .ooc-pip's own CSS
// already used for its fixed corner spot (kept as plain constants here
// instead of reading them back from the stylesheet).
const PIP_W = 128, PIP_H = 176, PIP_MARGIN = 16, PIP_PEEK = 18;
const PIP_DEFAULT_TOP = 96; // px below the top bar — matches the old fixed position

function SoloStage({ remote, isVideo, localStream, isCamOn, isScreenSharing, isMicOn, myAvatarUrl, isFlippingCamera }) {
  const [mainIsLocal, setMainIsLocal] = useState(false);
  const { large: largeScreen, mode: fitMode, toggle: toggleFit, faceFit } = useVideoFit();
  useEffect(() => { if (!isVideo) setMainIsLocal(false); }, [isVideo]);

  const localHasVideo = isVideo && (isCamOn || isScreenSharing) && !!localStream;
  const mainHasVideo = mainIsLocal ? localHasVideo : remote.hasVideo;
  const mainAvatarUrl = mainIsLocal ? myAvatarUrl : remote.avatarUrl;
  const mainName = mainIsLocal ? 'You' : remote.displayName;
  const pipHasVideo = mainIsLocal ? remote.hasVideo : localHasVideo;
  const pipAvatarUrl = mainIsLocal ? remote.avatarUrl : myAvatarUrl;
  // Screen shares are always letterboxed; a camera follows the laptop/tablet
  // fit preference (phones: 'cover' as before). Only the remote person's camera
  // gets the preference — your own preview (when swapped to main) is unchanged.
  const mainFit = (mainIsLocal ? isScreenSharing : remote.sharingScreen) ? 'contain' : (mainIsLocal ? 'cover' : faceFit);
  const pipFit = (mainIsLocal ? remote.sharingScreen : isScreenSharing) ? 'contain' : 'cover';

  // ── Freely draggable PiP, WhatsApp-style edge "peek" ──
  // null = the original default top-right spot. Once dragged, {x, y} is the
  // top-left corner in px and persists exactly where it was dropped — a
  // plain tap (no movement) still swaps main/PiP, same as before; a real
  // drag moves it. Dragging past the left/right edge lets it follow the
  // finger off-screen, and on release it "parks" there showing only a
  // sliver (PIP_PEEK) instead of snapping back — tap that sliver to bring
  // it back on-screen.
  const [pipPos, setPipPos] = useState(null);
  const pipElRef = useRef(null);
  const dragRef = useRef(null);

  const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });
  const verticalBounds = () => {
    const { h } = viewport();
    return { min: PIP_DEFAULT_TOP, max: h - PIP_H - 140 };
  };
  const currentPipXY = () => {
    if (pipPos) return pipPos;
    const { w } = viewport();
    return { x: w - PIP_W - PIP_MARGIN, y: PIP_DEFAULT_TOP };
  };

  const onPipPointerDown = (e) => {
    e.stopPropagation();
    const pos = currentPipXY();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, moved: false };
    try { pipElRef.current?.setPointerCapture(e.pointerId); } catch {}
  };
  const onPipPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > 6) d.moved = true;
    if (!d.moved) return;
    const { w } = viewport();
    const vb = verticalBounds();
    const nx = Math.max(-(PIP_W - PIP_PEEK), Math.min(w - PIP_PEEK, d.origX + dx));
    const ny = Math.max(vb.min, Math.min(vb.max, d.origY + dy));
    setPipPos({ x: nx, y: ny });
  };
  const onPipPointerUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const { w } = viewport();
    if (!d.moved) {
      // Plain tap. If it was already parked off an edge, bring it back into
      // full view instead of swapping main/PiP — matches the sliver being
      // "pull to bring back" rather than an immediate stage swap.
      const wasParked = d.origX < 0 || d.origX > w - PIP_W;
      if (wasParked) {
        setPipPos({ x: Math.max(0, Math.min(w - PIP_W, d.origX)), y: d.origY });
      } else {
        setMainIsLocal(v => !v);
      }
      return;
    }
    // Dragged past an edge — park it there (only PIP_PEEK px stay visible)
    // rather than leaving it half-off-screen at an arbitrary position.
    setPipPos(prev => {
      if (!prev) return prev;
      if (prev.x < 0) return { ...prev, x: -(PIP_W - PIP_PEEK) };
      if (prev.x > w - PIP_W) return { ...prev, x: w - PIP_PEEK };
      return prev;
    });
  };
  const pipXY = currentPipXY();
  const pipParked = pipXY.x < 0 || pipXY.x > viewport().w - PIP_W;

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {mainHasVideo ? (
          <VideoTile stream={mainIsLocal ? localStream : remote.stream} muted={mainIsLocal} fit={mainFit} />
        ) : (
          <Avatar url={mainAvatarUrl} name={mainName} size={132} pulsing={mainIsLocal ? isMicOn : remote.micOn} />
        )}
        {/* Blanks the local tile while the camera is mid-flip rather than
            leaving whatever stale/black frame the browser happens to show
            between the old track stopping and the new one arriving — that
            stale frame read as an unwanted "thumbnail" during the switch. */}
        {mainIsLocal && isFlippingCamera && (
          <div style={{ position: 'absolute', inset: 0, background: '#0b0f1a' }} />
        )}
        {/* Remote audio must always play even when they're the PiP tile (or
            have no video at all) — a plain <video> only exists for whichever
            side is showing video, so this covers every other case. */}
        {!mainIsLocal && !mainHasVideo && <AudioRenderer stream={remote.stream} />}
        {mainIsLocal && pipHasVideo === false && <AudioRenderer stream={remote.stream} />}
      </div>

      {isVideo && remote.hasVideo && !remote.sharingScreen && !mainIsLocal && (
        <FitToggleButton large={largeScreen} mode={fitMode} onToggle={toggleFit} />
      )}

      {isVideo && (
        <div
          ref={pipElRef}
          className="ooc-pip"
          style={{
            top: pipXY.y, left: pipXY.x, touchAction: 'none',
            opacity: pipParked ? 0.6 : 1, transition: dragRef.current ? 'none' : 'opacity 0.2s ease',
          }}
          onPointerDown={onPipPointerDown}
          onPointerMove={onPipPointerMove}
          onPointerUp={onPipPointerUp}
          onPointerCancel={onPipPointerUp}
          onClick={(e) => e.stopPropagation()}
        >
          {pipHasVideo ? (
            <VideoTile stream={mainIsLocal ? remote.stream : localStream} muted={!mainIsLocal} fit={pipFit} />
          ) : (
            <Avatar url={pipAvatarUrl} name={mainIsLocal ? remote.displayName : 'You'} size={56} />
          )}
          {/* Same reasoning as the main-stage overlay above — blanks the PIP
              instead of showing a stale frame while the local camera flips,
              for whichever side (main or PIP) is currently showing it. */}
          {!mainIsLocal && isFlippingCamera && (
            <div style={{ position: 'absolute', inset: 0, background: '#131928' }} />
          )}
        </div>
      )}
    </>
  );
}
