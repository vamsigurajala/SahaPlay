import React from 'react';

// Instagram-style "double-tap to like" burst — a big emoji pops in with an
// overshoot bounce-and-wiggle, holds a beat, then fades. The reaction
// itself is already recorded by the caller's own handleReact/
// handleGroupReact/handleDmReact the instant the double-tap fires; this is
// purely the "something happened" feedback layer so a double-tap reads as
// an event on mobile/tablet instead of the little reaction badge just
// quietly appearing under the bubble a moment later with no acknowledgment.
//
// Mount this as a child of the message bubble (which already has
// position:relative at every call site) only while its burst is active —
// each caller owns a short-lived "which message is currently bursting"
// piece of state and un-mounts this after ~900ms; see its three call sites
// (GlobalChatWidget.jsx, RoomChatPanel.jsx x2) for that timer.
export default function DoubleTapBurst({ emoji = '❤️' }) {
  return (
    <div className="dtap-burst-overlay" aria-hidden="true">
      <span className="dtap-burst-emoji">{emoji}</span>
      <style>{`
        .dtap-burst-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 20;
          overflow: visible;
        }
        .dtap-burst-emoji {
          font-size: 60px;
          line-height: 1;
          filter: drop-shadow(0 6px 16px rgba(0,0,0,0.4));
          animation: dtapBurstPop 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          will-change: transform, opacity;
        }
        @keyframes dtapBurstPop {
          0%   { transform: scale(0) rotate(0deg); opacity: 0; }
          22%  { transform: scale(1.35) rotate(-14deg); opacity: 1; }
          38%  { transform: scale(0.9) rotate(10deg); opacity: 1; }
          54%  { transform: scale(1.1) rotate(-6deg); opacity: 1; }
          70%  { transform: scale(0.98) rotate(3deg); opacity: 1; }
          85%  { transform: scale(1) rotate(0deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .dtap-burst-emoji { animation: dtapBurstFadeOnly 0.85s ease forwards; }
        }
        @keyframes dtapBurstFadeOnly {
          0% { opacity: 0; }
          15% { opacity: 1; }
          75% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
