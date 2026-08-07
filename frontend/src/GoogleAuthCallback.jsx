import { useEffect } from 'react';

// Landing point for Google's OAuth redirect after native Google sign-in
// (see lib/nativeGoogleAuth.js) — Google puts the id_token in the URL
// *fragment* (`#id_token=...`), which never reaches a server, so this has to
// run client-side. Its only job is to immediately hand that fragment off to
// the already-running native app via the sahaplay://auth-callback deep link
// (registered in AndroidManifest.xml), re-sent as query params rather than a
// fragment since custom-scheme intent data is matched more reliably that
// way. A real visitor landing here without a genuine Google redirect (empty
// hash) just sees the fallback message — harmless, this page does nothing
// else.
export default function GoogleAuthCallback() {
  useEffect(() => {
    const hash = window.location.hash; // includes leading '#', e.g. "#id_token=...&state=..."
    if (hash && hash.length > 1) {
      window.location.href = `sahaplay://auth-callback?${hash.slice(1)}`;
    }
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0c10', color: '#fff', fontFamily: 'sans-serif', textAlign: 'center', padding: 24 }}>
      <p>Returning to SahaPlay…</p>
    </div>
  );
}
