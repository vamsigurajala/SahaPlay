import React, { useState, useEffect, useCallback, useRef, createContext, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { io } from 'socket.io-client';
import './Admin.css';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Shield, Ban, CheckCircle, Search,
  RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, X,
  LogOut, Clock, Infinity as InfinityIcon, Activity, UserCheck, ExternalLink,
  Trash2, FileText, Crown, UserMinus, ChevronDown, ChevronUp,
  Inbox, UserCog, Mail, Paperclip, Calendar,
} from 'lucide-react';
import { getAvatarUrl } from './utils/avatarUtils';
import MediaLightbox from './components/MediaLightbox';
import { API as API_BASE } from './lib/api';

function authHeaders() {
  const token = localStorage.getItem('watch_token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const AdminThemeCtx = createContext(false); // false=dark, true=light

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color = '#6366f1', sub, onClick }) {
  const [hovered, setHovered] = useState(false);
  const clickable = !!onClick;
  const isLight = React.useContext(AdminThemeCtx);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered && clickable
          ? (isLight ? '#f9fafb' : 'rgba(255,255,255,0.07)')
          : (isLight ? '#ffffff' : 'rgba(255,255,255,0.04)'),
        border: hovered && clickable
          ? `1px solid ${color}55`
          : (isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.08)'),
        borderRadius: 16, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 8,
        flex: '1 1 180px', minWidth: 160, cursor: clickable ? 'pointer' : 'default',
        transition: 'background 0.15s, border-color 0.15s',
        position: 'relative',
        boxShadow: isLight ? '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: isLight ? '#4b5563' : 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: '0.03em' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {clickable && hovered && <ExternalLink size={12} color={color} style={{ opacity: 0.7 }} />}
          <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={16} color={color} />
          </div>
        </div>
      </div>
      <span style={{ fontSize: 32, fontWeight: 800, color: isLight ? '#111827' : '#fff', lineHeight: 1 }}>{value ?? '—'}</span>
      {sub && <span style={{ fontSize: 12, color: isLight ? '#6b7280' : 'rgba(255,255,255,0.35)' }}>{sub}</span>}
    </div>
  );
}

// ─── Terminate Modal ──────────────────────────────────────────────────────────
function TerminateModal({ user, onClose, onTerminated }) {
  const isLight = React.useContext(AdminThemeCtx);
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = confirmText === 'TERMINATE' && reason.trim();

  async function submit() {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await apiFetch(`/api/admin/users/${user.id}/terminate`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      onTerminated();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 10000, background: isLight ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className="admin-modal-card" onClick={e => e.stopPropagation()} style={{
        background: isLight ? '#ffffff' : '#000000', border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.15)',
        borderRadius: 20, width: '100%', maxWidth: 420, padding: 32,
        boxShadow: isLight ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={20} color="#ef4444" />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: isLight ? '#000000' : '#ffffff' }}>Terminate @{user.username}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ margin: '0 0 20px', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.5 }}>
          This permanently disables the account. The user will not be able to log in or use the platform ever again.
        </p>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#f87171', marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: isLight ? '#374151' : 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 6 }}>REASON (required)</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Describe why this account is being terminated…"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10, border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.12)',
              background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)', color: isLight ? '#000000' : '#ffffff', fontSize: 14, resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#ef4444', fontWeight: 700, marginBottom: 6 }}>
            TYPE "TERMINATE" TO CONFIRM
          </label>
          <input
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder='Type "TERMINATE" here'
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10, border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.12)',
              background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)', color: isLight ? '#000000' : '#ffffff', fontSize: 14, boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          className="stay-white"
          onClick={submit}
          disabled={!canSubmit || loading}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
            background: canSubmit && !loading ? '#dc2626' : (isLight ? '#e2e8f0' : 'rgba(220,38,38,0.25)'),
            color: isLight ? (canSubmit && !loading ? '#fff' : '#000') : '#fff', fontWeight: 800, fontSize: 15, cursor: canSubmit && !loading ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? 'Terminating…' : 'Terminate Account'}
        </button>
      </div>
    </div>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────
