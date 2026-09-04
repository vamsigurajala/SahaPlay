// Pure decision logic for whether a room member is allowed to use their
// webcam/microphone, given the room's host-configurable permission setting
// ('all' | 'host' | 'none') and whether this member currently counts as an
// effective host (room host or admin). Extracted out of Room.jsx, where this
// exact logic used to be duplicated verbatim between the desktop quick-
// controls panel and the mobile action bar — a real duplication bug this
// session (the mobile copy had drifted to a generic "not available" message
// instead of the real "host did not allow" reason the desktop copy showed).
// Keeping one shared, tested source of truth prevents that drift recurring.

const MEDIA_LABELS = {
  cam: 'webcam',
  mic: 'microphone',
};

// `kind` is 'cam' or 'mic' — only used to word the denial message; the
// canUse rule itself is identical for both.
export function evaluateRoomMediaAccess(permission, isEffectiveHost, kind) {
  const label = MEDIA_LABELS[kind] || kind;
  const canUse = permission === 'all' || (permission === 'host' && isEffectiveHost);
  const reason = permission === 'none'
    ? `${label.charAt(0).toUpperCase()}${label.slice(1)} is disabled`
    : (permission === 'host' && !isEffectiveHost)
      ? `Only the host or admins can use ${label}`
      : '';
  return { canUse, reason };
}
