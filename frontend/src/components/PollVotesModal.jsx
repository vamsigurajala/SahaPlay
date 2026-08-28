import React from 'react';
import { ArrowLeft, Star } from 'lucide-react';

// "View votes" breakdown — who voted for what, with avatar + display name
// per voter. Pure presentation: takes the same already-decrypted `poll`
// and plain `pollVotes` PollBubble does, plus resolver callbacks the
// caller already has (avatar/display-name lookups are per-surface —
// GlobalChatWidget and RoomChatPanel each know their own participants
// differently, so this stays decoupled from how that's resolved).
export default function PollVotesModal({ poll, pollVotes, onClose, isLight, resolveAvatar, resolveDisplayName }) {
  const votes = pollVotes || {};
  const counts = poll.options.map((_, i) =>
    Object.entries(votes).filter(([, arr]) => Array.isArray(arr) && arr.includes(i))
  );
  const maxCount = Math.max(0, ...counts.map(c => c.length));

  const textColor = isLight ? '#0f172a' : '#fff';
  const subColor = isLight ? 'rgba(15,23,42,0.5)' : 'rgba(255,255,255,0.5)';
  const border = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)';
  const bg = isLight ? '#ffffff' : '#0e0e14';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000006, background: bg, display: 'flex', flexDirection: 'column', color: textColor }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
        paddingTop: 'calc(16px + var(--sp-status-bar-inset, 0px))',
        borderBottom: `1px solid ${border}`, flexShrink: 0,
      }}>
        <button onClick={onClose} aria-label="Back" style={{ background: 'transparent', border: 'none', color: textColor, cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Poll votes</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px', overscrollBehavior: 'contain' }} className="no-scrollbar">
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>{poll.question}</div>

        {poll.options.map((label, i) => {
          const voters = counts[i];
          const isLeading = voters.length > 0 && voters.length === maxCount;
          return (
            <div key={i} style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 14.5, fontWeight: 700 }}>{label}</span>
                <span style={{ fontSize: 13, color: subColor, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {voters.length}
                  {isLeading && <Star size={13} fill={subColor} color={subColor} />}
                </span>
              </div>
              {voters.length === 0 ? (
                <div style={{ fontSize: 12.5, color: subColor, fontStyle: 'italic' }}>No votes yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {voters.map(([username]) => {
                    const avatar = resolveAvatar?.(username);
                    const displayName = resolveDisplayName?.(username) || username;
                    return (
                      <div key={username} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                          background: 'var(--brand-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {avatar ? (
                            <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{(username || '?').charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{displayName}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {i < poll.options.length - 1 && <div style={{ height: 1, background: border, marginTop: 20 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
