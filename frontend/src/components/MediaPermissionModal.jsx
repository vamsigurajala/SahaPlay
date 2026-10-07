// MediaPermissionModal.jsx — intentionally disabled. This used to be a global
// modal (listening for the 'media_permission_needed' event from
// mediaPermissionGate.js) offering "Allow Access" / "Open Settings" when a
// camera, mic or photo permission was missing on the Capacitor app. It renders
// nothing now and isn't mounted anywhere; the stub is kept so the name still
// resolves if a comment or future import refers to it.
export default function MediaPermissionModal() {
  return null;
}