function DetailDrawer({ title, type, filter = 'all', onClose }) {
  const isLight = React.useContext(AdminThemeCtx);
  const watchRole = localStorage.getItem('watch_role') || 'user';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dbPage, setDbPage] = useState(1);
  const [dbPages, setDbPages] = useState(1);
  const [dbTotal, setDbTotal] = useState(0);
  const [banTarget, setBanTarget] = useState(null);
  const [terminateTarget, setTerminateTarget] = useState(null);
  const searchTimer = useRef(null);

  const isDbRooms = type === 'db-rooms';
  const isUserList = type === 'online-users' || type === 'guest-users';
  const isGuest = type === 'guest-users';
  const showSearch = type === 'active-rooms' || isDbRooms;

  function fetchData() {
    const path = type === 'online-users' ? '/api/admin/online-users'
      : type === 'guest-users' ? '/api/admin/guest-users'
      : `/api/admin/active-rooms?filter=${filter}`;
    setLoading(true);
    apiFetch(path)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  function fetchDbRooms(s = '', p = 1) {
    setLoading(true);
    apiFetch(`/api/admin/db-rooms?filter=${filter}&search=${encodeURIComponent(s)}&page=${p}&limit=20`)
      .then(d => { setData(d); setDbPage(d.page); setDbPages(d.pages || 1); setDbTotal(d.total); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  useEffect(() => {
    setSearch('');
    setDbPage(1);
    if (isDbRooms) {
      fetchDbRooms('', 1);
    } else {
      fetchData();
      const intervalId = setInterval(() => {
        const path = type === 'online-users' ? '/api/admin/online-users'
          : type === 'guest-users' ? '/api/admin/guest-users'
          : `/api/admin/active-rooms?filter=${filter}`;
        apiFetch(path)
          .then(d => { setData(d); })
          .catch((err) => console.error('[ADMIN] Silent fetch failure:', err.message));
      }, 10000);
      return () => clearInterval(intervalId);
    }
  }, [type, filter]);

  function handleSearch(val) {
    setSearch(val);
    if (isDbRooms) {
      setDbPage(1);
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => fetchDbRooms(val, 1), 350);
    }
  }

  const activeRoomList = (() => {
    if (type !== 'active-rooms') return [];
    const list = data?.rooms || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(r => r.roomName?.toLowerCase().includes(q) || r.roomId?.toLowerCase().includes(q));
  })();

  const dbRoomList = isDbRooms ? (data?.rooms || []) : [];

  const roomBadge = (isPublic) => ({
    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
    background: isPublic ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
    color: isPublic ? '#34d399' : '#818cf8',
    border: `1px solid ${isPublic ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}`,
  });

  return (
    <>
      {banTarget && (
        <BanModal user={banTarget} onClose={() => setBanTarget(null)} onBanned={() => isDbRooms ? fetchDbRooms(search, dbPage) : fetchData()} />
      )}
      {terminateTarget && (
        <TerminateModal user={terminateTarget} onClose={() => setTerminateTarget(null)} onTerminated={() => isDbRooms ? fetchDbRooms(search, dbPage) : fetchData()} />
      )}

      <div onClick={onClose} className="room-modals-overlay" style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: isLight ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(5px)'
      }} />
      <div className="admin-detail-drawer" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201,
        background: isLight ? '#ffffff' : '#0f0f1e',
        borderLeft: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column',
        boxShadow: isLight ? 'none' : '-24px 0 60px rgba(0,0,0,0.6)',
        animation: 'slideIn 0.2s ease',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: isLight ? '1px solid #f3f4f6' : '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0
        }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: isLight ? '#111827' : '#fff' }}>{title}</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none',
            color: isLight ? '#374151' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer', padding: 4, display: 'flex'
          }}>
            <X size={20} />
          </button>
        </div>

        {showSearch && (
          <div style={{
            padding: '10px 24px',
            borderBottom: isLight ? '1px solid #f3f4f6' : '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0
          }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{
                position: 'absolute', left: 10, top: '50%',
                transform: 'translateY(-50%)',
                color: isLight ? '#6b7280' : 'rgba(255,255,255,0.3)'
              }} />
              <input
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search by room name or ID…"
                style={{
                  width: '100%', padding: '8px 12px 8px 30px', borderRadius: 8,
                  border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)',
                  background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.05)',
                  color: isLight ? '#111827' : '#fff',
                  fontSize: 13, boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '20px 24px' }}>
          {loading && <div style={{ color: isLight ? '#6b7280' : 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 60, fontSize: 14 }}>Loading…</div>}
          {error && <div style={{ color: '#f87171', fontSize: 14 }}>{error}</div>}

          {!loading && !error && isUserList && (() => {
            const users = data?.users || [];
            return (
              <div style={{ minWidth: 380 }}>
                <p style={{
                  margin: '0 0 16px',
                  color: isLight ? '#4b5563' : 'rgba(255,255,255,0.35)',
                  fontSize: 13
                }}>
                  {data?.count ?? 0} {isGuest ? 'guest account' : 'registered user'}{(data?.count ?? 0) !== 1 ? 's' : ''} online now
                </p>
                {users.length === 0
                  ? <div style={{ color: isLight ? '#6b7280' : 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 40, fontSize: 14 }}>
                      No {isGuest ? 'guest accounts' : 'users'} online
                    </div>
                  : users.map(u => (
                    <div key={u.username} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', marginBottom: 6,
                      background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.03)',
                      borderRadius: 10,
                      border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.06)'
                    }}>
                      {u.avatarPath
                        ? <img src={getAvatarUrl(u.avatarPath)} alt="" loading="lazy" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: isGuest ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="stay-white" style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{(u.username || '?')[0].toUpperCase()}</span>
                          </div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: isLight ? '#111827' : '#fff', fontWeight: 600, fontSize: 14 }}>@{u.username}</div>
                        {u.displayName && <div style={{ color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', fontSize: 12 }}>{u.displayName}</div>}
                      </div>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }} />
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {['super_admin', 'admin', 'moderator'].includes(watchRole) && !['super_admin', 'admin'].includes(u.role) && (
                          <button onClick={() => setBanTarget(u)} style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Ban size={11} /> Ban
                          </button>
                        )}
                        {['super_admin', 'admin'].includes(watchRole) && !['super_admin', 'admin'].includes(u.role) && (
                          <button onClick={() => setTerminateTarget(u)} style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.18)', color: '#ef4444', fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertTriangle size={11} /> Terminate
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                }
              </div>
            );
          })()}

          {!loading && !error && type === 'active-rooms' && (() => (
            <div style={{ minWidth: 380 }}>
              <p style={{ margin: '0 0 16px', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.35)', fontSize: 13 }}>
                {activeRoomList.length} room{activeRoomList.length !== 1 ? 's' : ''}{search ? ' found' : ' with active connections'}
              </p>
              {activeRoomList.length === 0
                ? <div style={{ color: isLight ? '#6b7280' : 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 40, fontSize: 14 }}>
                    {search ? 'No rooms match your search' : 'No active rooms'}
                  </div>
                : activeRoomList.map(r => (
                  <div key={r.roomId} style={{
                    padding: '12px 14px', marginBottom: 8,
                    background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.04)',
                    borderRadius: 10,
                    border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.08)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ color: isLight ? '#111827' : '#fff', fontWeight: 700, fontSize: 14 }}>{r.roomName}</span>
                      <span style={roomBadge(r.isPublic)}>{r.isPublic ? 'Public' : 'Private'}</span>
                    </div>
                    <div style={{ color: isLight ? '#4b5563' : 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'monospace', marginBottom: 4 }}>ID: {r.roomId}</div>
                    <div style={{ color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                      Host: @{r.hostUsername} · {r.memberCount} viewer{r.memberCount !== 1 ? 's' : ''}
                      {r.category !== '—' ? ` · ${r.category}` : ''}
                    </div>
                  </div>
                ))
              }
            </div>
          ))()}

          {!loading && !error && isDbRooms && (() => (
            <div style={{ minWidth: 380 }}>
              <p style={{ margin: '0 0 16px', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.35)', fontSize: 13 }}>
                {dbTotal.toLocaleString()} room{dbTotal !== 1 ? 's' : ''} in database
              </p>
              {dbRoomList.length === 0
                ? <div style={{ color: isLight ? '#6b7280' : 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 40, fontSize: 14 }}>
                    {search ? 'No rooms match your search' : 'No rooms found'}
                  </div>
                : dbRoomList.map(r => (
                  <div key={r.roomId} style={{
                    padding: '12px 14px', marginBottom: 8,
                    background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.04)',
                    borderRadius: 10,
                    border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.08)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ color: isLight ? '#111827' : '#fff', fontWeight: 700, fontSize: 14 }}>{r.roomName}</span>
                      <span style={roomBadge(r.isPublic)}>{r.isPublic ? 'Public' : 'Private'}</span>
                    </div>
                    <div style={{ color: isLight ? '#4b5563' : 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'monospace', marginBottom: 4 }}>ID: {r.roomId}</div>
                    <div style={{ color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                      Host: @{r.hostUsername || '—'}
                      {r.category ? ` · ${r.category}` : ''}
                      {r.created_at ? ` · ${new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                    </div>
                  </div>
                ))
              }
              {dbPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                  <button onClick={() => { const p = Math.max(1, dbPage - 1); setDbPage(p); fetchDbRooms(search, p); }} disabled={dbPage === 1}
                    style={{
                      padding: '5px 10px', borderRadius: 7,
                      border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)',
                      background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)',
                      color: dbPage === 1 ? (isLight ? '#d1d5db' : 'rgba(255,255,255,0.2)') : (isLight ? '#374151' : '#fff'),
                      cursor: dbPage === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center'
                    }}>
                    <ChevronLeft size={13} />
                  </button>
                  <span style={{ color: isLight ? '#4b5563' : 'rgba(255,255,255,0.45)', fontSize: 12 }}>Page {dbPage} of {dbPages}</span>
                  <button onClick={() => { const p = Math.min(dbPages, dbPage + 1); setDbPage(p); fetchDbRooms(search, p); }} disabled={dbPage === dbPages}
                    style={{
                      padding: '5px 10px', borderRadius: 7,
                      border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)',
                      background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)',
                      color: dbPage === dbPages ? (isLight ? '#d1d5db' : 'rgba(255,255,255,0.2)') : (isLight ? '#374151' : '#fff'),
                      cursor: dbPage === dbPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center'
                    }}>
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>
          ))()}
        </div>
      </div>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  );
}

// ─── Access Denied Page ───────────────────────────────────────────────────────
function AccessDeniedPage({ tabLabel }) {
  const isLight = React.useContext(AdminThemeCtx);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      flex: 1, padding: 40, textAlign: 'center', background: isLight ? '#f9fafb' : '#0a0a12'
    }}>
      <div style={{
        background: isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.1)',
        color: '#ef4444', borderRadius: '50%', padding: 16, marginBottom: 20
      }}>
        <Shield size={48} />
      </div>
      <h2 style={{
        margin: '0 0 10px', fontSize: 22, fontWeight: 800,
        color: isLight ? '#111827' : '#fff'
      }}>
        Access Denied
      </h2>
      <p style={{
        margin: 0, fontSize: 15, maxWidth: 380, lineHeight: 1.5,
        color: isLight ? '#4b5563' : 'rgba(255,255,255,0.45)'
      }}>
        You do not have access to the {tabLabel} page. Please contact a Super Admin if you believe this is an error.
      </p>
    </div>
  );
}

// ─── Overview Page ────────────────────────────────────────────────────────────
function OverviewPage({ onNavigate }) {
  const isLight = React.useContext(AdminThemeCtx);
  const watchRole = localStorage.getItem('watch_role') || 'user';
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState(null); // { type, title }
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function poll() {
      if (!mounted) return;
      try {
        const data = await apiFetch('/api/admin/stats');
        if (mounted) { setStats(data); setError(''); setLastUpdated(new Date()); }
      } catch (e) {
        if (mounted) setError(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    poll();
    const id = setInterval(poll, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  function manualRefresh() {
    setLoading(true);
    apiFetch('/api/admin/stats')
      .then(d => { setStats(d); setError(''); setLastUpdated(new Date()); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  const fmtTime = d => d ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

  return (
    <div className="admin-page-container" style={{ maxWidth: 1100, overflowY: 'auto', flex: 1, minHeight: 0 }}>
      {drawer && (
        <DetailDrawer title={drawer.title} type={drawer.type} filter={drawer.filter || 'all'} onClose={() => setDrawer(null)} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: isLight ? '#111827' : '#fff' }}>Overview</h1>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 1.5s ease infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399', letterSpacing: '0.06em' }}>LIVE</span>
            </span>
          </div>
          <p style={{ margin: '4px 0 0', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.35)', fontSize: 13 }}>
            Auto-refreshes every 5s · Click any card to see details
            {lastUpdated && ` · Last updated ${fmtTime(lastUpdated)}`}
          </p>
        </div>
        <button onClick={manualRefresh} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
          background: isLight ? '#ffffff' : 'rgba(255,255,255,0.06)',
          border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, color: isLight ? '#374151' : '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
        }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '14px 18px', color: '#f87171', marginBottom: 24, fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading && !stats ? (
        <div style={{ color: isLight ? '#6b7280' : 'rgba(255,255,255,0.4)', fontSize: 15, marginTop: 60, textAlign: 'center' }}>Loading stats…</div>
      ) : stats ? (
        <>
          <h3 style={{ margin: '0 0 14px', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.5)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Users</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 32 }}>
            <StatCard label="Total Users" value={stats.totalUsers.toLocaleString()} icon={Users} color="#6366f1"
              onClick={['super_admin', 'admin', 'moderator'].includes(watchRole) ? () => onNavigate('users') : undefined}
              sub={['super_admin', 'admin', 'moderator'].includes(watchRole) ? "Click to manage all users" : undefined} />
            <StatCard label="New This Month" value={stats.newThisMonth.toLocaleString()} icon={UserCheck} color="#10b981"
              onClick={['super_admin', 'admin', 'moderator'].includes(watchRole) ? () => onNavigate('users', 'this_month') : undefined}
              sub={['super_admin', 'admin', 'moderator'].includes(watchRole) ? "Click to view in user list" : undefined} />
            <StatCard label="New This Week" value={stats.newThisWeek.toLocaleString()} icon={UserCheck} color="#a855f7"
              onClick={['super_admin', 'admin', 'moderator'].includes(watchRole) ? () => onNavigate('users', 'this_week') : undefined}
              sub={['super_admin', 'admin', 'moderator'].includes(watchRole) ? "Click to view in user list" : undefined} />
          </div>

          <h3 style={{ margin: '0 0 14px', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.5)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Online Now</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 32 }}>
            <StatCard label="Logged-in Users" value={stats.loggedInOnline.toLocaleString()} icon={Activity} color="#6366f1"
              sub={['super_admin', 'admin'].includes(watchRole) ? "Click to see who's online" : undefined}
              onClick={['super_admin', 'admin'].includes(watchRole) ? () => setDrawer({ type: 'online-users', title: 'Logged-in Users Online' }) : undefined} />
            <StatCard label="Guests" value={stats.guestsOnline.toLocaleString()} icon={Users} color="#f59e0b"
              sub={['super_admin', 'admin'].includes(watchRole) ? "Click to see guest accounts online" : undefined}
              onClick={['super_admin', 'admin'].includes(watchRole) ? () => setDrawer({ type: 'guest-users', title: 'Guest Accounts Online' }) : undefined} />
          </div>

          <h3 style={{ margin: '0 0 14px', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.5)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Rooms</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            <StatCard label="Active Rooms Now" value={stats.activeRoomsNow.toLocaleString()} icon={LayoutDashboard} color="#6366f1"
              sub={['super_admin', 'admin', 'moderator'].includes(watchRole) ? "Click to see active rooms" : undefined}
              onClick={['super_admin', 'admin', 'moderator'].includes(watchRole) ? () => setDrawer({ type: 'active-rooms', title: 'Active Rooms', filter: 'all' }) : undefined} />
            <StatCard label="Active Public" value={stats.activePublicRooms.toLocaleString()} icon={LayoutDashboard} color="#10b981"
              sub={['super_admin', 'admin', 'moderator'].includes(watchRole) ? "Click to see active public rooms" : undefined}
              onClick={['super_admin', 'admin', 'moderator'].includes(watchRole) ? () => setDrawer({ type: 'active-rooms', title: 'Active Public Rooms', filter: 'public' }) : undefined} />
            <StatCard label="Active Private" value={stats.activePrivateRooms.toLocaleString()} icon={LayoutDashboard} color="#f59e0b"
              sub={['super_admin', 'admin', 'moderator'].includes(watchRole) ? "Click to see active private rooms" : undefined}
              onClick={['super_admin', 'admin', 'moderator'].includes(watchRole) ? () => setDrawer({ type: 'active-rooms', title: 'Active Private Rooms', filter: 'private' }) : undefined} />
            <StatCard label="Total Public Rooms (DB)" value={stats.totalPublicRooms.toLocaleString()} icon={LayoutDashboard} color="#a855f7"
              sub={['super_admin', 'admin', 'moderator'].includes(watchRole) ? "Click to browse all public rooms" : undefined}
              onClick={['super_admin', 'admin', 'moderator'].includes(watchRole) ? () => setDrawer({ type: 'db-rooms', title: 'All Public Rooms (DB)', filter: 'public' }) : undefined} />
          </div>
        </>
      ) : null}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
      `}</style>
    </div>
  );
}

// ─── Ban Modal ────────────────────────────────────────────────────────────────
function BanModal({ user, onClose, onBanned }) {
  const isLight = React.useContext(AdminThemeCtx);
  const watchRole = localStorage.getItem('watch_role') || 'user';
  const [banType, setBanType] = useState('temporary');
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString();
  });
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  const parsedDate = useMemo(() => new Date(expiresAt), [expiresAt]);
  const [navYear, setNavYear] = useState(() => parsedDate.getFullYear());
  const [navMonth, setNavMonth] = useState(() => parsedDate.getMonth());

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handleSelectDay = (day) => {
    const d = new Date(parsedDate);
    d.setFullYear(navYear);
    d.setMonth(navMonth);
    d.setDate(day);
    setExpiresAt(d.toISOString());
  };

  const handleSelectTime = (type, val) => {
    const d = new Date(parsedDate);
    let hours = d.getHours();
    
    if (type === 'hour') {
      const isPM = hours >= 12;
      hours = parseInt(val, 10);
      if (isPM && hours < 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
    } else if (type === 'minute') {
      d.setMinutes(parseInt(val, 10));
      setExpiresAt(d.toISOString());
      return;
    } else if (type === 'ampm') {
      const currentIsPM = hours >= 12;
      if (val === 'PM' && !currentIsPM) hours += 12;
      if (val === 'AM' && currentIsPM) hours -= 12;
    }
    
    d.setHours(hours);
    setExpiresAt(d.toISOString());
  };

  const formatDateString = (isoString) => {
    try {
      const d = new Date(isoString);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const day = d.getDate();
      const year = d.getFullYear();
      let hour = d.getHours();
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12;
      hour = hour ? hour : 12;
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${month} ${day}, ${year} ${String(hour).padStart(2, '0')}:${min} ${ampm}`;
    } catch {
      return isoString;
    }
  };

  const hours12 = (() => {
    const h = parsedDate.getHours();
    const val = h % 12;
    return val === 0 ? 12 : val;
  })();
  const minutesVal = String(parsedDate.getMinutes()).padStart(2, '0');
  const ampmVal = parsedDate.getHours() >= 12 ? 'PM' : 'AM';

  const isPermanent = banType === 'permanent';
  const canSubmit = isPermanent ? confirmText === 'BAN' && reason.trim() : reason.trim();

  async function submit() {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await apiFetch(`/api/admin/users/${user.id}/ban`, {
        method: 'POST',
        body: JSON.stringify({ type: banType, expiresAt: isPermanent ? null : expiresAt, reason: reason.trim() }),
      });
      onBanned();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: isLight ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className="admin-modal-card" onClick={e => e.stopPropagation()} style={{
        background: isLight ? '#ffffff' : '#000000', border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.15)',
        borderRadius: 20, width: '100%', maxWidth: 460, padding: 32,
        boxShadow: isLight ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Ban size={20} color="#ef4444" />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: isLight ? '#000000' : '#ffffff' }}>Ban @{user.username}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#f87171', marginBottom: 18, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Ban type selector */}
        {watchRole !== 'moderator' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {['temporary', 'permanent'].map(t => (
              <button key={t} onClick={() => setBanType(t)} style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: banType === t ? '1px solid #ef4444' : (isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)'),
                background: banType === t ? 'rgba(239,68,68,0.15)' : (isLight ? '#f8fafc' : 'rgba(255,255,255,0.04)'),
                color: banType === t ? '#ef4444' : (isLight ? '#4b5563' : 'rgba(255,255,255,0.5)'), fontWeight: 700, cursor: 'pointer', fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                {t === 'temporary' ? <Clock size={14} /> : <InfinityIcon size={14} />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Expiry (temporary only) */}
        {!isPermanent && (
          <div style={{ marginBottom: 16, position: 'relative' }} ref={pickerRef}>
            <label style={{ display: 'block', fontSize: 12, color: isLight ? '#4b5563' : 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 6 }}>EXPIRES AT</label>
            
            <div
              onClick={() => setPickerOpen(o => !o)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10, border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.12)',
                background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)', color: isLight ? '#000000' : '#ffffff', fontSize: 14, boxSizing: 'border-box',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                userSelect: 'none'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={15} color="#818cf8" />
                <span style={{ color: isLight ? '#000000' : '#ffffff' }}>{formatDateString(expiresAt)}</span>
              </span>
              <ChevronDown size={16} style={{ color: isLight ? '#4b5563' : 'rgba(255,255,255,0.5)', transform: `rotate(${pickerOpen ? 180 : 0}deg)`, transition: 'transform 0.2s' }} />
            </div>

            {pickerOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 1000,
                background: isLight ? '#ffffff' : '#151522', border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14, boxShadow: isLight ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : '0 12px 40px rgba(0,0,0,0.4)', padding: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <button type="button" onClick={() => {
                    if (navMonth === 0) { setNavMonth(11); setNavYear(y => y - 1); } else { setNavMonth(m => m - 1); }
                  }} style={{ background: 'transparent', border: 'none', color: isLight ? '#374151' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontWeight: 700, fontSize: 13, color: isLight ? '#111827' : '#fff' }}>
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][navMonth]} {navYear}
                  </span>
                  <button type="button" onClick={() => {
                    if (navMonth === 11) { setNavMonth(0); setNavYear(y => y + 1); } else { setNavMonth(m => m + 1); }
                  }} style={{ background: 'transparent', border: 'none', color: isLight ? '#374151' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', marginBottom: 6 }}>
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <span key={d} style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)' }}>{d}</span>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', marginBottom: 14 }}>
                  {Array.from({ length: getFirstDayOfMonth(navYear, navMonth) }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: getDaysInMonth(navYear, navMonth) }).map((_, i) => {
                    const day = i + 1;
                    const isToday = new Date().getDate() === day && new Date().getMonth() === navMonth && new Date().getFullYear() === navYear;
                    const isSelected = parsedDate.getDate() === day && parsedDate.getMonth() === navMonth && parsedDate.getFullYear() === navYear;
                    const dateObj = new Date(navYear, navMonth, day);
                    const isPast = dateObj < new Date(new Date().setHours(0,0,0,0));
                    
                    return (
                      <button
                        key={`day-${day}`}
                        type="button"
                        disabled={isPast}
                        onClick={() => handleSelectDay(day)}
                        className={isSelected ? 'stay-white' : ''}
                        style={{
                          background: isSelected ? '#6366f1' : 'transparent',
                          border: isToday && !isSelected ? '1px solid rgba(99,102,241,0.5)' : 'none',
                          borderRadius: 8,
                          color: isSelected ? '#fff' : (isPast ? (isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)') : (isLight ? '#000000' : '#fff')),
                          fontSize: 12,
                          fontWeight: isSelected || isToday ? 700 : 500,
                          padding: '6px 0',
                          cursor: isPast ? 'not-allowed' : 'pointer',
                          transition: 'all 0.1s'
                        }}
                        onMouseEnter={e => { if (!isSelected && !isPast) e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)'; }}
                        onMouseLeave={e => { if (!isSelected && !isPast) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                <div style={{ borderTop: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.08)', paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#4b5563' : 'rgba(255,255,255,0.5)' }}>TIME</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <select
                      value={hours12}
                      onChange={e => handleSelectTime('hour', e.target.value)}
                      style={{
                        padding: '4px 6px', borderRadius: 6, border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.15)',
                        background: isLight ? '#ffffff' : '#1a1a26', color: isLight ? '#000000' : '#fff', fontSize: 12, cursor: 'pointer', outline: 'none'
                      }}
                    >
                      {Array.from({ length: 12 }).map((_, i) => (
                        <option key={i+1} value={i+1}>{String(i+1).padStart(2, '0')}</option>
                      ))}
                    </select>

                    <span style={{ color: isLight ? '#4b5563' : 'rgba(255,255,255,0.5)', fontSize: 12 }}>:</span>

                    <select
                      value={parseInt(minutesVal, 10)}
                      onChange={e => handleSelectTime('minute', e.target.value)}
                      style={{
                        padding: '4px 6px', borderRadius: 6, border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.15)',
                        background: isLight ? '#ffffff' : '#1a1a26', color: isLight ? '#000000' : '#fff', fontSize: 12, cursor: 'pointer', outline: 'none'
                      }}
                    >
                      {Array.from({ length: 60 }).map((_, i) => (
                        <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
                      ))}
                    </select>

                    <div style={{ display: 'flex', background: isLight ? '#f1f5f9' : '#1a1a26', borderRadius: 6, padding: 2, border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.15)' }}>
                      {['AM', 'PM'].map(ampm => (
                        <button
                          key={ampm}
                          type="button"
                          onClick={() => handleSelectTime('ampm', ampm)}
                          className={ampmVal === ampm ? 'ampm-btn-selected stay-white' : ''}
                          style={{
                            background: ampmVal === ampm ? '#6366f1' : 'transparent',
                            border: 'none', borderRadius: 4, color: ampmVal === ampm ? '#fff' : (isLight ? '#4b5563' : 'rgba(255,255,255,0.5)'),
                            fontSize: 10, fontWeight: 700, padding: '3px 7px', cursor: 'pointer'
                          }}
                        >
                          {ampm}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reason */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: isLight ? '#4b5563' : 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 6 }}>REASON (required)</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Describe the reason for this ban…"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10, border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.12)',
              background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)', color: isLight ? '#000000' : '#ffffff', fontSize: 14, resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Permanent confirmation gate */}
        {isPermanent && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#ef4444', fontWeight: 700, marginBottom: 6 }}>
              TYPE "BAN" TO CONFIRM PERMANENT BAN
            </label>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder='Type "BAN" here'
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10, border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.12)',
                background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)', color: isLight ? '#000000' : '#ffffff', fontSize: 14, boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        <button
          className="stay-white"
          onClick={submit}
          disabled={!canSubmit || loading}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
            background: canSubmit && !loading ? '#dc2626' : (isLight ? '#e2e8f0' : 'rgba(239,68,68,0.3)'),
            color: isLight ? (canSubmit && !loading ? '#fff' : '#000') : '#fff', fontWeight: 800, fontSize: 15, cursor: canSubmit && !loading ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? 'Banning…' : isPermanent ? 'Permanently Ban' : 'Apply Temporary Ban'}
        </button>
      </div>
    </div>
  );
}

// ─── Pagination ──────────────────────────────────────────────────────────────
function Pagination({ page, pages, onPage }) {
  function getPageNums() {
    const delta = 2;
    const toShow = new Set([1, pages]);
    for (let i = Math.max(1, page - delta); i <= Math.min(pages, page + delta); i++) toShow.add(i);

    const sorted = [...toShow].sort((a, b) => a - b);
    // Fill single-number gaps to avoid orphan ellipsis
    const filled = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] === 2) filled.push(sorted[i] - 1);
      filled.push(sorted[i]);
    }

    const result = [];
    let last = 0;
    for (const n of filled) {
      if (n - last > 1) result.push('...');
      result.push(n);
      last = n;
    }
    return result;
  }

  const isLight = React.useContext(AdminThemeCtx);

  const btnStyle = (active, disabled) => {
    if (isLight) {
      return {
        padding: '6px 11px', minWidth: 36, borderRadius: 8,
        border: active ? '1px solid #6366f1' : '1px solid #d1d5db',
        background: active ? '#6366f1' : '#ffffff',
        color: disabled ? '#d1d5db' : active ? '#ffffff' : '#374151',
        cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'center',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      };
    }
    return {
      padding: '6px 11px', minWidth: 36, borderRadius: 8,
      border: active ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
      background: active ? '#6366f1' : 'rgba(255,255,255,0.06)',
      color: disabled ? 'rgba(255,255,255,0.2)' : active ? '#fff' : 'rgba(255,255,255,0.7)',
      cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'center',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    };
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 20, flexWrap: 'wrap' }}>
      <button onClick={() => onPage(page - 1)} disabled={page === 1} style={btnStyle(false, page === 1)}>
        <ChevronLeft size={15} color={isLight ? '#111827' : undefined} />
      </button>
      {getPageNums().map((n, i) =>
        n === '...' ? (
          <span key={`dots-${i}`} style={{ color: isLight ? '#4b5563' : 'rgba(255,255,255,0.3)', padding: '0 2px', fontSize: 13, lineHeight: 1 }}>…</span>
        ) : (
          <button key={n} onClick={() => onPage(n)} className={n === page ? 'stay-white' : undefined} style={btnStyle(n === page, false)}>{n}</button>
        )
      )}
      <button onClick={() => onPage(page + 1)} disabled={page === pages} style={btnStyle(false, page === pages)}>
        <ChevronRight size={15} color={isLight ? '#111827' : undefined} />
      </button>
    </div>
  );
}

// ─── Users Page ───────────────────────────────────────────────────────────────
const JOIN_FILTERS = [
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_6_months', label: 'Last 6 Months' },
  { key: 'last_year', label: 'Last Year' },
  { key: 'all', label: 'All' },
];

function UsersPage({ initialJoinFilter = 'all', onJoinFilterChange }) {
  const isLight = React.useContext(AdminThemeCtx);
  const watchRole = localStorage.getItem('watch_role') || 'user';
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [joinFilter, setJoinFilter] = useState(initialJoinFilter);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banTarget, setBanTarget] = useState(null);
  const [terminateTarget, setTerminateTarget] = useState(null);
  const [unbanLoading, setUnbanLoading] = useState(null);
  const [showJoinDropdown, setShowJoinDropdown] = useState(false);
  const searchTimer = useRef(null);
  const firstMount = useRef(true);
  const joinDropdownRef = useRef(null);

  useEffect(() => {
    if (!showJoinDropdown) return;
    function handleOutside(e) {
      if (joinDropdownRef.current && !joinDropdownRef.current.contains(e.target)) setShowJoinDropdown(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showJoinDropdown]);

  const load = useCallback(async (s = search, p = page, jf = joinFilter) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ search: s, page: p, limit: 15 });
      if (jf && jf !== 'all') params.set('joinFilter', jf);
      const data = await apiFetch(`/api/admin/users?${params}`);
      setUsers(data.users);
      setTotal(data.total);
      setPage(data.page);
      setPages(data.pages || 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, page, joinFilter]);

  useEffect(() => { load(); }, []);

  // Sync when parent navigates here with a new filter (e.g. from Overview cards)
  useEffect(() => {
    if (firstMount.current) { firstMount.current = false; return; }
    setJoinFilter(initialJoinFilter);
    setPage(1);
    load(search, 1, initialJoinFilter);
  }, [initialJoinFilter]);

  function handleSearch(val) {
    setSearch(val);
    setPage(1);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(val, 1, joinFilter), 350);
  }

  function handlePage(p) {
    setPage(p);
    load(search, p, joinFilter);
  }

  function handleFilterChange(newFilter) {
    if (newFilter === joinFilter) return;
    setJoinFilter(newFilter);
    onJoinFilterChange?.(newFilter);
    setPage(1);
    load(search, 1, newFilter);
  }

  async function unban(userId) {
    setUnbanLoading(userId);
    try {
      await apiFetch(`/api/admin/users/${userId}/unban`, { method: 'POST' });
      load(search, page);
    } catch (e) {
      alert(`Unban failed: ${e.message}`);
    } finally {
      setUnbanLoading(null);
    }
  }

  function banStatus(u) {
    if (u.terminated) return { label: 'Terminated', color: '#ef4444' };
    if (u.is_permanently_banned) return { label: 'Perm. Banned', color: '#ef4444' };
    if (u.banned_until && new Date(u.banned_until) > new Date()) {
      const d = new Date(u.banned_until);
      return { label: `Banned until ${d.toLocaleDateString()}`, color: '#f59e0b' };
    }
    return { label: 'Active', color: '#10b981' };
  }

  return (
    <div className="admin-page-container" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
      {banTarget && (
        <BanModal user={banTarget} onClose={() => setBanTarget(null)} onBanned={() => load(search, page)} />
      )}
      {terminateTarget && (
        <TerminateModal user={terminateTarget} onClose={() => setTerminateTarget(null)} onTerminated={() => load(search, page)} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: isLight ? '#111827' : '#fff' }}>Users</h1>
          <p style={{ margin: '4px 0 0', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', fontSize: 14 }}>{total.toLocaleString()} total</p>
        </div>
        <button onClick={() => load(search, page, joinFilter)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
          background: isLight ? '#ffffff' : 'rgba(255,255,255,0.06)',
          border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, color: isLight ? '#374151' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 380 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: isLight ? '#9ca3af' : 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search username or email…"
          style={{
            width: '100%', padding: '10px 14px 10px 36px', borderRadius: 10,
            border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)',
            background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)',
            color: isLight ? '#111827' : '#fff', fontSize: 14, boxSizing: 'border-box', outline: 'none',
          }}
        />
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 16px', color: '#f87171', marginBottom: 20, fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 16, border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 700 }}>
          <thead>
            <tr style={{ borderBottom: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.08)' }}>
              {['User', 'Email', 'Role', 'Status', 'Last Login'].map(h => (
                <th key={h} style={{
                  padding: '12px 16px', textAlign: 'left', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)',
                  fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
              {/* Joined column with filter dropdown */}
              <th style={{ padding: '12px 16px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                <div ref={joinDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
                  <button
                    onClick={() => setShowJoinDropdown(v => !v)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px 2px 0',
                      color: joinFilter !== 'all' ? '#6366f1' : (isLight ? '#4b5563' : 'rgba(255,255,255,0.4)'),
                      fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                      borderRadius: 4, outline: 'none',
                    }}
                  >
                    JOINED
                    {joinFilter !== 'all' && (
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#6366f1', display: 'inline-block', flexShrink: 0, marginLeft: 1 }} />
                    )}
                    <ChevronDown size={10} style={{
                      transform: showJoinDropdown ? 'rotate(180deg)' : 'rotate(0)',
                      transition: 'transform 0.15s',
                      flexShrink: 0,
                      opacity: 0.7,
                      marginLeft: 1,
                    }} />
                  </button>
                  {showJoinDropdown && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 2000,
                      background: isLight ? '#f3f4f6' : '#161b27',
                      border: isLight ? '1px solid #d1d5db' : '1px solid rgba(99,102,241,0.25)',
                      borderRadius: 10, padding: '4px 4px', minWidth: 170,
                      boxShadow: isLight
                        ? '0 8px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)'
                        : '0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
                    }}>
                      <div style={{
                        padding: '7px 12px 5px', fontSize: 10, fontWeight: 700,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: isLight ? '#9ca3af' : 'rgba(255,255,255,0.35)',
                        borderBottom: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.07)',
                        marginBottom: 3,
                      }}>Filter by Join Date</div>
                      {JOIN_FILTERS.map(f => {
                        const isActive = joinFilter === f.key;
                        return (
                          <button
                            key={f.key}
                            onClick={() => { handleFilterChange(f.key); setShowJoinDropdown(false); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                              padding: '8px 10px', margin: '1px 0',
                              background: isActive
                                ? (isLight ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.18)')
                                : 'transparent',
                              border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                              color: isActive
                                ? '#6366f1'
                                : (isLight ? '#111827' : 'rgba(255,255,255,0.82)'),
                              fontSize: 13, fontWeight: isActive ? 600 : 500,
                              transition: 'background 0.12s, color 0.12s',
                              boxSizing: 'border-box',
                            }}
                            onMouseEnter={e => {
                              if (!isActive) {
                                e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)';
                                e.currentTarget.style.color = isLight ? '#000000' : '#ffffff';
                              }
                            }}
                            onMouseLeave={e => {
                              if (!isActive) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = isLight ? '#111827' : 'rgba(255,255,255,0.82)';
                              }
                            }}
                          >
                            <span style={{
                              width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0, borderRadius: 4,
                              background: isActive
                                ? (isLight ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.3)')
                                : 'transparent',
                            }}>
                              {isActive && <CheckCircle size={12} color="#6366f1" />}
                            </span>
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </th>
              <th style={{
                padding: '12px 16px', textAlign: 'left', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)',
                fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
              }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '40px 0', textAlign: 'center', color: isLight ? '#6b7280' : 'rgba(255,255,255,0.3)', fontSize: 14 }}>Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '40px 0', textAlign: 'center', color: isLight ? '#6b7280' : 'rgba(255,255,255,0.3)', fontSize: 14 }}>No users found</td></tr>
            ) : users.map(u => {
              const status = banStatus(u);
              const isBanned = status.label !== 'Active';
              return (
                <tr key={u.id} style={{ borderBottom: isLight ? '1px solid #f3f4f6' : '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f9fafb' : 'rgba(255,255,255,0.025)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {u.avatarPath ? (
                        <img src={getAvatarUrl(u.avatarPath)} alt="" loading="lazy" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span className="stay-white" style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{(u.username || '?')[0].toUpperCase()}</span>
                        </div>
                      )}
                      <div>
                        <div style={{ color: isLight ? '#111827' : '#fff', fontWeight: 600 }}>@{u.username}</div>
                        {u.displayName && <div style={{ color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', fontSize: 12 }}>{u.displayName}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: isLight ? '#374151' : 'rgba(255,255,255,0.6)' }}>{u.email || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                      background: ['super_admin','admin','moderator','support'].includes(u.role) ? (isLight ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.18)') : (isLight ? '#f3f4f6' : 'rgba(255,255,255,0.06)'),
                      color: ['super_admin','admin','moderator','support'].includes(u.role) ? '#6366f1' : (isLight ? '#111827' : 'rgba(255,255,255,0.5)'),
                      border: ['super_admin','admin','moderator','support'].includes(u.role) ? '1px solid rgba(99,102,241,0.25)' : (isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.08)'),
                    }}>
                      {['super_admin','admin','moderator','support'].includes(u.role) ? `⚡ ${u.role.replace(/_/g,' ')}` : 'user'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                      background: isLight ? `${status.color}10` : `${status.color}18`, color: status.color, border: `1px solid ${isLight ? `${status.color}25` : `${status.color}44`}`,
                    }}>
                      {status.label}
                    </span>
                    {u.ban_reason && isBanned && (
                      <div style={{ fontSize: 11, color: isLight ? '#6b7280' : 'rgba(255,255,255,0.3)', marginTop: 2, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={u.ban_reason}>
                        {u.ban_reason}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.45)', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {u.last_login ? new Date(u.last_login).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.45)', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {u.terminated ? (
                        <span style={{ color: isLight ? '#9ca3af' : 'rgba(255,255,255,0.2)', fontSize: 12, padding: '6px 0' }}>—</span>
                      ) : isBanned ? (
                        <>
                          <button
                            onClick={() => unban(u.id)}
                            disabled={unbanLoading === u.id}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', fontWeight: 700, fontSize: 12, cursor: unbanLoading === u.id ? 'not-allowed' : 'pointer' }}
                          >
                            <CheckCircle size={12} />
                            {unbanLoading === u.id ? '…' : 'Unban'}
                          </button>
                          {watchRole !== 'moderator' && (
                            <button
                              onClick={() => setTerminateTarget(u)}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                            >
                              <AlertTriangle size={12} />
                              Terminate
                            </button>
                          )}
                        </>
                      ) : !['super_admin', 'admin'].includes(u.role) ? (
                        <>
                          <button
                            onClick={() => setBanTarget(u)}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                          >
                            <Ban size={12} />
                            Ban
                          </button>
                          {watchRole !== 'moderator' && (
                            <button
                              onClick={() => setTerminateTarget(u)}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                            >
                              <AlertTriangle size={12} />
                              Terminate
                            </button>
                          )}
                        </>
                      ) : (
                        <span style={{ color: isLight ? '#9ca3af' : 'rgba(255,255,255,0.2)', fontSize: 12, padding: '6px 0' }}>—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <Pagination page={page} pages={pages} onPage={handlePage} />
      )}
    </div>
  );
}

// ─── Active Rooms Page ────────────────────────────────────────────────────────
function ActiveRoomsPage() {
  const isLight = React.useContext(AdminThemeCtx);
  const watchRole = localStorage.getItem('watch_role') || 'user';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [closeTarget, setCloseTarget] = useState(null);
  const [closeReason, setCloseReason] = useState('');
  const [closeLoading, setCloseLoading] = useState(false);
  const [kickLoading, setKickLoading] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  function load() {
    setLoading(true);
    apiFetch('/api/admin/rooms/detailed')
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  function toggleExpand(roomId) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId); else next.add(roomId);
      return next;
    });
  }

  async function forceClose() {
    if (!closeTarget || !closeReason.trim()) return;
    setCloseLoading(true);
    try {
      await apiFetch(`/api/admin/rooms/${closeTarget.roomId}/force-close`, {
        method: 'POST', body: JSON.stringify({ reason: closeReason.trim() }),
      });
      setCloseTarget(null); setCloseReason(''); load();
    } catch (e) { alert(`Failed: ${e.message}`); }
    finally { setCloseLoading(false); }
  }

  async function kickMember(roomId, username) {
    const key = `${roomId}:${username}`;
    setKickLoading(key);
    try {
      await apiFetch(`/api/admin/rooms/${roomId}/kick-member`, {
        method: 'POST', body: JSON.stringify({ username }),
      });
      load();
    } catch (e) { alert(`Failed: ${e.message}`); }
    finally { setKickLoading(null); }
  }

  async function deleteRoom() {
    if (!deleteTarget || deleteConfirmText !== 'DELETE' || !deleteReason.trim()) return;
    setDeleteLoading(true);
    try {
      await apiFetch(`/api/admin/rooms/${deleteTarget.roomId}`, {
        method: 'DELETE', body: JSON.stringify({ reason: deleteReason.trim() }),
      });
      setDeleteTarget(null); setDeleteReason(''); setDeleteConfirmText(''); load();
    } catch (e) { alert(`Failed: ${e.message}`); }
    finally { setDeleteLoading(false); }
  }

  const allRooms = data?.rooms || [];
  const roomList = (() => {
    if (!search.trim()) return allRooms;
    const q = search.toLowerCase();
    return allRooms.filter(r => r.roomName?.toLowerCase().includes(q) || r.roomId?.toLowerCase().includes(q));
  })();

  const canDelete = deleteConfirmText === 'DELETE' && deleteReason.trim() && !deleteLoading;

  return (
    <div className="admin-page-container" style={{ overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Force Close Modal */}
      {closeTarget && (
        <div className="admin-modal-overlay" onClick={() => setCloseTarget(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: isLight ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="admin-modal-card" onClick={e => e.stopPropagation()} style={{ background: isLight ? '#ffffff' : '#000000', border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(239,68,68,0.4)', borderRadius: 20, width: '100%', maxWidth: 420, padding: 32, boxShadow: isLight ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={20} color="#ef4444" />
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: isLight ? '#000000' : '#ffffff' }}>Force Close Room</h2>
              </div>
              <button onClick={() => setCloseTarget(null)} style={{ background: 'none', border: 'none', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} /></button>
            </div>
            <p style={{ margin: '0 0 4px', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.45)', fontSize: 13 }}>
              All users in "{closeTarget.roomName}" will be kicked immediately.
            </p>
            <p style={{ margin: '0 0 20px', color: isLight ? '#6b7280' : 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'monospace' }}>ID: {closeTarget.roomId}</p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: isLight ? '#374151' : 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 6 }}>REASON (required)</label>
              <textarea value={closeReason} onChange={e => setCloseReason(e.target.value)} rows={3} placeholder="Why is this room being closed?"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.12)', background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)', color: isLight ? '#000000' : '#ffffff', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCloseTarget(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)', background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.04)', color: isLight ? '#374151' : '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button className="stay-white" onClick={forceClose} disabled={!closeReason.trim() || closeLoading} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: closeReason.trim() && !closeLoading ? '#dc2626' : (isLight ? '#e2e8f0' : 'rgba(220,38,38,0.25)'), color: isLight ? (closeReason.trim() && !closeLoading ? '#fff' : '#000') : '#fff', fontWeight: 800, cursor: closeReason.trim() && !closeLoading ? 'pointer' : 'not-allowed', fontSize: 14 }}>
                {closeLoading ? 'Closing…' : 'Close Room'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Room Modal */}
      {deleteTarget && (
        <div className="admin-modal-overlay" onClick={() => { setDeleteTarget(null); setDeleteReason(''); setDeleteConfirmText(''); }} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: isLight ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="admin-modal-card" onClick={e => e.stopPropagation()} style={{ background: isLight ? '#ffffff' : '#000000', border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(220,38,38,0.5)', borderRadius: 20, width: '100%', maxWidth: 440, padding: 32, boxShadow: isLight ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Trash2 size={20} color="#ef4444" />
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: isLight ? '#000000' : '#ffffff' }}>Delete Room</h2>
              </div>
              <button onClick={() => { setDeleteTarget(null); setDeleteReason(''); setDeleteConfirmText(''); }} style={{ background: 'none', border: 'none', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} /></button>
            </div>
            <p style={{ margin: '0 0 2px', color: isLight ? '#000000' : '#fff', fontWeight: 700, fontSize: 14 }}>{deleteTarget.roomName}</p>
            <p style={{ margin: '0 0 12px', color: isLight ? '#6b7280' : 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'monospace' }}>ID: {deleteTarget.roomId}</p>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 18 }}>
              <p style={{ margin: 0, color: '#f87171', fontSize: 12, lineHeight: 1.5 }}>
                This permanently deletes the room and ALL its group chat history. Live members will be kicked immediately. This action <strong>cannot be undone.</strong>
              </p>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: isLight ? '#374151' : 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 6 }}>REASON (required)</label>
              <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={3} placeholder="Why is this room being permanently deleted?"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.12)', background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)', color: isLight ? '#000000' : '#ffffff', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#ef4444', fontWeight: 700, marginBottom: 6 }}>TYPE "DELETE" TO CONFIRM</label>
              <input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder='Type "DELETE" here'
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(220,38,38,0.4)', background: isLight ? '#ffffff' : 'rgba(220,38,38,0.08)', color: isLight ? '#000000' : '#ffffff', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setDeleteTarget(null); setDeleteReason(''); setDeleteConfirmText(''); }} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)', background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.04)', color: isLight ? '#374151' : '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button className="stay-white" onClick={deleteRoom} disabled={!canDelete} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: canDelete ? '#dc2626' : (isLight ? '#e2e8f0' : 'rgba(220,38,38,0.2)'), color: isLight ? (canDelete ? '#fff' : '#000') : '#fff', fontWeight: 800, cursor: canDelete ? 'pointer' : 'not-allowed', fontSize: 14 }}>
                {deleteLoading ? 'Deleting…' : 'Delete Room'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: isLight ? '#111827' : '#fff' }}>Active Rooms</h1>
          <p style={{ margin: '4px 0 0', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', fontSize: 14 }}>{allRooms.length} room{allRooms.length !== 1 ? 's' : ''} active</p>
        </div>
        <button onClick={load} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
          background: isLight ? '#ffffff' : 'rgba(255,255,255,0.06)',
          border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, color: isLight ? '#374151' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600
        }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 400 }}>
        <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: isLight ? '#111827' : 'rgba(255,255,255,0.3)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by room name or ID…"
          style={{
            width: '100%', padding: '9px 14px 9px 34px', borderRadius: 10,
            border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)',
            background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)',
            color: isLight ? '#111827' : '#fff', fontSize: 13, boxSizing: 'border-box'
          }} />
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 16px', color: '#f87171', marginBottom: 20, fontSize: 14 }}>{error}</div>}

      {loading && !data ? (
        <div style={{ color: isLight ? '#6b7280' : 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 60 }}>Loading…</div>
      ) : roomList.length === 0 ? (
        <div style={{ color: isLight ? '#6b7280' : 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 60, fontSize: 16 }}>
          {search ? 'No rooms match your search' : 'No active rooms right now'}
        </div>
      ) : roomList.map(room => {
        const isOpen = expanded.has(room.roomId);
        return (
          <div key={room.roomId} style={{
            marginBottom: 10,
            background: isLight ? '#ffffff' : 'rgba(255,255,255,0.03)',
            borderRadius: 14,
            border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.07)',
            boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
            overflow: 'hidden'
          }}>
            <div className="active-room-card-header" style={{ display: 'flex', padding: '14px 18px', cursor: 'pointer', flexWrap: 'wrap', gap: 12, alignItems: 'center' }} onClick={() => toggleExpand(room.roomId)}>
              <div className="active-room-card-info" style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: isLight ? '#111827' : '#fff', fontWeight: 700, fontSize: 15 }}>{room.roomName}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: room.isPublic ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)', color: room.isPublic ? '#34d399' : '#818cf8', border: `1px solid ${room.isPublic ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}` }}>
                      {room.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                  <div className="active-room-card-chevron-mobile" style={{ display: 'none', alignItems: 'center' }}>
                    {isOpen ? <ChevronUp size={16} color={isLight ? '#374151' : 'rgba(255,255,255,0.4)'} /> : <ChevronDown size={16} color={isLight ? '#374151' : 'rgba(255,255,255,0.4)'} />}
                  </div>
                </div>
                <div style={{ color: isLight ? '#6b7280' : 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'monospace', marginTop: 1, marginBottom: 2 }}>ID: {room.roomId}</div>
                <div style={{ color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                  Host: @{room.hostUsername} · {room.members.length} member{room.members.length !== 1 ? 's' : ''} · {room.category}
                </div>
              </div>
              <div className="active-room-card-actions" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {['super_admin', 'admin'].includes(watchRole) && (
                  <>
                    <button
                      onClick={e => { e.stopPropagation(); setCloseTarget(room); setCloseReason(''); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                    >
                      <X size={11} /> Force Close
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget(room); setDeleteReason(''); setDeleteConfirmText(''); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', color: '#ef4444', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                    >
                      <Trash2 size={11} /> Delete Room
                    </button>
                  </>
                )}
                <div className="active-room-card-chevron-desktop" style={{ display: 'flex', alignItems: 'center' }}>
                  {isOpen ? <ChevronUp size={16} color={isLight ? '#374151' : 'rgba(255,255,255,0.4)'} /> : <ChevronDown size={16} color={isLight ? '#374151' : 'rgba(255,255,255,0.4)'} />}
                </div>
              </div>
            </div>

            {isOpen && (
              <div style={{ borderTop: isLight ? '1px solid #f3f4f6' : '1px solid rgba(255,255,255,0.05)', padding: '10px 18px 14px' }}>
                {room.members.length === 0 ? (
                  <div style={{ color: isLight ? '#6b7280' : 'rgba(255,255,255,0.25)', fontSize: 13 }}>No members</div>
                ) : (
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {room.members.map(m => (
                      <div key={m.socketId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: isLight ? '1px solid #f3f4f6' : '1px solid rgba(255,255,255,0.04)' }}>
                        {m.avatarPath ? (
                          <img src={getAvatarUrl(m.avatarPath)} alt="" loading="lazy" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: m.isHost ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="stay-white" style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>{(m.username || '?')[0].toUpperCase()}</span>
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ color: isLight ? '#111827' : '#fff', fontWeight: 600, fontSize: 13 }}>@{m.username}</span>
                          {m.isHost && <span style={{ marginLeft: 6, fontSize: 10, color: '#f59e0b', fontWeight: 700, background: 'rgba(245,158,11,0.12)', padding: '1px 6px', borderRadius: 99, border: '1px solid rgba(245,158,11,0.25)' }}>HOST</span>}
                        </div>
                        {!m.isHost && (
                          <button
                            onClick={() => kickMember(room.roomId, m.username)}
                            disabled={kickLoading === `${room.roomId}:${m.username}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontWeight: 700, fontSize: 11, cursor: kickLoading === `${room.roomId}:${m.username}` ? 'not-allowed' : 'pointer' }}
                          >
                            <UserMinus size={11} />
                            {kickLoading === `${room.roomId}:${m.username}` ? '…' : 'Kick'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Audit Logs Page ──────────────────────────────────────────────────────────
const ACTION_META = {
  PERMANENT_BAN_USER:  { label: 'Permanent Ban',   color: '#ef4444' },
  TEMP_BAN_USER:       { label: 'Temp Ban',         color: '#f59e0b' },
  UNBAN_USER:          { label: 'Unban',            color: '#10b981' },
  TERMINATE_USER:      { label: 'Terminate',        color: '#dc2626' },
  FORCE_CLOSE_ROOM:    { label: 'Force Close Room', color: '#8b5cf6' },
  KICK_USER_FROM_ROOM: { label: 'Kick from Room',   color: '#f59e0b' },
  DELETE_ROOM:         { label: 'Delete Room',      color: '#dc2626' },
  RESOLVE_REPORT:      { label: 'Resolve Report',   color: '#10b981' },
};

function AuditLogsPage() {
  const isLight = React.useContext(AdminThemeCtx);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load(p = 1) {
    setLoading(true);
    apiFetch(`/api/admin/audit-logs?page=${p}&limit=25`)
      .then(d => { setLogs(d.logs); setTotal(d.total); setPage(d.page); setPages(d.pages || 1); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="admin-page-container" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: isLight ? '#111827' : '#fff' }}>Audit Logs</h1>
          <p style={{ margin: '4px 0 0', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', fontSize: 14 }}>{total.toLocaleString()} total actions</p>
        </div>
        <button onClick={() => load(page)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
          background: isLight ? '#ffffff' : 'rgba(255,255,255,0.06)',
          border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, color: isLight ? '#374151' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600
        }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 16px', color: '#f87171', marginBottom: 20, fontSize: 14 }}>{error}</div>}

      <div style={{ borderRadius: 16, border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
          <thead>
            <tr style={{ borderBottom: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.08)' }}>
              {['Timestamp', 'Action', 'Admin', 'Target', 'Room', 'Reason'].map(h => (
                <th key={h} style={{
                  padding: '12px 16px', textAlign: 'left',
                  color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)',
                  fontWeight: 700, fontSize: 11, letterSpacing: '0.08em',
                  textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '40px 0', textAlign: 'center', color: isLight ? '#6b7280' : 'rgba(255,255,255,0.3)' }}>Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '40px 0', textAlign: 'center', color: isLight ? '#6b7280' : 'rgba(255,255,255,0.3)' }}>No audit logs yet</td></tr>
            ) : logs.map(log => {
              const meta = ACTION_META[log.action] || { label: log.action, color: '#94a3b8' };
              return (
                <tr key={log.id} style={{ borderBottom: isLight ? '1px solid #f3f4f6' : '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f9fafb' : 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '10px 16px', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.45)', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: isLight ? `${meta.color}10` : `${meta.color}18`, color: meta.color, border: `1px solid ${isLight ? `${meta.color}25` : `${meta.color}33`}`, whiteSpace: 'nowrap' }}>
                      {meta.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', color: isLight ? '#374151' : 'rgba(255,255,255,0.6)', fontSize: 12 }}>{log.admin_email || '—'}</td>
                  <td style={{ padding: '10px 16px', color: isLight ? '#111827' : 'rgba(255,255,255,0.7)', fontSize: 13 }}>{log.target_username ? `@${log.target_username}` : '—'}</td>
                  <td style={{ padding: '10px 16px', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                    {log.room_id ? log.room_id.substring(0, 14) + (log.room_id.length > 14 ? '…' : '') : '—'}
                  </td>
                  <td style={{ padding: '10px 16px', color: isLight ? '#374151' : 'rgba(255,255,255,0.45)', fontSize: 12, maxWidth: 220 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.reason || ''}>{log.reason || '—'}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && <Pagination page={page} pages={pages} onPage={p => { setPage(p); load(p); }} />}
    </div>
  );
}

// ─── Ticket detail skeleton (shared by ReportsPage / SupportInboxPage loading states) ────
function TicketDetailSkeleton({ isLight }) {
  const row = (w, h = 14) => <div className="skeleton-block" style={{ width: w, height: h }} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {row(160, 18)}
          {row(100, 12)}
        </div>
        <div className="skeleton-block" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
      </div>
      <div style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.04)', border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ display: 'flex', gap: 16 }}>
            {row(70, 11)}
            {row(140, 13)}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {row(120, 11)}
        <div className="skeleton-block" style={{ width: '100%', height: 60, borderRadius: 10 }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {row(90, 32)}
        {row(90, 32)}
        {row(90, 32)}
      </div>
    </div>
  );
}

// ─── Reports Page ─────────────────────────────────────────────────────────────
function ReportsPage({ refreshBadges }) {
  const isLight = React.useContext(AdminThemeCtx);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('all');
  const [resolveLoading, setResolveLoading] = useState(null);
  const [selected, setSelected] = useState(null); // currently open report row
  const [lightbox, setLightbox] = useState(null); // { src, filename }

  // Support-inbox style features state
  const [teamMembers, setTeamMembers] = useState([]);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Resolution modal state
  const [resolveConfirm, setResolveConfirm] = useState(null); // { id, action }
  const [resolveMessage, setResolveMessage] = useState('');

  const assignDropdownRef = useRef(null);

  const currentAdminId = (() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return '';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return String(payload.id || '');
    } catch { return ''; }
  })();

  function load(p = 1, f = filter) {
    setLoading(true);
    apiFetch(`/api/admin/reports?page=${p}&limit=20&filter=${f}`)
      .then(d => { setData(d); setTotal(d.total); setPage(d.page); setPages(d.pages || 1); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  useEffect(() => {
    load();
    apiFetch('/api/admin/team').then(d => setTeamMembers(d.members || [])).catch((err) => console.error('[ADMIN] Silent fetch failure:', err.message));
  }, []);

  useEffect(() => {
    function handler(e) {
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(e.target)) {
        setShowAssignDropdown(false);
      }
    }
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  function handleFilter(f) { setFilter(f); setPage(1); load(1, f); }

  async function selectReport(rep) {
    setSelected(rep);
    setDetailData(null);
    setDetailLoading(true);
    try {
      const d = await apiFetch(`/api/admin/reports/${rep.id}`);
      setDetailData(d);
    } catch { setDetailData(rep); }
    setDetailLoading(false);
  }

  async function handleAction(id, action) {
    setActionLoading(action);
    try {
      if (action === 'assign') {
        await apiFetch(`/api/admin/reports/${id}/assign`, { method: 'POST' });
      } else {
        const body = { status: action };
        await apiFetch(`/api/admin/reports/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      }
      const fresh = await apiFetch(`/api/admin/reports/${id}`);
      setDetailData(fresh);
      setSelected(prev => ({ ...prev, status: fresh.status }));
      load(page, filter);
      if (refreshBadges) refreshBadges();
    } catch (e) { alert(`Failed: ${e.message}`); }
    setActionLoading(null);
  }

  async function handleAssignTo(id, targetAdminId) {
    setActionLoading('assign');
    setShowAssignDropdown(false);
    try {
      await apiFetch(`/api/admin/reports/${id}/assign`, { method: 'POST', body: JSON.stringify({ targetAdminId }) });
      const fresh = await apiFetch(`/api/admin/reports/${id}`);
      setDetailData(fresh);
      setSelected(prev => ({ ...prev, status: fresh.status }));
      load(page, filter);
    } catch (e) { alert(`Failed: ${e.message}`); }
    setActionLoading(null);
  }

  async function addNote(id) {
    if (!noteText.trim()) return;
    setNoteLoading(true);
    try {
      await apiFetch(`/api/admin/reports/${id}/note`, { method: 'POST', body: JSON.stringify({ note: noteText.trim() }) });
      const fresh = await apiFetch(`/api/admin/reports/${id}`);
      setDetailData(fresh);
      setNoteText('');
    } catch (e) { alert(`Failed: ${e.message}`); }
    setNoteLoading(false);
  }

  async function resolve(id, action = 'resolve', customNotes = null) {
    setResolveLoading(id + action);
    try {
      await apiFetch(`/api/admin/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ action, admin_notes: customNotes }) });
      const fresh = await apiFetch(`/api/admin/reports/${id}`);
      setDetailData(fresh);
      setSelected(prev => ({ ...prev, status: action === 'dismiss' ? 'dismissed' : 'resolved', resolved: true }));
      load(page, filter);
      if (refreshBadges) refreshBadges();
    } catch (e) { alert(`Failed: ${e.message}`); }
    finally { setResolveLoading(null); }
  }

  async function markInReview(id) {
    setResolveLoading(id + 'in_review');
    try {
      await apiFetch(`/api/admin/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'in_review' }) });
      const fresh = await apiFetch(`/api/admin/reports/${id}`);
      setDetailData(fresh);
      setSelected(prev => ({ ...prev, status: 'in_review' }));
      load(page, filter);
    } catch (e) { alert(`Failed: ${e.message}`); }
    finally { setResolveLoading(null); }
  }

  const reports = data?.reports || [];

  const REASON_LABELS = {
    harassment: 'Harassment / Abuse', spam: 'Spam / Advertising',
    hate_speech: 'Hate Speech', inappropriate_content: 'Inappropriate Content',
    threats: 'Threats / Violence', other: 'Other',
  };

  function StatusBadge({ status, resolved }) {
    const st = status || (resolved ? 'resolved' : 'open');
    const sc = {
      open: isLight ? ['rgba(245,158,11,0.1)','#d97706','rgba(245,158,11,0.25)'] : ['rgba(245,158,11,0.12)','#fbbf24','rgba(245,158,11,0.3)'],
      in_review: isLight ? ['rgba(59,130,246,0.1)','#2563eb','rgba(59,130,246,0.25)'] : ['rgba(59,130,246,0.12)','#60a5fa','rgba(59,130,246,0.3)'],
      resolved: isLight ? ['rgba(16,185,129,0.1)','#16a34a','rgba(16,185,129,0.25)'] : ['rgba(16,185,129,0.12)','#34d399','rgba(16,185,129,0.3)'],
      dismissed: isLight ? ['#f3f4f6','#4b5563','#d1d5db'] : ['rgba(255,255,255,0.06)','rgba(255,255,255,0.35)','rgba(255,255,255,0.12)'],
    }[st] || ['rgba(245,158,11,0.12)','#fbbf24','rgba(245,158,11,0.3)'];
    return <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: sc[0], color: sc[1], border: `1px solid ${sc[2]}` }}>{st}</span>;
  }

  return (
    <div className="admin-page-container" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        <div className="admin-reports-header">
          <div className="admin-reports-header-left">
            <div className="admin-reports-title-row">
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: isLight ? '#111827' : '#fff' }}>Reports</h1>
              <button className="mobile-refresh-btn" onClick={() => load(page, filter)} style={{ display: 'none', alignItems: 'center', gap: 6, padding: '7px 13px', background: isLight ? '#ffffff' : 'rgba(255,255,255,0.06)', border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: isLight ? '#374151' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
            <p className="admin-reports-count" style={{ margin: '4px 0 0', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', fontSize: 14 }}>{total.toLocaleString()} report{total !== 1 ? 's' : ''}</p>
          </div>
          <div className="admin-reports-filters">
            {[['all','All'], ['unresolved','Unresolved'], ['in_review','In Review'], ['resolved','Resolved'], ['dismissed','Dismissed']].map(([f, label]) => {
              const active = filter === f;
              return (
                <button key={f} onClick={() => handleFilter(f)} style={{ padding: '7px 13px', borderRadius: 9, border: active ? '1px solid #6366f1' : (isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)'), background: active ? 'rgba(99,102,241,0.15)' : (isLight ? '#ffffff' : 'rgba(255,255,255,0.04)'), color: active ? '#818cf8' : (isLight ? '#111827' : 'rgba(255,255,255,0.5)'), fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {label}
                </button>
              );
            })}
            <button className="desktop-refresh-btn" onClick={() => load(page, filter)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: isLight ? '#ffffff' : 'rgba(255,255,255,0.06)', border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: isLight ? '#374151' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 16px', color: '#f87171', marginBottom: 20, fontSize: 14 }}>{error}</div>}

        <div style={{ overflowX: 'auto', borderRadius: 16, border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.08)' }}>
                {['Date', 'Reporter', 'Reported User', 'Reason', 'Images', 'Status', 'Action'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: '40px 0', textAlign: 'center', color: isLight ? '#6b7280' : 'rgba(255,255,255,0.3)' }}>Loading…</td></tr>
              ) : reports.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '40px 0', textAlign: 'center', color: isLight ? '#6b7280' : 'rgba(255,255,255,0.3)' }}>No reports{filter === 'unresolved' ? ' pending review' : ' yet'}</td></tr>
              ) : reports.map(r => (
                <tr key={r.id}
                  onClick={() => selectReport(r)}
                  style={{ borderBottom: isLight ? '1px solid #f3f4f6' : '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s', cursor: 'pointer', background: selected?.id === r.id ? (isLight ? '#f0f4ff' : 'rgba(99,102,241,0.1)') : 'transparent' }}
                  onMouseEnter={e => { if (selected?.id !== r.id) e.currentTarget.style.background = isLight ? '#f9fafb' : 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = selected?.id === r.id ? (isLight ? '#f0f4ff' : 'rgba(99,102,241,0.1)') : 'transparent'; }}>
                  <td style={{ padding: '10px 16px', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.45)', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {r.createdAt ? new Date(r.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td style={{ padding: '10px 16px', color: isLight ? '#111827' : '#fff', fontWeight: 600 }}>@{r.reporterUsername || '—'}</td>
                  <td style={{ padding: '10px 16px', color: '#ef4444', fontWeight: 700 }}>@{r.reportedUsername || '—'}</td>
                  <td style={{ padding: '10px 16px', color: isLight ? '#6b7280' : 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                    {REASON_LABELS[r.reason] || r.reason || '—'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    {Array.isArray(r.attachments) && r.attachments.length > 0 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: isLight ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
                        🖼 {r.attachments.length}
                      </span>
                    ) : <span style={{ color: isLight ? '#d1d5db' : 'rgba(255,255,255,0.2)', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 16px' }}><StatusBadge status={r.status} resolved={r.resolved} /></td>
                  <td style={{ padding: '10px 16px' }}>
                    {!r.resolved && r.status !== 'resolved' && r.status !== 'dismissed' ? (
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={e => { e.stopPropagation(); setResolveConfirm({ id: r.id, action: 'resolve' }); }} disabled={!!resolveLoading} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                          <CheckCircle size={11} /> {resolveLoading === r.id + 'resolve' ? '…' : 'Resolve'}
                        </button>
                        <button onClick={e => { e.stopPropagation(); setResolveConfirm({ id: r.id, action: 'dismiss' }); }} disabled={!!resolveLoading} style={{ padding: '5px 10px', borderRadius: 7, background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)', border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.12)', color: isLight ? '#374151' : 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                          {resolveLoading === r.id + 'dismiss' ? '…' : 'Dismiss'}
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: isLight ? '#9ca3af' : 'rgba(255,255,255,0.2)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && <Pagination page={page} pages={pages} onPage={p => { setPage(p); load(p, filter); }} />}

      {/* Report detail modal */}
      {selected && (
        <div className="admin-modal-overlay admin-ticket-overlay" style={{ position: 'fixed', inset: 0, zIndex: 5000, background: isLight ? 'rgba(30,30,50,0.22)' : 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => { setSelected(null); setDetailData(null); }}>
          <div className="admin-modal-card admin-ticket-card" style={{ background: isLight ? '#ffffff' : '#0f0f1e', border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={e => e.stopPropagation()}>
          {detailLoading ? (
            <TicketDetailSkeleton isLight={isLight} />
          ) : (
            (() => {
              const displayData = detailData || selected;
              const assignedAdmin = teamMembers.find(m => String(m.id) === String(displayData.assigned_to_admin_id));
              return (
                <>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: isLight ? '#111827' : '#fff' }}>Report #{displayData.id}</h2>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: isLight ? '#6b7280' : 'rgba(255,255,255,0.45)' }}>
                        {displayData.createdAt ? new Date(displayData.createdAt).toLocaleString() : ''}
                      </p>
                    </div>
                    <button onClick={() => setSelected(null)} style={{ background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isLight ? '#374151' : '#fff', flexShrink: 0 }}>
                      <X size={15} />
                    </button>
                  </div>

                  {/* Meta */}
                  <div style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.04)', border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <tbody>
                        {[
                          ['Reporter', `@${displayData.reporterUsername || '—'}`],
                          ['Reported', `@${displayData.reportedUsername || '—'}`],
                          displayData.message === 'User Profile Report'
                            ? ['Type', 'User Profile Report']
                            : ['Room', displayData.roomId || 'Global Chat'],
                          ['Reason', REASON_LABELS[displayData.reason] || displayData.reason || '—'],
                          ['Assignee', assignedAdmin ? `@${assignedAdmin.username}` : 'Unassigned'],
                          ['Status', null],
                        ].map(([label, value]) => (
                          <tr key={label} style={{ borderBottom: isLight ? '1px solid #f3f4f6' : '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '7px 0', color: isLight ? '#6b7280' : 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12, width: 90, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</td>
                            <td style={{ padding: '7px 0', color: label === 'Reported' ? '#ef4444' : (isLight ? '#111827' : '#fff'), fontWeight: label === 'Reporter' || label === 'Reported' ? 700 : 400 }}>
                              {label === 'Status' ? <StatusBadge status={displayData.status} resolved={displayData.resolved} /> : value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Message snippet */}
                  {displayData.message && displayData.message !== 'User Profile Report' && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Reported Message</div>
                      <div style={{ background: isLight ? '#fff7ed' : 'rgba(239,68,68,0.06)', border: isLight ? '1px solid #fed7aa' : '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: isLight ? '#374151' : 'rgba(255,255,255,0.7)', lineHeight: 1.6, fontStyle: 'italic' }}>
                        "{displayData.message}"
                      </div>
                    </div>
                  )}

                  {/* Reporter notes */}
                  {displayData.description && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Reporter Notes</div>
                      <div style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)', border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: isLight ? '#374151' : 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
                        {displayData.description}
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  {Array.isArray(displayData.attachments) && displayData.attachments.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Paperclip size={12} /> Proof Images ({displayData.attachments.length})
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {displayData.attachments.map((att, i) => (
                          <button key={i} onClick={() => setLightbox({ items: displayData.attachments.map(a => ({ url: a.data, type: 'image/*', filename: a.filename })), index: i })}
                            title={`View ${att.filename}`}
                            style={{ display: 'block', position: 'relative', borderRadius: 8, overflow: 'hidden', border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', flexShrink: 0, padding: 0, background: 'none' }}>
                            <img src={att.data} alt={att.filename} loading="lazy" style={{ width: 120, height: 90, objectFit: 'cover', display: 'block' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.72)', padding: '3px 6px' }}>
                              <span style={{ fontSize: 9, color: '#fff', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions & Assign Dropdown */}
                  {(!displayData.resolved && displayData.status !== 'resolved' && displayData.status !== 'dismissed') && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {displayData.status !== 'in_review' && (
                        <button onClick={() => markInReview(displayData.id)} disabled={!!resolveLoading} style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.1)', color: '#2563eb', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                          {resolveLoading === displayData.id + 'in_review' ? '…' : 'Mark In Review'}
                        </button>
                      )}
                      <button onClick={() => setResolveConfirm({ id: displayData.id, action: 'resolve' })} disabled={!!resolveLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 9, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        <CheckCircle size={13} /> {resolveLoading === displayData.id + 'resolve' ? '…' : 'Resolve'}
                      </button>
                      <button onClick={() => setResolveConfirm({ id: displayData.id, action: 'dismiss' })} disabled={!!resolveLoading} style={{ padding: '8px 14px', borderRadius: 9, background: isLight ? '#fff' : 'rgba(255,255,255,0.05)', border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.12)', color: isLight ? '#374151' : 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        {resolveLoading === displayData.id + 'dismiss' ? '…' : 'Dismiss'}
                      </button>

                      {/* Assign dropdown */}
                      <div ref={assignDropdownRef} style={{ position: 'relative' }}>
                        <button
                          onClick={() => setShowAssignDropdown(p => !p)}
                          disabled={!!actionLoading}
                          style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.1)', color: '#7c3aed', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          {actionLoading === 'assign' ? '…' : <><span>Assign</span><ChevronDown size={11}/></>}
                        </button>
                        {showAssignDropdown && (
                          <div style={{
                            position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, zIndex: 200,
                            background: isLight ? '#ffffff' : '#1a1a2a',
                            border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 10, overflow: 'hidden', minWidth: 200,
                            boxShadow: isLight ? '0 8px 24px rgba(0,0,0,0.08)' : '0 8px 24px rgba(0,0,0,0.6)'
                          }}>
                            <button
                              onClick={() => { handleAction(displayData.id, 'assign'); setShowAssignDropdown(false); }}
                              style={{
                                width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none',
                                borderBottom: isLight ? '1px solid #f3f4f6' : '1px solid rgba(255,255,255,0.06)',
                                color: '#6366f1', fontWeight: 700, fontSize: 12, cursor: 'pointer'
                              }}
                            >
                              Assign to Me
                            </button>
                            {teamMembers.filter(m => String(m.id) !== currentAdminId).map(m => (
                              <button key={m.id}
                                onClick={() => handleAssignTo(displayData.id, m.id)}
                                style={{
                                  width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none',
                                  borderBottom: isLight ? '1px solid #f3f4f6' : '1px solid rgba(255,255,255,0.04)',
                                  color: isLight ? '#374151' : 'rgba(255,255,255,0.75)', fontSize: 12, cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: 6
                                }}
                              >
                                <span style={{ fontWeight: 600 }}>@{m.username}</span>
                                <span style={{ color: isLight ? '#6b7280' : 'rgba(255,255,255,0.35)', fontSize: 11 }}>{m.role.replace(/_/g, ' ')}</span>
                              </button>
                            ))}
                            {teamMembers.filter(m => String(m.id) !== currentAdminId).length === 0 && (
                              <div style={{ padding: '9px 14px', color: isLight ? '#9ca3af' : 'rgba(255,255,255,0.3)', fontSize: 12 }}>No other team members</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Admin notes */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Admin Notes</div>
                    {displayData.admin_notes ? (
                      <div style={{
                        background: isLight ? '#f3f4f6' : 'rgba(99,102,241,0.07)',
                        border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(99,102,241,0.15)',
                        borderRadius: 10, padding: '10px 14px', fontSize: 12,
                        color: isLight ? '#374151' : 'rgba(255,255,255,0.65)',
                        lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 10
                      }}>
                        {displayData.admin_notes}
                      </div>
                    ) : (
                      <div style={{ color: isLight ? '#6b7280' : 'rgba(255,255,255,0.2)', fontSize: 13, marginBottom: 10 }}>No notes yet</div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNote(displayData.id); } }}
                        placeholder="Add a note…"
                        style={{
                          flex: 1, padding: '8px 12px', borderRadius: 8,
                          border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)',
                          background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)',
                          color: isLight ? '#111827' : '#fff', fontSize: 13, outline: 'none'
                        }}
                      />
                      <button onClick={() => addNote(displayData.id)} disabled={noteLoading || !noteText.trim()} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        {noteLoading ? '…' : 'Add'}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()
          )}
          </div>
        </div>
      )}

      {/* Resolve Confirmation Modal */}
      {resolveConfirm && (
        <div className="report-modal-overlay" onClick={() => { setResolveConfirm(null); setResolveMessage(''); }} style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'relative',
            background: isLight ? '#ffffff' : '#1e1e2f',
            border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, width: '90%', maxWidth: 480, padding: 24,
            boxShadow: isLight ? '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' : '0 20px 25px -5px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', gap: 16, cursor: 'default'
          }}>
            {/* Close Button */}
            <button 
              onClick={() => { setResolveConfirm(null); setResolveMessage(''); }} 
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'none', border: 'none', cursor: 'pointer',
                color: isLight ? '#64748b' : 'rgba(255,255,255,0.5)',
                padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              <X size={16} />
            </button>

            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: isLight ? '#111827' : '#fff' }}>
              {resolveConfirm.action === 'resolve' ? 'Resolve Report' : 'Dismiss Report'}
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: isLight ? '#4b5563' : 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
              You are about to {resolveConfirm.action === 'resolve' ? 'resolve' : 'dismiss'} Report #{resolveConfirm.id}. The reporter will receive an email confirmation.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                Optional message for reporter:
              </label>
              <textarea
                value={resolveMessage}
                onChange={e => setResolveMessage(e.target.value)}
                placeholder="Write a message explaining the action taken (optional)..."
                style={{
                  width: '100%', minHeight: 100, padding: '12px 14px', borderRadius: 10,
                  border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.12)',
                  background: isLight ? '#ffffff' : 'rgba(255,255,255,0.04)',
                  color: isLight ? '#0f172a' : '#fff', outline: 'none', fontSize: 14,
                  lineHeight: 1.5, resize: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                onClick={() => { setResolveConfirm(null); setResolveMessage(''); }}
                style={{ padding: '10px 18px', borderRadius: 10, border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: isLight ? '#334155' : 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const act = resolveConfirm.action;
                  const rid = resolveConfirm.id;
                  setResolveConfirm(null);
                  const msg = resolveMessage.trim() || null;
                  setResolveMessage('');
                  await resolve(rid, act, msg);
                }}
                style={{
                  padding: '10px 20px', borderRadius: 10, border: 'none',
                  background: resolveConfirm.action === 'resolve' ? '#10b981' : '#ef4444',
                  cursor: 'pointer'
                }}
              >
                <span className="stay-white" style={{ color: '#ffffff', fontSize: 13, fontWeight: 700 }}>
                  Confirm {resolveConfirm.action === 'resolve' ? 'Resolve' : 'Dismiss'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image lightbox */}
      {lightbox && createPortal(
        <MediaLightbox
          items={lightbox.items}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox(lb => lb ? { ...lb, index: Math.max(0, lb.index - 1) } : null)}
          onNext={() => setLightbox(lb => lb ? { ...lb, index: Math.min(lb.items.length - 1, lb.index + 1) } : null)}
        />,
        document.body
      )}
    </div>
  );
}

// ─── Support Inbox Page ────────────────────────────────────────────────────────
function SupportInboxPage({ refreshBadges, initialTicketId, onInitialTicketConsumed }) {
  const isLight = React.useContext(AdminThemeCtx);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [resolveConfirm, setResolveConfirm] = useState(null); // { id, message }
  const [resolveMessage, setResolveMessage] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const assignDropdownRef = useRef(null);
  const searchTimer = useRef(null);

  const currentAdminId = (() => {
    try { const t = localStorage.getItem('watch_token'); return String(JSON.parse(atob(t.split('.')[1])).id); } catch { return null; }
  })();
  const currentAdminRole = localStorage.getItem('watch_role') || '';

  function load(p = 1, f = filter, s = search) {
    setLoading(true);
    const q = new URLSearchParams({ page: p, limit: 25, filter: f, search: s });
    apiFetch(`/api/admin/support-requests?${q}`)
      .then(d => { setRequests(d.requests || []); setTotal(d.total || 0); setPage(d.page || 1); setPages(d.pages || 1); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  useEffect(() => {
    load();
    apiFetch('/api/admin/team').then(d => setTeamMembers(d.members || [])).catch((err) => console.error('[ADMIN] Silent fetch failure:', err.message));
  }, []);

  // Auto-open a specific ticket when navigated from Admin Team page
  useEffect(() => {
    if (!initialTicketId) return;
    (async () => {
      try {
        const d = await apiFetch(`/api/admin/support-requests/${initialTicketId}`);
        setSelected(d);
        setDetailData(d);
        if (onInitialTicketConsumed) onInitialTicketConsumed();
      } catch { /* ignore */ }
    })();
  }, [initialTicketId]);

  useEffect(() => {
    if (!showAssignDropdown) return;
    function closeDropdown(e) {
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(e.target)) {
        setShowAssignDropdown(false);
      }
    }
    document.addEventListener('mousedown', closeDropdown);
    return () => document.removeEventListener('mousedown', closeDropdown);
  }, [showAssignDropdown]);

  function handleFilter(f) { setFilter(f); setPage(1); load(1, f, search); }
  function handleSearch(s) {
    setSearch(s);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); load(1, filter, s); }, 400);
  }

  async function openDetail(req) {
    setSelected(req);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const d = await apiFetch(`/api/admin/support-requests/${req.id}`);
      setDetailData(d);
    } catch { setDetailData(req); }
    setDetailLoading(false);
  }

  async function handleAction(id, action, resolutionMessage) {
    setActionLoading(action);
    try {
      if (action === 'assign') {
        await apiFetch(`/api/admin/support-requests/${id}/assign`, { method: 'POST' });
      } else {
        const body = { status: action };
        if (action === 'resolved') {
          body.resolution_message = resolutionMessage || null;
        }
        await apiFetch(`/api/admin/support-requests/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      }
      const fresh = await apiFetch(`/api/admin/support-requests/${id}`);
      setDetailData(fresh);
      setSelected(prev => ({ ...prev, status: fresh.status }));
      load(page, filter, search);
      if (refreshBadges) refreshBadges();
    } catch (e) { alert(`Failed: ${e.message}`); }
    setActionLoading(null);
  }

  async function handleAssignTo(id, targetAdminId) {
    setActionLoading('assign');
    setShowAssignDropdown(false);
    try {
      await apiFetch(`/api/admin/support-requests/${id}/assign`, { method: 'POST', body: JSON.stringify({ targetAdminId }) });
      const fresh = await apiFetch(`/api/admin/support-requests/${id}`);
      setDetailData(fresh);
      setSelected(prev => ({ ...prev, status: fresh.status }));
      load(page, filter, search);
    } catch (e) { alert(`Failed: ${e.message}`); }
    setActionLoading(null);
  }

  async function addNote(id) {
    if (!noteText.trim()) return;
    setNoteLoading(true);
    try {
      await apiFetch(`/api/admin/support-requests/${id}/note`, { method: 'POST', body: JSON.stringify({ note: noteText.trim() }) });
      const fresh = await apiFetch(`/api/admin/support-requests/${id}`);
      setDetailData(fresh);
      setNoteText('');
    } catch (e) { alert(`Failed: ${e.message}`); }
    setNoteLoading(false);
  }

  const PRIORITY_COLORS = {
    urgent: { bg: isLight ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.15)', color: isLight ? '#dc2626' : '#f87171', border: isLight ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.3)' },
    high:   { bg: isLight ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.15)', color: isLight ? '#d97706' : '#fbbf24', border: isLight ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.3)' },
    medium: { bg: isLight ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.15)', color: isLight ? '#4f46e5' : '#818cf8', border: isLight ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.3)' },
    low:    { bg: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.06)', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', border: isLight ? '#d1d5db' : 'rgba(255,255,255,0.1)' },
  };
  const STATUS_COLORS = {
    open:        { bg: isLight ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.12)', color: isLight ? '#d97706' : '#fbbf24', border: isLight ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.3)' },
    in_progress: { bg: isLight ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.12)', color: isLight ? '#2563eb' : '#60a5fa', border: isLight ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.3)' },
    resolved:    { bg: isLight ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.12)', color: isLight ? '#16a34a' : '#34d399', border: isLight ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.3)' },
    dismissed:   { bg: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.06)', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.35)', border: isLight ? '#d1d5db' : 'rgba(255,255,255,0.12)' },
  };
  const pill = (label, scheme) => (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: scheme?.bg, color: scheme?.color, border: `1px solid ${scheme?.border}` }}>{label}</span>
  );

  function closeDetail() { setSelected(null); setDetailData(null); setShowAssignDropdown(false); }

  return (
    <div className="admin-page-container" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: isLight ? '#111827' : '#fff' }}>Support Inbox</h1>
            <p style={{ margin: '4px 0 0', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', fontSize: 14 }}>{total.toLocaleString()} request{total !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: isLight ? '#111827' : 'rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
              <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Search…"
                style={{
                  padding: '7px 12px 7px 30px', borderRadius: 9,
                  border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)',
                  background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)',
                  color: isLight ? '#111827' : '#fff', fontSize: 13, width: 180, outline: 'none'
                }} />
            </div>
            <button onClick={() => load(page, filter, search)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
              background: isLight ? '#ffffff' : 'rgba(255,255,255,0.06)',
              border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 9, color: isLight ? '#374151' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600
            }}>
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {[['all','All'], ['open','Open'], ['in_progress','In Progress'], ['resolved','Resolved'], ['dismissed','Dismissed']].map(([f, label]) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => handleFilter(f)}
                style={{
                  padding: '6px 13px', borderRadius: 8,
                  border: active ? '1px solid #6366f1' : (isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)'),
                  background: active ? 'rgba(99,102,241,0.15)' : (isLight ? '#ffffff' : 'rgba(255,255,255,0.04)'),
                  color: active ? '#818cf8' : (isLight ? '#111827' : 'rgba(255,255,255,0.5)'),
                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 16px', color: '#f87171', marginBottom: 20, fontSize: 14 }}>{error}</div>}

        <div style={{ borderRadius: 16, border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.08)' }}>
                {['ID', 'Date', 'Type', 'Subject', 'From', 'Priority', 'Status', 'Files'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: '40px 0', textAlign: 'center', color: isLight ? '#6b7280' : 'rgba(255,255,255,0.3)' }}>Loading…</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '40px 0', textAlign: 'center', color: isLight ? '#6b7280' : 'rgba(255,255,255,0.3)' }}>No requests{filter !== 'all' ? ` with filter "${filter}"` : ''}</td></tr>
              ) : requests.map(r => {
                const isSel = selected?.id === r.id;
                return (
                  <tr key={r.id} onClick={() => openDetail(r)}
                    style={{
                      borderBottom: isLight ? '1px solid #f3f4f6' : '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer', transition: 'background 0.1s',
                      background: isSel ? (isLight ? '#f3f4f6' : 'rgba(99,102,241,0.07)') : 'transparent'
                    }}
                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = isLight ? '#f9fafb' : 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}>
                    <td style={{ padding: '10px 14px', color: isLight ? '#6b7280' : 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: 'monospace' }}>#{r.id}</td>
                    <td style={{ padding: '10px 14px', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.45)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {r.created_at ? new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        fontSize: 11,
                        color: isLight ? '#374151' : 'rgba(255,255,255,0.5)',
                        background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.06)',
                        padding: '2px 7px', borderRadius: 5, fontWeight: 600
                      }}>{r.request_type || 'contact'}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: isLight ? '#111827' : '#fff', fontWeight: 600, maxWidth: 180 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subject || '—'}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: isLight ? '#374151' : 'rgba(255,255,255,0.6)', fontSize: 12, whiteSpace: 'nowrap', maxWidth: 140 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.submitted_by_name || r.submitted_by_email || '—'}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>{pill(r.priority || 'medium', PRIORITY_COLORS[r.priority] || PRIORITY_COLORS.medium)}</td>
                    <td style={{ padding: '10px 14px' }}>{pill(r.status || 'open', STATUS_COLORS[r.status] || STATUS_COLORS.open)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {(r.attachment_count > 0) ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', fontSize: 11, fontWeight: 700 }}>
                          <Paperclip size={10} />{r.attachment_count}
                        </span>
                      ) : <span style={{ color: isLight ? '#9ca3af' : 'rgba(255,255,255,0.2)', fontSize: 12 }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pages > 1 && <Pagination page={page} pages={pages} onPage={p => { setPage(p); load(p, filter, search); }} />}

      {/* Detail modal */}
      {selected && (
        <div className="admin-modal-overlay admin-ticket-overlay" style={{ position: 'fixed', inset: 0, zIndex: 5000, background: isLight ? 'rgba(30,30,50,0.22)' : 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={closeDetail}>
          <div className="admin-modal-card admin-ticket-card" style={{ background: isLight ? '#ffffff' : '#0f0f1e', border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 28, position: 'relative' }}
            onClick={e => e.stopPropagation()}>
          <button onClick={closeDetail} style={{
            position: 'absolute', top: 16, right: 16,
            background: isLight ? '#ffffff' : 'rgba(255,255,255,0.07)',
            border: isLight ? '1px solid #d1d5db' : 'none',
            borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            color: isLight ? '#374151' : 'rgba(255,255,255,0.6)'
          }}>
            <X size={14} />
          </button>

          {detailLoading && <TicketDetailSkeleton isLight={isLight} />}

          {!detailLoading && detailData && (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {pill(detailData.priority || 'medium', PRIORITY_COLORS[detailData.priority] || PRIORITY_COLORS.medium)}
                  {pill(detailData.status || 'open', STATUS_COLORS[detailData.status] || STATUS_COLORS.open)}
                  <span style={{ color: isLight ? '#6b7280' : 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: 'monospace' }}>#{detailData.id}</span>
                </div>
                <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: isLight ? '#111827' : '#fff', paddingRight: 36 }}>{detailData.subject}</h2>
                <div style={{ color: isLight ? '#4b5563' : 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                  From: <span style={{ color: isLight ? '#111827' : '#ddd', fontWeight: 600 }}>{detailData.submitted_by_name}</span>
                  {detailData.submitted_by_email && <span style={{ color: isLight ? '#6b7280' : 'rgba(255,255,255,0.35)' }}> &lt;{detailData.submitted_by_email}&gt;</span>}
                </div>
                <div style={{ color: isLight ? '#4b5563' : 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 3 }}>
                  {detailData.request_type} · {detailData.created_at ? new Date(detailData.created_at).toLocaleString() : ''}
                  {detailData.email_notification_status === 'failed' && (
                    <span style={{ marginLeft: 8, color: '#f87171' }}>
                      <Mail size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />email failed
                    </span>
                  )}
                </div>
              </div>

              <div style={{
                background: isLight ? '#ffffff' : 'rgba(255,255,255,0.03)',
                border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12, padding: 16, marginBottom: 20, fontSize: 14,
                color: isLight ? '#111827' : 'rgba(255,255,255,0.75)',
                lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 300, overflowY: 'auto'
              }}>
                {detailData.message || '—'}
              </div>

              {/* Attachment image gallery */}
              {Array.isArray(detailData.attachments) && detailData.attachments.length > 0 && !detailData.attachment_deleted && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Paperclip size={12} /> Attachments ({detailData.attachments.length})
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {detailData.attachments.map((att, i) => (
                      <button key={i} onClick={() => setLightbox({ items: detailData.attachments.map(a => ({ url: a.data, type: 'image/*', filename: a.filename })), index: i })}
                        title={`View ${att.filename}`}
                        style={{ display: 'block', position: 'relative', borderRadius: 8, overflow: 'hidden', border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', flexShrink: 0, padding: 0, background: 'none' }}>
                        <img
                          src={att.data}
                          alt={att.filename}
                          loading="lazy"
                          style={{ width: 120, height: 90, objectFit: 'cover', display: 'block' }}
                          onError={e => { e.currentTarget.style.display = 'none'; }}
                        />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.72)', padding: '3px 6px' }}>
                          <span style={{ fontSize: 9, color: '#fff', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {detailData.status !== 'resolved' && detailData.status !== 'dismissed' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                  {detailData.status !== 'in_progress' && (
                    <button onClick={() => handleAction(detailData.id, 'in_progress')} disabled={!!actionLoading} style={{ padding: '7px 13px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.1)', color: '#2563eb', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      {actionLoading === 'in_progress' ? '…' : 'Mark In Progress'}
                    </button>
                  )}
                  {/* Assign dropdown */}
                  <div ref={assignDropdownRef} style={{ position: 'relative' }}>
                    <button
                      onClick={() => setShowAssignDropdown(p => !p)}
                      disabled={!!actionLoading}
                      style={{ padding: '7px 13px', borderRadius: 8, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.1)', color: '#7c3aed', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                      {actionLoading === 'assign' ? '…' : <><span>Assign</span><ChevronDown size={11}/></>}
                    </button>
                    {showAssignDropdown && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200,
                        background: isLight ? '#ffffff' : '#1a1a2a',
                        border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 10, overflow: 'hidden', minWidth: 200,
                        boxShadow: isLight ? '0 8px 24px rgba(0,0,0,0.08)' : '0 8px 24px rgba(0,0,0,0.6)'
                      }}>
                        <button
                          onClick={() => { handleAction(detailData.id, 'assign'); setShowAssignDropdown(false); }}
                          style={{
                            width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none',
                            borderBottom: isLight ? '1px solid #f3f4f6' : '1px solid rgba(255,255,255,0.06)',
                            color: '#6366f1', fontWeight: 700, fontSize: 12, cursor: 'pointer'
                          }}
                        >
                          Assign to Me
                        </button>
                        {teamMembers.filter(m => String(m.id) !== currentAdminId).map(m => (
                          <button key={m.id}
                            onClick={() => handleAssignTo(detailData.id, m.id)}
                            style={{
                              width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none',
                              borderBottom: isLight ? '1px solid #f3f4f6' : '1px solid rgba(255,255,255,0.04)',
                              color: isLight ? '#374151' : 'rgba(255,255,255,0.75)', fontSize: 12, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 6
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>@{m.username}</span>
                            <span style={{ color: isLight ? '#6b7280' : 'rgba(255,255,255,0.35)', fontSize: 11 }}>{m.role.replace(/_/g, ' ')}</span>
                          </button>
                        ))}
                        {teamMembers.filter(m => String(m.id) !== currentAdminId).length === 0 && (
                          <div style={{ padding: '9px 14px', color: isLight ? '#9ca3af' : 'rgba(255,255,255,0.3)', fontSize: 12 }}>No other team members</div>
                        )}
                      </div>
                    )}
                  </div>
                  <button onClick={() => {
                    // Strip [timestamp - email] prefixes from admin_notes → pre-fill the user-facing message
                    const raw = detailData?.admin_notes || '';
                    const cleaned = raw
                      .split('\n')
                      .map(line => line.replace(/^\[.*?\]\s*/, '').trim())
                      .filter(Boolean)
                      .join('\n');
                    setResolveMessage(cleaned);
                    setResolveConfirm({ id: detailData.id, hadNotes: !!cleaned });
                  }} disabled={!!actionLoading} style={{ padding: '7px 13px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)', color: '#16a34a', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    Resolve
                  </button>
                  <button onClick={() => handleAction(detailData.id, 'dismissed')} disabled={!!actionLoading} style={{ padding: '7px 13px', borderRadius: 8, border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.15)', background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)', color: isLight ? '#374151' : 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    {actionLoading === 'dismissed' ? '…' : 'Dismiss'}
                  </button>
                </div>
              )}

              {detailData.attachment_deleted && (
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px 14px', color: '#d97706', fontSize: 12, marginBottom: 16 }}>
                  Attachments deleted after 90-day retention period
                </div>
              )}

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Admin Notes</div>
                {detailData.admin_notes ? (
                  <div style={{
                    background: isLight ? '#f3f4f6' : 'rgba(99,102,241,0.07)',
                    border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(99,102,241,0.15)',
                    borderRadius: 10, padding: '10px 14px', fontSize: 12,
                    color: isLight ? '#374151' : 'rgba(255,255,255,0.65)',
                    lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 10
                  }}>
                    {detailData.admin_notes}
                  </div>
                ) : (
                  <div style={{ color: isLight ? '#6b7280' : 'rgba(255,255,255,0.2)', fontSize: 13, marginBottom: 10 }}>No notes yet</div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNote(detailData.id); } }}
                    placeholder="Add a note…"
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8,
                      border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.1)',
                      background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)',
                      color: isLight ? '#111827' : '#fff', fontSize: 13, outline: 'none'
                    }}
                  />
                  <button onClick={() => addNote(detailData.id)} disabled={noteLoading || !noteText.trim()} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    {noteLoading ? '…' : 'Add'}
                  </button>
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && createPortal(
        <MediaLightbox
          items={lightbox.items}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox(lb => lb ? { ...lb, index: Math.max(0, lb.index - 1) } : null)}
          onNext={() => setLightbox(lb => lb ? { ...lb, index: Math.min(lb.items.length - 1, lb.index + 1) } : null)}
        />,
        document.body
      )}

      {/* Resolve confirmation modal */}
      {resolveConfirm && (
        <div onClick={() => { setResolveConfirm(null); setResolveMessage(''); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99998, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(135deg,#0a1a12,#091310)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 20, padding: 32, maxWidth: 460, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircle size={20} color="#34d399" />
              </div>
              <h3 style={{ margin: 0, color: '#fff', fontWeight: 800, fontSize: 17 }}>Resolve Ticket</h3>
            </div>

            {/* Message to user - SHOWN IN EMAIL */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
                  Message to User <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(shown in email)</span>
                </label>
                {resolveConfirm?.hadNotes && resolveMessage && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', whiteSpace: 'nowrap' }}>
                    ✎ pre-filled from your notes
                  </span>
                )}
              </div>
              <textarea
                value={resolveMessage}
                onChange={e => setResolveMessage(e.target.value)}
                placeholder="e.g. We've reviewed your report and taken action. Thank you for helping keep SahaPlay safe."
                rows={4}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  background: resolveMessage ? 'rgba(16,185,129,0.07)' : 'rgba(255,255,255,0.03)',
                  border: resolveMessage ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(255,255,255,0.1)',
                  color: '#e5e7eb', fontSize: 13, lineHeight: 1.6, resize: 'vertical',
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border 0.2s',
                }}
              />
              <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.3)', fontSize: 11, lineHeight: 1.5 }}>
                🔒 Internal notes are <strong style={{ color: 'rgba(255,255,255,0.5)' }}>never</strong> sent to users — only this message appears in the resolution email. Edit or clear before sending.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setResolveConfirm(null); setResolveMessage(''); }} style={{ padding: '9px 18px', borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  const msg = resolveMessage;
                  setResolveConfirm(null);
                  setResolveMessage('');
                  handleAction(resolveConfirm.id, 'resolved', msg);
                }}
                disabled={!!actionLoading}
                style={{ padding: '9px 20px', borderRadius: 9, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                ✓ Confirm &amp; Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmWord, destructive, onConfirm, onCancel, loading }) {
  const isLight = React.useContext(AdminThemeCtx);
  const [typed, setTyped] = useState('');
  const canConfirm = !confirmWord || typed === confirmWord;
  const border = isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)';
  const text = isLight ? '#111827' : '#ffffff';
  const muted = isLight ? '#6b7280' : 'rgba(255,255,255,0.5)';
  const inputBg = isLight ? '#ffffff' : 'rgba(255,255,255,0.06)';
  useEffect(() => { setTyped(''); }, [confirmWord]);
  return (
    <div className="admin-modal-overlay" onClick={onCancel} style={{ position: 'fixed', inset: 0, background: isLight ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(3px)' }}>
      <div className="admin-modal-card" onClick={e => e.stopPropagation()} style={{ background: isLight ? '#ffffff' : '#000000', border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: '28px 32px', width: 400, maxWidth: '90vw', boxShadow: isLight ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : '0 25px 50px -12px rgba(0, 0, 0, 0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: text }}>{title}</h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: isLight ? '#4b5563' : 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: muted, lineHeight: 1.65 }}>{message}</p>
        {confirmWord && (
          <div style={{ marginBottom: 18 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: muted }}>
              Type <code style={{ color: destructive ? '#ef4444' : '#6366f1', background: destructive ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)', padding: '1px 7px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{confirmWord}</code> to confirm
            </p>
            <input autoFocus value={typed} onChange={e => setTyped(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canConfirm && !loading && onConfirm()}
              placeholder={confirmWord}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: isLight ? '1px solid #cbd5e1' : `1px solid ${border}`, background: inputBg, color: text, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: '0.05em' }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '9px 20px', borderRadius: 9, border: isLight ? '1px solid #d1d5db' : `1px solid ${border}`, background: isLight ? '#f3f4f6' : 'transparent', color: muted, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button
            className="stay-white"
            onClick={onConfirm}
            disabled={!canConfirm || loading}
            style={{
              padding: '9px 20px', borderRadius: 9, border: 'none', fontWeight: 700, fontSize: 13,
              cursor: canConfirm && !loading ? 'pointer' : 'not-allowed',
              background: canConfirm && !loading ? (destructive ? '#dc2626' : '#6366f1') : (isLight ? '#e2e8f0' : (destructive ? 'rgba(220,38,38,0.25)' : 'rgba(99,102,241,0.25)')),
              color: isLight ? (canConfirm && !loading ? '#fff' : '#000') : '#fff',
              transition: 'all 0.15s'
            }}
          >
            {loading ? 'Working…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Team Page ───────────────────────────────────────────────────────────
function AdminTeamPage({ onOpenTicket }) {
  const isLight = React.useContext(AdminThemeCtx);
  const watchRole = localStorage.getItem('watch_role') || 'user';
  const isSuperAdmin = watchRole === 'super_admin';
  const currentUserId = (() => {
    try { const t = localStorage.getItem('watch_token'); return JSON.parse(atob(t.split('.')[1])).id; } catch { return null; }
  })();

  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('moderator');
  const [roleSelectOpen, setRoleSelectOpen] = useState(false);
  const roleSelectRef = useRef(null);

  useEffect(() => {
    if (!roleSelectOpen) return;
    const handler = (e) => {
      if (roleSelectRef.current && !roleSelectRef.current.contains(e.target)) setRoleSelectOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [roleSelectOpen]);

  const [inviteSending, setInviteSending] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberTickets, setMemberTickets] = useState([]);
  const [memberTicketsLoading, setMemberTicketsLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState({ text: '', ok: true });
  const [confirmModal, setConfirmModal] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [permsOpen, setPermsOpen] = useState(false);

  const T = isLight ? {
    text: '#111827', muted: '#6b7280', faint: '#9ca3af',
    card: '#ffffff', cardBorder: '#e5e7eb', surface: '#f3f4f6',
    inputBg: '#f9fafb', inputBorder: '#d1d5db', selectBg: '#ffffff',
    th: '#6b7280', rowHover: '#f9fafb', tableBorder: '#f3f4f6', tagBg: 'rgba(0,0,0,0.03)',
  } : {
    text: '#ffffff', muted: 'rgba(255,255,255,0.5)', faint: 'rgba(255,255,255,0.3)',
    card: 'rgba(255,255,255,0.03)', cardBorder: 'rgba(255,255,255,0.08)', surface: 'rgba(255,255,255,0.05)',
    inputBg: 'rgba(255,255,255,0.05)', inputBorder: 'rgba(255,255,255,0.12)', selectBg: '#1a1a2a',
    th: 'rgba(255,255,255,0.4)', rowHover: 'rgba(255,255,255,0.03)', tableBorder: 'rgba(255,255,255,0.05)', tagBg: 'rgba(255,255,255,0.04)',
  };

  const ROLE_COLORS = isLight ? {
    super_admin: { bg: 'rgba(168,85,247,0.12)', color: '#7c3aed', border: 'rgba(168,85,247,0.3)' },
    admin:       { bg: 'rgba(99,102,241,0.12)',  color: '#4f46e5', border: 'rgba(99,102,241,0.3)' },
    moderator:   { bg: 'rgba(59,130,246,0.12)',  color: '#2563eb', border: 'rgba(59,130,246,0.3)' },
    support:     { bg: 'rgba(16,185,129,0.12)',  color: '#059669', border: 'rgba(16,185,129,0.3)' },
  } : {
    super_admin: { bg: 'rgba(168,85,247,0.15)', color: '#c084fc', border: 'rgba(168,85,247,0.3)' },
    admin:       { bg: 'rgba(99,102,241,0.15)',  color: '#818cf8', border: 'rgba(99,102,241,0.3)' },
    moderator:   { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
    support:     { bg: 'rgba(16,185,129,0.15)',  color: '#34d399', border: 'rgba(16,185,129,0.3)' },
  };

  const STATUS_COLORS = isLight ? {
    active:   { bg: 'rgba(16,185,129,0.12)',  color: '#059669', border: 'rgba(16,185,129,0.25)' },
    pending:  { bg: 'rgba(245,158,11,0.12)',  color: '#d97706', border: 'rgba(245,158,11,0.25)' },
    accepted: { bg: 'rgba(16,185,129,0.12)',  color: '#059669', border: 'rgba(16,185,129,0.25)' },
    revoked:  { bg: 'rgba(239,68,68,0.1)',    color: '#e11d48', border: 'rgba(239,68,68,0.25)' },
    expired:  { bg: 'rgba(107,114,128,0.1)',  color: '#4b5563', border: 'rgba(107,114,128,0.25)' },
  } : {
    active:   { bg: 'rgba(16,185,129,0.12)',  color: '#34d399', border: 'rgba(16,185,129,0.25)' },
    pending:  { bg: 'rgba(245,158,11,0.12)',  color: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
    accepted: { bg: 'rgba(16,185,129,0.12)',  color: '#34d399', border: 'rgba(16,185,129,0.25)' },
    revoked:  { bg: 'rgba(239,68,68,0.1)',    color: '#f87171', border: 'rgba(239,68,68,0.25)' },
    expired:  { bg: 'rgba(156,163,175,0.1)',  color: '#9ca3af', border: 'rgba(156,163,175,0.25)' },
  };

  const pill = (label, scheme) => (
    React.createElement('span', { style: { display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', background: scheme?.bg, color: scheme?.color, border: `1px solid ${scheme?.border}` } }, label)
  );

  const ROLE_PERMS = [
    { role: 'super_admin', label: 'Super Admin',
      perms: ['Full dashboard access', 'Invite moderators & support', 'Revoke & change roles', 'View all audit logs', 'Manage users, rooms, reports, inbox'] },
    { role: 'moderator', label: 'Moderator',
      perms: ['View active rooms, kick users', 'Handle & review reports', 'Temp bans (if backend allows)', 'Cannot permanently ban users', 'Cannot invite or revoke roles'] },
    { role: 'support', label: 'Support',
      perms: ['View & resolve support inbox', 'Add admin notes to tickets', 'Cannot ban users or close rooms', 'Cannot manage admin team'] },
  ];

  const TICKET_STATUS_COLORS = isLight ? {
    open:        { bg: 'rgba(245,158,11,0.15)', color: '#d97706', border: 'rgba(245,158,11,0.4)' },
    in_progress: { bg: 'rgba(59,130,246,0.15)',  color: '#2563eb', border: 'rgba(59,130,246,0.4)' },
    resolved:    { bg: 'rgba(16,185,129,0.15)',  color: '#059669', border: 'rgba(16,185,129,0.4)' },
    dismissed:   { bg: 'rgba(0,0,0,0.05)',       color: '#4b5563', border: 'rgba(0,0,0,0.15)' },
  } : {
    open:        { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
    in_progress: { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
    resolved:    { bg: 'rgba(16,185,129,0.12)', color: '#34d399', border: 'rgba(16,185,129,0.3)' },
    dismissed:   { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', border: 'rgba(255,255,255,0.12)' },
  };

  async function openMemberDetail(member) {
    setSelectedMember(member);
    setMemberTickets([]);
    setMemberTicketsLoading(true);
    try {
      const d = await apiFetch(`/api/admin/team/${member.id}/tickets`);
      setMemberTickets(d.tickets || []);
    } catch { setMemberTickets([]); }
    setMemberTicketsLoading(false);
  }

  async function loadTeam() {
    try { const d = await apiFetch('/api/admin/team'); setMembers(d.members || []); }
    catch (e) { setError(e.message); }
  }
  async function loadInvites() {
    if (!isSuperAdmin) return;
    try { const d = await apiFetch('/api/admin/invites'); setInvites(d.invites || []); }
    catch {}
  }
  async function doRefresh(showSpinner) {
    if (showSpinner) setRefreshing(true);
    setError('');
    await Promise.all([loadTeam(), isSuperAdmin ? loadInvites() : Promise.resolve()]);
    setLoading(false);
    if (showSpinner) setRefreshing(false);
  }
  useEffect(() => {
    doRefresh(true);
    const id = setInterval(() => doRefresh(false), 30000);
    return () => clearInterval(id);
  }, []);

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setInviteSending(true); setInviteMsg({ text: '', ok: true });
    try {
      const d = await apiFetch('/api/admin/invites', { method: 'POST', body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }) });
      setInviteMsg({ text: d.message || 'Invite sent!', ok: true }); setInviteEmail(''); loadInvites();
    } catch (e) { setInviteMsg({ text: e.message, ok: false }); }
    setInviteSending(false);
  }
  function askChangeRole(member, newRole) {
    setConfirmModal({
      title: 'Change Role',
      message: `Change @${member.username} from ${member.role.replace(/_/g, ' ')} to ${newRole.replace(/_/g, ' ')}?`,
      destructive: false,
      onConfirm: async () => {
        setConfirmLoading(true);
        try { await apiFetch(`/api/admin/team/${member.id}/role`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) }); await loadTeam(); setConfirmModal(null); }
        catch (e) { alert(`Failed: ${e.message}`); }
        setConfirmLoading(false);
      }
    });
  }
  function askDisable(member) {
    setConfirmModal({
      title: 'Disable Access',
      message: `Revoke all admin privileges from @${member.username} (${member.role.replace(/_/g, ' ')})? They will become a regular user.`,
      confirmWord: 'DISABLE',
      destructive: true,
      onConfirm: async () => {
        setConfirmLoading(true);
        try { await apiFetch(`/api/admin/team/${member.id}/disable`, { method: 'PATCH' }); await loadTeam(); setConfirmModal(null); }
        catch (e) { alert(`Failed: ${e.message}`); }
        setConfirmLoading(false);
      }
    });
  }
  function askRevoke(inv) {
    setConfirmModal({
      title: 'Revoke Invite',
      message: `Revoke the invite to ${inv.email}? The link becomes invalid immediately.`,
      confirmWord: 'REVOKE',
      destructive: true,
      onConfirm: async () => {
        setConfirmLoading(true);
        try { await apiFetch(`/api/admin/invites/${inv.id}`, { method: 'DELETE' }); await loadInvites(); setConfirmModal(null); }
        catch (e) { alert(`Failed: ${e.message}`); }
        setConfirmLoading(false);
      }
    });
  }
  async function resendInvite(inv) {
    try {
      const d = await apiFetch(`/api/admin/invites/${inv.id}/resend`, { method: 'POST' });
      setInviteMsg({ text: d.message || 'Invite resent!', ok: true }); loadInvites();
    } catch (e) { setInviteMsg({ text: `Resend failed: ${e.message}`, ok: false }); }
  }

  const inviteStatusOf = (inv) => {
    if (inv.status === 'accepted') return 'accepted';
    if (inv.status === 'revoked') return 'revoked';
    if (new Date(inv.expires_at) < new Date()) return 'expired';
    return 'pending';
  };
  const CHANGEABLE = ['moderator', 'support'];
  const btnS = { borderRadius: 7, border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer', padding: '4px 9px' };

  return (
    <div className="admin-page-container" style={{ maxWidth: 1040, color: T.text, overflowY: 'auto', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.text }}>Admin Team</h1>
          <p style={{ margin: '5px 0 0', color: T.muted, fontSize: 14 }}>Manage dashboard access, roles, and permissions.</p>
        </div>
        <button onClick={() => doRefresh(true)} disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `1px solid ${T.cardBorder}`, background: T.card, color: T.muted, fontWeight: 600, fontSize: 12, cursor: refreshing ? 'not-allowed' : 'pointer' }}>
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 16px', color: '#f87171', marginBottom: 20, fontSize: 13 }}>{error}</div>}

      {isSuperAdmin && (
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: 22, marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Invite Team Member</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendInvite()}
              placeholder="Email address" type="email"
              style={{ padding: '9px 14px', borderRadius: 9, border: `1px solid ${T.inputBorder}`, background: T.inputBg, color: T.text, fontSize: 13, width: 230, outline: 'none' }} />
            <div ref={roleSelectRef} style={{ position: 'relative', width: 140 }}>
              <button
                type="button"
                onClick={() => setRoleSelectOpen(o => !o)}
                style={{
                  width: '100%', padding: '9px 14px', borderRadius: 9,
                  border: `1px solid ${T.inputBorder}`, background: T.selectBg,
                  color: T.text, fontSize: 13, outline: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  textAlign: 'left'
                }}
              >
                <span>{inviteRole === 'moderator' ? 'Moderator' : 'Support'}</span>
                <ChevronDown size={14} style={{ transform: `rotate(${roleSelectOpen ? 180 : 0}deg)`, transition: 'transform 0.2s', color: isLight ? '#6b7280' : '#9ca3af' }} />
              </button>

              {roleSelectOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
                  background: isLight ? '#ffffff' : '#141418',
                  border: `1px solid ${T.inputBorder}`,
                  borderRadius: 9, boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                  padding: 4, display: 'flex', flexDirection: 'column', gap: 2
                }}>
                  {['moderator', 'support'].map((role) => {
                    const label = role === 'moderator' ? 'Moderator' : 'Support';
                    const active = inviteRole === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => {
                          setInviteRole(role);
                          setRoleSelectOpen(false);
                        }}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: 6, border: 'none',
                          background: active ? (isLight ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.15)') : 'transparent',
                          color: active ? '#6366f1' : T.text, fontSize: 13, cursor: 'pointer',
                          textAlign: 'left', fontWeight: active ? 700 : 500, transition: 'all 0.1s'
                        }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.background = isLight ? '#f3f4f6' : 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button onClick={sendInvite} disabled={inviteSending || !inviteEmail.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 700, fontSize: 13, cursor: inviteSending || !inviteEmail.trim() ? 'not-allowed' : 'pointer', opacity: inviteSending || !inviteEmail.trim() ? 0.6 : 1 }}>
              <Mail size={13} />{inviteSending ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
          {inviteMsg.text && (
            <div style={{ marginTop: 10, fontSize: 13, color: inviteMsg.ok ? '#34d399' : '#f87171', display: 'flex', alignItems: 'center', gap: 5 }}>
              {inviteMsg.ok ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
              {inviteMsg.text}
            </div>
          )}
        </div>
      )}

      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, marginBottom: 22, overflow: 'hidden' }}>
        <button onClick={() => setPermsOpen(p => !p)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 20px', background: 'transparent', border: 'none', cursor: 'pointer', color: T.text }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Role Permissions</span>
          {permsOpen ? <ChevronUp size={16} color={T.muted} /> : <ChevronDown size={16} color={T.muted} />}
        </button>
        {permsOpen && (
          <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
            {ROLE_PERMS.map(({ role, label, perms }) => (
              <div key={role} style={{ background: T.surface, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: 14 }}>
                <div style={{ marginBottom: 10 }}>{pill(label, ROLE_COLORS[role])}</div>
                <ul style={{ margin: 0, padding: '0 0 0 14px', color: T.muted, fontSize: 12, lineHeight: 1.75 }}>
                  {perms.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Current Team Members ({members.length})
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 680 }}>
            <thead>
              <tr style={{ background: T.tagBg }}>
                {['Member', 'Email', 'Role', 'Status', 'Joined', 'Tickets', ...(isSuperAdmin ? ['Actions'] : [])].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: T.th, fontWeight: 700, fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', borderBottom: `1px solid ${T.tableBorder}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isSuperAdmin ? 7 : 6} style={{ padding: '40px 0', textAlign: 'center', color: T.faint }}>Loading…</td></tr>
              ) : members.length === 0 ? (
                <tr><td colSpan={isSuperAdmin ? 7 : 6} style={{ padding: '40px 0', textAlign: 'center', color: T.faint }}>No team members found.</td></tr>
              ) : members.map(m => (
                <tr key={m.id} onClick={() => openMemberDetail(m)}
                  style={{ borderBottom: `1px solid ${T.tableBorder}`, cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = T.rowHover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: T.text }}>
                    @{m.username}
                    {String(m.id) === String(currentUserId) && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: '#818cf8', fontWeight: 700, background: 'rgba(99,102,241,0.12)', padding: '1px 7px', borderRadius: 99 }}>you</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: T.muted, fontSize: 12 }}>{m.email || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>{pill(m.role.replace(/_/g, ' '), ROLE_COLORS[m.role])}</td>
                  <td style={{ padding: '12px 16px' }}>{pill('active', STATUS_COLORS.active)}</td>
                  <td style={{ padding: '12px 16px', color: T.faint, fontSize: 12 }}>{m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {(m.open_ticket_count > 0) ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 99, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', fontWeight: 800, fontSize: 12 }}>
                        {m.open_ticket_count}
                      </span>
                    ) : (
                      <span style={{ color: T.faint, fontSize: 12 }}>—</span>
                    )}
                  </td>
                  {isSuperAdmin && (
                    <td style={{ padding: '10px 16px' }} onClick={e => e.stopPropagation()}>
                      {String(m.id) !== String(currentUserId) && m.role !== 'super_admin' ? (
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {CHANGEABLE.filter(r => r !== m.role).map(r => (
                            <button key={r} onClick={() => askChangeRole(m, r)}
                              style={{ ...btnS, background: ROLE_COLORS[r]?.bg, color: ROLE_COLORS[r]?.color, border: `1px solid ${ROLE_COLORS[r]?.border}` }}>
                              {'→'} {r.replace(/_/g, ' ')}
                            </button>
                          ))}
                          <button onClick={() => askDisable(m)}
                            style={{ ...btnS, background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                            Disable
                          </button>
                        </div>
                      ) : m.role === 'super_admin' ? (
                        <span style={{ fontSize: 11, color: T.faint, fontStyle: 'italic' }}>protected</span>
                      ) : (
                        <span style={{ fontSize: 11, color: T.faint }}>—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isSuperAdmin && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Invites ({invites.length})
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: T.tagBg }}>
                  {['Email', 'Role', 'Invited By', 'Expires', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: T.th, fontWeight: 700, fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', borderBottom: `1px solid ${T.tableBorder}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invites.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '32px 0', textAlign: 'center', color: T.faint }}>No invites yet.</td></tr>
                ) : invites.map(inv => {
                  const st = inviteStatusOf(inv);
                  return (
                    <tr key={inv.id} style={{ borderBottom: `1px solid ${T.tableBorder}` }}
                      onMouseEnter={e => e.currentTarget.style.background = T.rowHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '11px 16px', color: T.text, fontWeight: 600 }}>{inv.email}</td>
                      <td style={{ padding: '11px 16px' }}>{pill(inv.role, ROLE_COLORS[inv.role])}</td>
                      <td style={{ padding: '11px 16px', color: T.muted, fontSize: 12 }}>{inv.invited_by_email || '—'}</td>
                      <td style={{ padding: '11px 16px', color: T.faint, fontSize: 11 }}>{new Date(inv.expires_at).toLocaleString()}</td>
                      <td style={{ padding: '11px 16px' }}>{pill(st, STATUS_COLORS[st])}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          {(st === 'pending' || st === 'expired') && (
                            <button onClick={() => resendInvite(inv)}
                              style={{ ...btnS, background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}>
                              Resend
                            </button>
                          )}
                          {st === 'pending' && (
                            <button onClick={() => askRevoke(inv)}
                              style={{ ...btnS, background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmWord={confirmModal.confirmWord}
          destructive={confirmModal.destructive}
          loading={confirmLoading}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => { setConfirmModal(null); setConfirmLoading(false); }}
        />
      )}

      {/* Member detail modal */}
      {selectedMember && (
        <div onClick={() => setSelectedMember(null)} className="room-modals-overlay" style={{ position: 'fixed', inset: 0, background: isLight ? 'rgba(30,30,50,0.3)' : 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: isLight ? '#ffffff' : '#111827', border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 0, maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: isLight ? '0 20px 48px rgba(0,0,0,0.08)' : '0 24px 64px rgba(0,0,0,0.5)' }}>
            {/* Header */}
            <div style={{ padding: '24px 28px 20px', borderBottom: isLight ? '1px solid #f3f4f6' : '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: ROLE_COLORS[selectedMember.role]?.bg || 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${ROLE_COLORS[selectedMember.role]?.border || 'rgba(99,102,241,0.3)'}` }}>
                <UserCog size={20} color={ROLE_COLORS[selectedMember.role]?.color || '#818cf8'} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: isLight ? '#111827' : '#fff', fontWeight: 800, fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                  @{selectedMember.username}
                  {String(selectedMember.id) === String(currentUserId) && (
                    <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 800, background: 'rgba(99,102,241,0.12)', padding: '1px 7px', borderRadius: 99 }}>you</span>
                  )}
                </div>
                <div style={{ color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedMember.email}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {pill(selectedMember.role.replace(/_/g, ' '), ROLE_COLORS[selectedMember.role])}
                <button onClick={() => setSelectedMember(null)} style={{ background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.06)', border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.1)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isLight ? '#374151' : 'rgba(255,255,255,0.5)' }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            <div style={{ padding: '20px 28px 28px' }}>
              {/* Privileges */}
              {(() => {
                const rp = ROLE_PERMS.find(r => r.role === selectedMember.role);
                return rp ? (
                  <div style={{ background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.03)', border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 18px', marginBottom: 22 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Privileges</div>
                    <ul style={{ margin: 0, padding: '0 0 0 16px', color: isLight ? '#374151' : 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 2 }}>
                      {rp.perms.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                ) : null;
              })()}

              {/* Assigned tickets */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#4b5563' : 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  Assigned Tickets {!memberTicketsLoading && `(${memberTickets.length})`}
                </div>
                {memberTicketsLoading ? (
                  <div style={{ color: isLight ? '#6b7280' : 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Loading…</div>
                ) : memberTickets.length === 0 ? (
                  <div style={{ color: isLight ? '#6b7280' : 'rgba(255,255,255,0.25)', fontSize: 13, textAlign: 'center', padding: '20px 0', background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.02)', borderRadius: 10, border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.05)' }}>No assigned tickets</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {memberTickets.map(t => (
                      <div key={t.id}
                        onClick={() => { if (onOpenTicket) { setSelectedMember(null); onOpenTicket(t.id); } }}
                        style={{ background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.03)', border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: onOpenTicket ? 'pointer' : 'default', transition: 'background 0.15s' }}
                        onMouseEnter={e => { if (onOpenTicket) e.currentTarget.style.background = isLight ? '#f0f0f5' : 'rgba(255,255,255,0.07)'; }}
                        onMouseLeave={e => { if (onOpenTicket) e.currentTarget.style.background = isLight ? '#f9fafb' : 'rgba(255,255,255,0.03)'; }}
                      >
                        <span style={{ color: isLight ? '#6b7280' : 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'monospace', flexShrink: 0 }}>#{t.id}</span>
                        <span style={{ flex: 1, color: isLight ? '#111827' : '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</span>
                        {pill(t.status || 'open', TICKET_STATUS_COLORS[t.status] || TICKET_STATUS_COLORS.open)}
                        {onOpenTicket && <span style={{ color: isLight ? '#9ca3af' : 'rgba(255,255,255,0.25)', fontSize: 11, flexShrink: 0 }}>Open →</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const BASE_NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'moderator', 'support'] },
  { id: 'users', label: 'Users', icon: Users, roles: ['super_admin', 'admin', 'moderator'] },
  { id: 'rooms', label: 'Active Rooms', icon: Activity, roles: ['super_admin', 'admin', 'moderator'] },
  { id: 'reports', label: 'Reports', icon: FileText, roles: ['super_admin', 'admin', 'moderator'] },
  { id: 'audit', label: 'Audit Logs', icon: Shield, roles: ['super_admin', 'admin'] },
  { id: 'support', label: 'Support Inbox', icon: Inbox, roles: ['super_admin', 'admin', 'moderator', 'support'] },
  { id: 'team', label: 'Admin Team', icon: UserCog, roles: ['super_admin', 'admin', 'moderator', 'support'] },
];

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
export default function Admin() {
  const [tab, setTabState] = useState(() => localStorage.getItem('admin_active_tab') || 'overview');
  const [userJoinFilter, setUserJoinFilter] = useState('all');
  const setTab = (val, filter = null) => {
    setTabState(val);
    localStorage.setItem('admin_active_tab', val);
    if (filter !== null) setUserJoinFilter(filter);
  };
  const [badges, setBadges] = useState({ openSupportRequests: 0, unresolvedReports: 0, pendingInvites: 0 });
  const [watchRole, setWatchRole] = useState(localStorage.getItem('watch_role') || 'user');
  const [isLight, setIsLight] = useState(() => document.documentElement.getAttribute('data-theme') === 'light');
  const [showMobileContent, setShowMobileContent] = useState(false);
  const [pendingTicketId, setPendingTicketId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const NAV = BASE_NAV;
  const activeNavItem = BASE_NAV.find(n => n.id === tab);
  const hasAccess = activeNavItem && (!activeNavItem.roles || activeNavItem.roles.includes(watchRole));

  useEffect(() => {
    apiFetch('/api/me').then(d => {
      if (d && d.role) {
        localStorage.setItem('watch_role', d.role);
        setWatchRole(d.role);
      }
    }).catch((err) => console.error('[ADMIN] Silent fetch failure:', err.message));
  }, []);

  const refreshBadges = React.useCallback(() => {
    apiFetch('/api/admin/badge-counts').then(d => setBadges(d)).catch((err) => console.error('[ADMIN] Silent fetch failure:', err.message));
  }, []);

  const socketRef = useRef(null);
  useEffect(() => {
    const token = localStorage.getItem('watch_token');
    if (!token) return;
    const socket = io(API_BASE, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      console.log('[ADMIN SOCKET] Connected');
      socket.emit('admin:join');
    });
    socket.on('admin_badges_updated', () => {
      console.log('[ADMIN SOCKET] Badge updates received');
      refreshBadges();
    });
    return () => {
      socket.disconnect();
    };
  }, [refreshBadges]);

  // Refresh on tab change
  useEffect(() => { refreshBadges(); }, [tab, refreshBadges]);

  // Auto-poll every 10 s so new incoming tickets/reports appear live
  useEffect(() => {
    const id = setInterval(refreshBadges, 10000);
    return () => clearInterval(id);
  }, [refreshBadges]);

  function handleLogout() {
    localStorage.removeItem('watch_token');
    localStorage.removeItem('watch_username');
    localStorage.removeItem('watch_role');
    navigate('/login');
  }

  const BADGE_MAP = {
    support: badges.openSupportRequests,
    reports: badges.unresolvedReports,
    team: badges.pendingInvites,
  };

  return (
    <AdminThemeCtx.Provider value={isLight}>
    <div className={`admin-wrapper ${isLight ? 'admin-light' : ''} ${showMobileContent ? 'mobile-show-content' : 'mobile-show-menu'}`} style={{ display: 'flex', minHeight: '100vh', background: isLight ? '#f3f4f6' : '#0a0a12', color: isLight ? '#111827' : '#fff', fontFamily: "'Outfit', sans-serif" }}>

      {/* Sidebar */}
      <aside
        className="admin-sidebar"
        style={{
          width: 220, flexShrink: 0,
          background: isLight ? '#ffffff' : '#0e0e1a',
          borderRight: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.07)',
          display: 'flex', flexDirection: 'column',
          position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '24px 20px 16px', borderBottom: isLight ? '1px solid #f3f4f6' : '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logos/trans_webl.png" alt="SahaPlay" style={{ width: 28, height: 28 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: isLight ? '#111827' : '#fff' }}>SahaPlay</div>
              <div style={{ fontSize: 10, color: isLight ? '#9ca3af' : 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {watchRole.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {NAV.map(({ id, label, icon: Icon }) => {
            const badge = BADGE_MAP[id];
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => { setTab(id); setShowMobileContent(true); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 10, border: 'none', cursor: 'pointer', marginBottom: 2,
                  background: active ? (isLight ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.15)') : 'transparent',
                  color: active ? '#6366f1' : isLight ? '#374151' : 'rgba(255,255,255,0.55)',
                  fontWeight: active ? 800 : 600, fontSize: 13, textAlign: 'left', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = isLight ? '#f3f4f6' : 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon size={16} color={active ? '#6366f1' : isLight ? '#374151' : 'rgba(255,255,255,0.55)'} />
                <span style={{ flex: 1 }}>{label}</span>
                {badge > 0 && (
                  <span className="stay-white" style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 99, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: back to app + logout */}
        <div style={{ padding: '12px 10px', borderTop: isLight ? '1px solid #f3f4f6' : '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => navigate('/')} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
            borderRadius: 10, border: 'none', background: 'transparent',
            color: isLight ? '#374151' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 4,
            transition: 'all 0.15s'
          }}
            onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f3f4f6' : 'rgba(255,255,255,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <ChevronLeft size={16} color={isLight ? '#374151' : undefined} />
            Back to App
          </button>
          <button onClick={handleLogout} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
            borderRadius: 10, border: 'none', background: 'transparent',
            color: isLight ? '#dc2626' : 'rgba(239,68,68,0.7)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            transition: 'all 0.15s'
          }}
            onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(220,38,38,0.06)' : 'rgba(239,68,68,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <LogOut size={16} color={isLight ? '#dc2626' : 'rgba(239,68,68,0.7)'} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Mobile back header */}
        <header
          className="admin-mobile-back-header"
          style={{
            display: 'none', // Managed by CSS media query
            alignItems: 'center', gap: 12,
            padding: '0 16px', height: 56, flexShrink: 0,
            background: isLight ? '#ffffff' : '#0e0e1a',
            borderBottom: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.07)',
            zIndex: 100,
          }}
        >
          <button
            onClick={() => setShowMobileContent(false)}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px 8px',
              marginLeft: -8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isLight ? '#111827' : '#fff',
              cursor: 'pointer'
            }}
            aria-label="Back"
          >
            <ChevronLeft size={24} />
          </button>
          <span style={{ fontWeight: 800, fontSize: 15, color: isLight ? '#111827' : '#fff' }}>
            {NAV.find(n => n.id === tab)?.label || 'Admin'}
          </span>
        </header>

        {!hasAccess ? (
          <AccessDeniedPage tabLabel={activeNavItem?.label || 'this page'} />
        ) : (
          <>
            {tab === 'overview' && <OverviewPage onNavigate={setTab} />}
            {tab === 'users' && <UsersPage initialJoinFilter={userJoinFilter} onJoinFilterChange={setUserJoinFilter} />}
            {tab === 'rooms' && <ActiveRoomsPage />}
            {tab === 'reports' && <ReportsPage refreshBadges={refreshBadges} />}
            {tab === 'audit' && <AuditLogsPage />}
            {tab === 'support' && <SupportInboxPage refreshBadges={refreshBadges} initialTicketId={pendingTicketId} onInitialTicketConsumed={() => setPendingTicketId(null)} />}
            {tab === 'team' && <AdminTeamPage refreshBadges={refreshBadges} onOpenTicket={(id) => { setPendingTicketId(id); setTab('support'); }} />}
          </>
        )}
      </main>
    </div>
    </AdminThemeCtx.Provider>
  );
}
