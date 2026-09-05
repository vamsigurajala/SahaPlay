import React from 'react';

// A placeholder card matching the shape of a real room card (Home.jsx,
// PinnedRoomsGrid.jsx, and PublicRooms.jsx each already define .pinned-card/
// .img-layer/.footer-layer in their own <style> block, per PinnedRoomsGrid's
// own comment) — shown while real room data is still loading, so a slow or
// cold-start fetch reads as "loading" instead of silently looking identical
// to "there's nothing here," which is what both pages did before this: an
// empty array during loading was indistinguishable from a genuinely empty
// result, so PublicRooms.jsx would even show "No Public Rooms Available"
// for as long as the fetch was still pending.
export default function RoomCardSkeleton({ count = 3 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="pinned-card room-card-skeleton" aria-hidden="true">
          <div className="img-layer" />
          <div className="footer-layer">
            <div className="skeleton-line skeleton-line-title" />
            <div className="skeleton-line skeleton-line-meta" />
          </div>
        </div>
      ))}
      <style>{`
        @keyframes sp-skeleton-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .room-card-skeleton { cursor: default; }
        .room-card-skeleton .img-layer,
        .room-card-skeleton .skeleton-line {
          background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 75%);
          background-size: 200% 100%;
          animation: sp-skeleton-shimmer 1.5s ease-in-out infinite;
        }
        html[data-theme='light'] .room-card-skeleton .img-layer,
        html[data-theme='light'] .room-card-skeleton .skeleton-line {
          background: linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.09) 50%, rgba(0,0,0,0.04) 75%);
          background-size: 200% 100%;
        }
        .skeleton-line { height: 12px; border-radius: 6px; }
        .skeleton-line-title { width: 70%; height: 15px; margin-bottom: 6px; }
        .skeleton-line-meta { width: 45%; }
        @media (prefers-reduced-motion: reduce) {
          .room-card-skeleton .img-layer, .room-card-skeleton .skeleton-line { animation: none; }
        }
      `}</style>
    </>
  );
}
