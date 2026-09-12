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
export default function PollBubble({ poll, pollVotes, myUsername, onVote, onViewVotes, isLight, resolveAvatar, accentColor = null }) {
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

  // The poll card is a neutral white/dark surface UNLESS this is my own sent
  // poll and I've picked a non-default Chat Theme — the caller only ever
  // passes accentColor in exactly that case (see the isMe/isCustomTheme/
  // !wallpaper condition at every call site), and when it does, the card's
  // own background switches to the theme's gradient too (see the isPoll
  // background override in GlobalChatWidget/RoomChatPanel). A colored card
  // needs the same white-on-dark text/track/option treatment dark mode's
  // neutral card already gets — reusing that exact value set (rather than
  // inventing new ones) is what makes a themed poll in light mode "look
  // like dark mode", same as the user asked.
  const themed = !!accentColor;
  const textColor = themed ? '#ffffff' : (isLight ? '#0f172a' : '#fff');
  const subColor = themed ? 'rgba(255,255,255,0.55)' : (isLight ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.55)');
  const trackColor = themed ? 'rgba(255,255,255,0.14)' : (isLight ? 'rgba(15,23,42,0.09)' : 'rgba(255,255,255,0.14)');
  const optionBg = themed ? 'rgba(255,255,255,0.045)' : (isLight ? 'rgba(15,23,42,0.03)' : 'rgba(255,255,255,0.045)');
  // A selected option's own highlight (border/background/checkbox/leading-
  // bar) is the one thing on this otherwise-neutral card that's always
  // brand-purple regardless of which Chat Theme color is picked — this is
  // the accent those pick up instead when the caller (a sent message with
  // a non-default theme) passes one; unset (received, or Default theme)
  // keeps today's plain var(--brand-1)/var(--brand-2) exactly as before.
  const accent = accentColor || 'var(--brand-1)';
  const accentSoftBg = accentColor ? `${accentColor}1a` : `rgba(var(--brand-1-rgb),${isLight ? '0.1' : '0.18'})`;

  return (
    // --poll-heading-c/-sub-c: read by App.jsx's light-mode .poll-question/
    // .poll-subtitle/.poll-view-votes overrides, which otherwise can't reach
    // these text colors — see the .stay-white cascade-war comment on
    // poll-question below. Only set when themed; App.jsx's own hardcoded
    // fallback covers the neutral-card case. "View votes" reuses -heading-c
    // (plain white) rather than the accentColor itself — the user asked for
    // that link to always read white on a themed card, not tinted to match
    // the theme the way the selected-option border/checkbox/leading-bar do.
    <div style={{ minWidth: 220, maxWidth: 280, ...(themed ? { '--poll-heading-c': '#ffffff', '--poll-sub-c': 'rgba(255,255,255,0.55)' } : {}) }}>
      {/* App.jsx's runtime light-mode stylesheet has a blanket
          `html[data-theme='light'] .msg-sent, .msg-sent * { color: #fff
          !important; -webkit-text-fill-color: #fff !important; }` rule —
          right, for the normal colored-gradient sent bubble, but a poll's
          card is neutral white/dark regardless of sender (see the isPoll
          background override), and that external !important rule beats any
          inline color/WebkitTextFillColor this component sets (inline
          styles only win over a NON-important external rule). The classes
          below (poll-question/-subtitle/-option-label/-count/-view-votes)
          give App.jsx's stylesheet something specific enough to carve a
          poll-only exception out of that blanket rule — see the matching
          override there. Keep any className here in sync with that file. */}
      <div className="poll-question" style={{ fontWeight: 800, fontSize: 15, color: textColor, WebkitTextFillColor: textColor, marginBottom: 4, wordBreak: 'break-word' }}>
        {poll.question}
      </div>
      <div className="poll-subtitle" style={{ fontSize: 11, color: subColor, WebkitTextFillColor: subColor, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
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
                background: selected ? (accentColor ? accentSoftBg : (isLight ? 'rgba(var(--brand-1-rgb),0.1)' : 'rgba(var(--brand-1-rgb),0.18)')) : optionBg,
                border: `1.5px solid ${selected ? accent : trackColor}`,
                borderRadius: 12, padding: '9px 12px', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 18, height: 18, flexShrink: 0,
                  borderRadius: poll.allowMultiple ? 5 : '50%',
                  border: `2px solid ${selected ? accent : subColor}`,
                  background: selected ? accent : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected && <Check size={12} color="#fff" strokeWidth={3} />}
                </div>
                <span className="poll-option-label" style={{ flex: 1, fontSize: 13.5, color: textColor, WebkitTextFillColor: textColor, fontWeight: selected ? 700 : 500 }}>{label}</span>
                {count > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {voterUsernames.slice(0, 3).map((u, idx) => (
                      <VoterAvatar key={u} username={u} avatar={resolveAvatar?.(u)} style={{ marginLeft: idx > 0 ? -8 : 0, zIndex: 3 - idx }} />
                    ))}
                    <span className="poll-count" style={{ fontSize: 12, color: subColor, WebkitTextFillColor: subColor, fontWeight: 700, marginLeft: 2 }}>{count}</span>
                  </div>
                )}
              </div>
              {count > 0 && (
                <div style={{ height: 4, borderRadius: 2, background: trackColor, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`, borderRadius: 2,
                    background: isLeading ? (accentColor || 'linear-gradient(90deg,var(--brand-1),var(--brand-2))') : subColor,
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
          className="poll-view-votes"
          onClick={onViewVotes}
          style={{
            marginTop: 10, background: 'transparent', border: 'none', color: themed ? '#ffffff' : 'var(--brand-1-light)', WebkitTextFillColor: themed ? '#ffffff' : 'var(--brand-1-light)',
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
        // stay-white: this letter sits on the brand-colored circle above,
        // never on the poll's own white/dark card, so it always needs to
        // read white regardless of theme — without this class, App.jsx's
        // light-mode stylesheet has a blanket rule that rewrites any
        // literal white inline color (this one included) to near-black,
        // same bug as the poll text fix, just via its "force white text
        // dark" rule instead of its "force sent-bubble text white" one.
        <span className="stay-white" style={{ fontSize: 9, fontWeight: 800, color: '#fff' }}>{initial}</span>
      )}
    </div>
  );
}
