import React from 'react';
import { Check } from 'lucide-react';

// Renders a poll message's live question/options/vote-bars, and handles
// tapping an option to cast/change/withdraw this user's own vote. Takes
// already-decrypted `poll` ({question, options, allowMultiple}) — this
// component has no idea messages are encrypted, matching how it's handed
// plain data the same way any other decrypted message field already is.
// `pollVotes` is the plain (never-encrypted) { username: [optionIndex,...] }
// map straight off the message — see the poll_votes column comment in
// server.js for why that field alone is safe to leave unencrypted.
export default function PollBubble({ poll, pollVotes, myUsername, onVote, onViewVotes, isLight, resolveAvatar }) {
  if (!poll || !Array.isArray(poll.options)) return null;

  const votes = pollVotes || {};
  const myVotes = votes[myUsername.toLowerCase()] || votes[myUsername] || [];
  const counts = poll.options.map((_, i) =>
    Object.values(votes).filter(arr => Array.isArray(arr) && arr.includes(i)).length
  );
  const totalVoters = Object.keys(votes).length;
  const maxCount = Math.max(0, ...counts);

  const toggle = (i) => {
    if (poll.allowMultiple) {
      const next = myVotes.includes(i) ? myVotes.filter(v => v !== i) : [...myVotes, i];
      onVote(next);
    } else {
      onVote(myVotes.includes(i) ? [] : [i]);
    }
  };

  // The poll card itself is always a neutral surface (see the isPoll override
  // in GlobalChatWidget's bubble background) regardless of isMe/wallpaper/
  // custom theme — these colors just need to read clearly against THAT plain
  // card, not against the vivid sent-bubble gradient the rest of the app uses.
  const textColor = isLight ? '#0f172a' : '#fff';
  const subColor = isLight ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.55)';
  const trackColor = isLight ? 'rgba(15,23,42,0.09)' : 'rgba(255,255,255,0.14)';
  const optionBg = isLight ? 'rgba(15,23,42,0.03)' : 'rgba(255,255,255,0.045)';

  return (
    <div style={{ minWidth: 220, maxWidth: 280 }}>
      <div style={{ fontWeight: 800, fontSize: 15, color: textColor, marginBottom: 4, wordBreak: 'break-word' }}>
        {poll.question}
      </div>
      <div style={{ fontSize: 11, color: subColor, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
        <Check size={11} />
        {poll.allowMultiple ? 'Select one or more' : 'Select one'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {poll.options.map((label, i) => {
          const selected = myVotes.includes(i);
          const count = counts[i];
          const pct = totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0;
          const isLeading = count > 0 && count === maxCount;
          const voterUsernames = Object.entries(votes).filter(([, arr]) => Array.isArray(arr) && arr.includes(i)).map(([u]) => u);

          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              style={{
                display: 'flex', flexDirection: 'column', gap: 6, width: '100%', textAlign: 'left',
                background: selected ? (isLight ? 'rgba(var(--brand-1-rgb),0.1)' : 'rgba(var(--brand-1-rgb),0.18)') : optionBg,
                border: `1.5px solid ${selected ? 'var(--brand-1)' : trackColor}`,
                borderRadius: 12, padding: '9px 12px', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 18, height: 18, flexShrink: 0,
                  borderRadius: poll.allowMultiple ? 5 : '50%',
                  border: `2px solid ${selected ? 'var(--brand-1)' : subColor}`,
                  background: selected ? 'var(--brand-1)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected && <Check size={12} color="#fff" strokeWidth={3} />}
                </div>
                <span style={{ flex: 1, fontSize: 13.5, color: textColor, fontWeight: selected ? 700 : 500 }}>{label}</span>
                {count > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {voterUsernames.slice(0, 3).map((u, idx) => (
                      <VoterAvatar key={u} username={u} avatar={resolveAvatar?.(u)} style={{ marginLeft: idx > 0 ? -8 : 0, zIndex: 3 - idx }} />
                    ))}
                    <span style={{ fontSize: 12, color: subColor, fontWeight: 700, marginLeft: 2 }}>{count}</span>
                  </div>
                )}
              </div>
              {count > 0 && (
                <div style={{ height: 4, borderRadius: 2, background: trackColor, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`, borderRadius: 2,
                    background: isLeading ? 'linear-gradient(90deg,var(--brand-1),var(--brand-2))' : subColor,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {totalVoters > 0 && (
        <button
          onClick={onViewVotes}
          style={{
            marginTop: 10, background: 'transparent', border: 'none', color: 'var(--brand-1-light)',
            fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '4px 0',
          }}
        >
          View votes
        </button>
      )}
    </div>
  );
}

function VoterAvatar({ username, avatar, style }) {
  const initial = (username || '?').charAt(0).toUpperCase();
  return (
    <div style={{
      width: 18, height: 18, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      border: '1.5px solid var(--bg-color, #111)', background: 'var(--brand-2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', ...style,
    }}>
      {avatar ? (
        <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ fontSize: 9, fontWeight: 800, color: '#fff' }}>{initial}</span>
      )}
    </div>
  );
}
