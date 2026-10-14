import { appCache } from '../cache/appCache.js';
import { resetPrefetchCooldown } from '../cache/prefetch.js';
import { clearSessionKey } from './crypto.js';

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
        'pinned_rooms_cache',
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
        'wt_my_pubkey_cache_',
        'e2e_keypair_',
        'sp_recent_msgs_',
        'room_history_cache_'
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

    // The REAL wrapped-private-key + wrap-password pair (wt_sk/wt_spw) live in
    // sessionStorage, not localStorage — the keysToRemove list above only ever
    // cleared a now-unused legacy localStorage location. Without this, every
    // logout path that calls clearUserSession() (which is nearly all of
    // them — Navbar, BottomNav, forced 401 logout, inactivity logout, etc.)
    // left the just-logged-out account's encryption key readable from
    // sessionStorage until the tab was fully closed. clearSessionKey() clears
    // both storages, so this one call covers every call site without having
    // to also thread CryptoContext's clearKeys() through all of them.
    try {
        clearSessionKey();
    } catch (e) {
        console.warn('Failed to clear encryption session key', e);
    }

    // Let a mounted CryptoContext drop its in-memory keyPair/needsReauth React
    // state right away too. Most logout call sites navigate via the SPA
    // router rather than a full page reload, which would otherwise leave the
    // just-cleared account's keypair sitting in memory until some unrelated
    // remount happened to clear it.
    try {
        window.dispatchEvent(new Event('wt_session_cleared'));
    } catch (e) { /* non-browser environment — ignore */ }

    // The GET-request cache is keyed by URL only, with no notion of which
    // account asked — without this, a same-tab account switch would keep
    // serving the previous account's cached /api/profile, /api/chats/recent,
    // etc. responses until their TTL lapsed or the page was refreshed.
    appCache.clear();
    resetPrefetchCooldown();
};
