import { appCache } from '../cache/appCache.js';
import { resetPrefetchCooldown } from '../cache/prefetch.js';

export const clearUserSession = () => {
    const keysToRemove = [
        'watch_token',
        'watch_username',
        'watch_is_guest',
        'watch_guest_id',
        'watch_recent_chats',
        'chat_last_seen',
        'chat_group_unread',
        'chat_cleared_partners',
        'pinned_rooms',
        'wt_kp_pw',
        'wt_sk',
        'wt_spw',
        'chat_lock_auto_minutes',
        'chat_lock_auto_on_close',
        'watch_last_activity'
    ];
    
    const prefixesToRemove = [
        'chat_lock_state_',
        'chat_lock_enabled_',
        'locked_chats_',
        'pinned_chats_',
        'muted_chats_',
        'hidden_chats_',
        'blocked_chats_',
        'blocking_me_',
        'pinned_room_chats_',
        'wt_pk_',
        'e2e_keypair_',
        'sp_recent_msgs_'
    ];

    keysToRemove.forEach(k => localStorage.removeItem(k));
    
    try {
        const keys = Object.keys(localStorage);
        keys.forEach(k => {
            if (prefixesToRemove.some(prefix => k.startsWith(prefix))) {
                localStorage.removeItem(k);
            }
        });
    } catch (e) {
        console.warn('Failed to clear some dynamic local storage keys', e);
    }

    // The GET-request cache is keyed by URL only, with no notion of which
    // account asked — without this, a same-tab account switch would keep
    // serving the previous account's cached /api/profile, /api/chats/recent,
    // etc. responses until their TTL lapsed or the page was refreshed.
    appCache.clear();
    resetPrefetchCooldown();
};
