// AddToCallSheet.jsx — the "Add to call" picker opened from the top bar of
// an active call. Lists every mutual friend (see GET /api/friends/mutual in
// backend/server.js) — exactly the set call:add-member's own server-side
// areFriends check already allows adding, regardless of whether there's any
// private-chat history with them. Selecting someone sends them a real ring
// (call:add-member -> a normal call:incoming on their end) through the same
// E2E-encrypted signaling path every other call invite already uses;
// nothing about adding a person weakens the call's encryption, it's just
// another pairwise NaCl-wrapped WebRTC handshake once they join (see
// CallContext.jsx's mesh design).
import React, { useEffect, useRef, useState } from 'react';
import { X, Search, UserPlus } from 'lucide-react';
import { API } from '../lib/api';
import { getInitials } from '../utils/avatarUtils';

export default function AddToCallSheet({ onClose, onAdd, alreadyInCall }) {
  const [partners, setPartners] = useState(null); // null = loading
  const [query, setQuery] = useState('');
  const [added, setAdded] = useState(new Set());
  const inputRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('watch_token');
    fetch(`${API}/api/friends/mutual`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setPartners(Array.isArray(d.friends) ? d.friends : []))
      .catch(() => setPartners([]));
    inputRef.current?.focus();
  }, []);

  const excludeLower = new Set((alreadyInCall || []).map(u => u.toLowerCase()));
  const filtered = (partners || []).filter(p => !excludeLower.has(p.username.toLowerCase()));
  const visible = query.trim()
    ? filtered.filter(p => p.displayName.toLowerCase().includes(query.trim().toLowerCase()) || p.username.toLowerCase().includes(query.trim().toLowerCase()))
    : filtered;

  const handlePick = (p) => {
    if (added.has(p.username)) return;
    setAdded(prev => new Set(prev).add(p.username));
    onAdd(p.username);
  };

  return (
    <div className="atc-overlay" onClick={onClose}>
      <div className="atc-sheet" onClick={(e) => e.stopPropagation()}>
        <style>{`
          .atc-overlay {
            position: absolute; inset: 0; z-index: 50; display: flex; align-items: flex-end;
            background: rgba(0,0,0,0.55);
          }
          .atc-sheet {
            width: 100%; max-height: 72vh; background: #14161f; border-radius: 20px 20px 0 0;
            display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom, 0px);
            box-shadow: 0 -16px 40px rgba(0,0,0,0.5);
            /* This sheet is a permanently-dark surface by design, same as the
               call screen it opens from — without pinning color-scheme, a
               WebView's own light/dark re-coloring pass (only relevant when
               the app's OWN theme is light) can recompute this sheet's white
               text against its own dark background and make it unreadable.
               Same fix as OneOnOneCallScreen.jsx/GlobalCallOverlay.jsx. */
            color-scheme: dark;
          }
          .atc-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px 10px; }
          .atc-title { color: #fff; font-weight: 800; font-size: 16px; }
          .atc-close { width: 30px; height: 30px; border-radius: 50%; border: none; background: rgba(255,255,255,0.1); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }
          .atc-search-wrap { display: flex; align-items: center; gap: 8px; margin: 4px 18px 12px; padding: 10px 12px; background: rgba(255,255,255,0.08); border-radius: 12px; }
          .atc-search-input { flex: 1; background: transparent; border: none; outline: none; color: #fff; font-size: 14px; }
          .atc-list { flex: 1; overflow-y: auto; padding: 0 8px 12px; }
          .atc-row { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 12px; cursor: pointer; }
          .atc-row:active { background: rgba(255,255,255,0.06); }
          .atc-avatar { width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--brand-1), var(--brand-2)); color: #fff; font-weight: 700; font-size: 14px; }
          .atc-avatar img { width: 100%; height: 100%; object-fit: cover; }
          .atc-name { color: #fff; font-weight: 700; font-size: 14px; }
          .atc-username { color: rgba(255,255,255,0.5); font-size: 12px; }
          .atc-empty { color: rgba(255,255,255,0.5); text-align: center; padding: 40px 20px; font-size: 13px; }
          .atc-add-btn { margin-left: auto; width: 32px; height: 32px; border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          /* Desktop web: a bottom sheet stretched across a full monitor width
             doesn't read as intentional — center it as a normal modal card
             instead, same content and behavior either way. */
          @media (min-width: 640px) {
            .atc-overlay { align-items: center; justify-content: center; }
            .atc-sheet { width: 420px; max-height: 68vh; border-radius: 20px; }
          }
        `}</style>
        <div className="atc-header">
          <span className="atc-title">Add to call</span>
          <button className="atc-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="atc-search-wrap">
          <Search size={15} color="rgba(255,255,255,0.5)" />
          <input
            ref={inputRef}
            className="atc-search-input"
            placeholder="Search your friends…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="atc-list">
          {partners === null ? (
            <div className="atc-empty">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="atc-empty">{query.trim() ? 'No matches' : 'No friends available to add'}</div>
          ) : (
            visible.map(p => {
              const isAdded = added.has(p.username);
              return (
                <div key={p.username} className="atc-row" onClick={() => handlePick(p)}>
                  <div className="atc-avatar">
                    {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : getInitials(p.displayName)}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="atc-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.displayName}</div>
                    <div className="atc-username">@{p.username}</div>
                  </div>
                  <button
                    className="atc-add-btn"
                    disabled={isAdded}
                    onClick={(e) => { e.stopPropagation(); handlePick(p); }}
                    style={{ background: isAdded ? 'rgba(16,185,129,0.25)' : 'rgba(var(--brand-1-rgb),0.25)', color: isAdded ? '#10b981' : 'var(--brand-1-light)' }}
                  >
                    <UserPlus size={15} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
