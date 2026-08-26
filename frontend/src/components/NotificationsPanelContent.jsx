import React from 'react';
import { User } from 'lucide-react';
import { getAvatarUrl } from '../utils/avatarUtils';

// Extracted from Navbar.jsx's mobile follow-notifications dropdown (the only
// variant this reuses — the separate desktop dropdown is a pre-existing,
// visually-different duplicate left untouched) so both the Navbar dropdown
// and the standalone-PWA bottom nav's Notifications tab render identical
// content. The caller owns positioning/framing (fixed dropdown vs. full
// panel); this component is just the header + list.
export default function NotificationsPanelContent({ followRequests, onAllow, onFollowBack, onItemClick, isLight, t, listMaxHeight = 300 }) {
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#666' : '#555', padding: '0 12px 8px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>{t('followNotifications', 'Follow Notifications')}</div>
      <div style={{ maxHeight: listMaxHeight, overflowY: 'auto' }}>
        {followRequests.length > 0 ? (
          followRequests.map(u => (
            <div key={u.username} onClick={() => onItemClick(u.username)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s', background: u.status === 'pending' ? (isLight ? 'rgba(var(--brand-1-rgb),0.07)' : 'rgba(var(--brand-1-rgb),0.05)') : 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = u.status === 'pending' ? (isLight ? 'rgba(var(--brand-1-rgb),0.07)' : 'rgba(var(--brand-1-rgb),0.05)') : 'transparent'}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                {u.avatarPath ? <img src={getAvatarUrl(u.avatarPath)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={18} color={isLight ? '#666' : '#888'} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: isLight ? '#111' : '#fff', fontSize: 13, fontWeight: 700 }}>{u.displayName || u.username}</div>
                <div style={{ color: isLight ? '#444' : '#6b7280', fontSize: 11, marginTop: 2 }}>
                  {u.status === 'pending' ? t('wantsToFollow', { username: `@${u.username}`, defaultValue: `@${u.username} wants to follow you` }) : t('startedFollowing', { username: `@${u.username}`, defaultValue: `@${u.username} started following you` })}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {u.status === 'pending' ? (
                    <button onClick={(e) => onAllow(u.username, e)} className="notif-action-btn" style={{ padding: '6px 12px', background: 'rgba(var(--brand-1-rgb),0.15)', border: 'none', color: isLight ? '#000000' : 'var(--brand-1-light)', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t('allow', 'Allow')}</button>
                  ) : (
                    <button disabled className="notif-action-btn" style={{ padding: '6px 12px', background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', border: 'none', color: isLight ? '#666' : '#6b7280', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{t('followerStatus', 'Follower')}</button>
                  )}

                  {u.myFollowStatus === 'accepted' ? (
                    <button disabled className="notif-action-btn" style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.15)', border: 'none', color: '#10b981', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{t('followingStatus', 'Following')}</button>
                  ) : (
                    <button onClick={(e) => {
                      e.stopPropagation();
                      if (u.myFollowStatus === 'pending') return;
                      onFollowBack(u.username, e);
                    }}
                      className={`notif-action-btn${u.myFollowStatus === 'pending' ? '' : ' stay-white'}`}
                      style={{ padding: '6px 12px', background: u.myFollowStatus === 'pending' ? (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)') : 'var(--brand-gradient)', border: 'none', color: u.myFollowStatus === 'pending' ? (isLight ? '#666' : '#6b7280') : '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: u.myFollowStatus === 'pending' ? 'default' : 'pointer' }}>
                      {u.myFollowStatus === 'pending' ? t('requestSent', 'Request Sent') : t('followBack', 'Follow Back')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', color: isLight ? '#666' : '#444', fontSize: 12, padding: 24 }}>{t('noNewNotifications', 'No new notifications')}</div>
        )}
      </div>
    </>
  );
}
