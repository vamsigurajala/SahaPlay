import React, { useEffect, useLayoutEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { HelmetProvider } from 'react-helmet-async';
import * as Sentry from '@sentry/react';
import { CryptoProvider } from './contexts/CryptoContext';
import { CallProvider } from './contexts/CallContext';
import { API as SHARED_API_BASE } from './lib/api';
import { useInactivityLogout } from './hooks/useInactivityLogout';
import { isTauriApp, isStandalonePWA } from './lib/platform';
import { syncStatusBarTheme } from './lib/nativeShell';
import { setNativeThemePreference } from './lib/nativeMedia';
import { unlockAudio } from './lib/notificationSounds';
import { initAppUpdateCheck } from './lib/appUpdateCheck';
import { RefreshCw, X } from 'lucide-react';
import { APP_THEMES } from './data/appThemes';
import BottomNav from './components/BottomNav';
import AnimatedSplash from './components/AnimatedSplash';
import KeyRecoveryModal from './components/KeyRecoveryModal';
const Home = lazy(() => import('./Home'));
const Dashboard = lazy(() => import('./Dashboard'));
const Room = lazy(() => import('./Room'));
const Login = lazy(() => import('./Login'));
const Signup = lazy(() => import('./Signup'));
const Verify = lazy(() => import('./Verify'));
const ForgotPassword = lazy(() => import('./ForgotPassword'));
const GoogleAuthCallback = lazy(() => import('./GoogleAuthCallback'));
const ResetPassword = lazy(() => import('./ResetPassword'));
const PublicRooms = lazy(() => import('./PublicRooms'));
const PinnedRooms = lazy(() => import('./PinnedRooms'));
const Profile = lazy(() => import('./Profile'));
const AppSettings = lazy(() => import('./AppSettings'));
const TvPairing = lazy(() => import('./TvPairing'));
const Features = lazy(() => import('./Features'));
const HowItWorks = lazy(() => import('./HowItWorks'));
const Pricing = lazy(() => import('./Pricing'));
const Contact = lazy(() => import('./Contact'));
const ReportBug = lazy(() => import('./ReportBug'));
const Safety = lazy(() => import('./Safety'));
const Cookies = lazy(() => import('./Cookies'));
const Terms = lazy(() => import('./Terms'));
const LawEnforcement = lazy(() => import('./LawEnforcement'));
const Admin = lazy(() => import('./Admin'));

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ERROR BOUNDARY]', error, info.componentStack);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });

    // Lazy-loaded route chunks are hashed per-deploy. If a tab has been open
    // across a new deploy (very common here — this repo ships several times a
    // day), its in-memory route table still points at chunk filenames that no
    // longer exist on the server, so the dynamic import 404s and throws instead
    // of a normal network error. This is what was showing up as "Login
    // sometimes fails with Something went wrong, works after a refresh" —
    // clicking Login (or navigating post-login into Home/Room) is exactly when
    // a stale tab first tries to lazy-load a chunk that no longer exists.
    //
    // The same "Something went wrong" screen also showed up after a genuinely
    // successful login: post-login views (Dashboard/Navbar/etc.) fetch profile
    // data immediately, and while the Render backend is cold-starting those
    // requests can come back malformed/late in ways a render doesn't expect,
    // throwing mid-render. Rather than only auto-recovering the chunk-hash
    // case, auto-reload once for *any* caught render error — a silent one-shot
    // reload is strictly better than leaving the user stuck on a manual
    // "Refresh" button either way. Guarded by sessionStorage so a genuinely
    // broken render doesn't reload-loop forever; the guard is cleared on next
    // stable mount (see the effect in App()) so a later deploy/backend hiccup
    // can still auto-recover.
    const guardKey = 'watch_chunk_reload_attempted';
    if (!sessionStorage.getItem(guardKey)) {
      sessionStorage.setItem(guardKey, '1');
      window.location.reload();
    }
  }
  render() {
    if (this.state.hasError) {
      // componentDidCatch (above) auto-reloads once per session, silently,
      // for exactly this kind of self-healing hiccup (stale post-deploy
      // chunk, cold-starting backend) — the reload itself takes a moment,
      // and this render() runs BEFORE componentDidCatch's sessionStorage
      // write (React calls getDerivedStateFromError + this render, THEN
      // componentDidCatch), so the guard read here still correctly reflects
      // "have we already tried this, this session" without needing its own
      // extra setState/render round trip. Showing the real "Something went
      // wrong" text for a failure that's about to silently fix itself is
      // exactly the flash the user shouldn't have to see; only a SECOND
      // failure this session (the auto-reload already happened once and it
      // still broke) is worth surfacing as something to act on.
      const alreadyAutoReloaded = !!sessionStorage.getItem('watch_chunk_reload_attempted');
      if (!alreadyAutoReloaded) {
        return (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100vh', background: '#0f0a1e',
          }}>
            <div style={{ width: 34, height: 34, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: 'var(--brand-1, #a855f7)', borderRadius: '50%', animation: 'errBoundarySpin 0.8s linear infinite' }} />
            <style>{'@keyframes errBoundarySpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
          </div>
        );
      }
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', background: '#0f0a1e',
          color: '#fff', gap: 16,
        }}>
          <h2 className="stay-white">Something went wrong</h2>
          <p style={{ color: '#aaa', fontSize: 14 }}>Please refresh the page</p>
          {/* Surfaces the actual thrown error right here — this has been
              genuinely hard to pin down blind (repeated live reproduction
              attempts against production found nothing), so the fastest path
              to a real fix is showing whoever hits it exactly what broke,
              not sending them to dig through DevTools. Sentry already gets
              this via componentDidCatch above; this is the same information,
              just visible without needing separate access to that dashboard. */}
          {this.state.error && (
            <pre style={{
              color: '#f87171', fontSize: 11, maxWidth: '90vw', maxHeight: '30vh',
              overflow: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '10px 14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              textAlign: 'left',
            }}>
              {String(this.state.error?.message || this.state.error)}
              {this.state.error?.stack ? `\n\n${this.state.error.stack}` : ''}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'var(--brand-2-dark)', color: '#fff', border: 'none',
              padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 14,
            }}
            className="stay-white"
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AcceptInvitePage() {
  const [status, setStatus] = React.useState('idle'); // idle | loading | success | error
  const [msg, setMsg] = React.useState('');
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const email = params.get('email');

  React.useEffect(() => {
    if (!token || !email) { setStatus('error'); setMsg('Invalid invite link.'); return; }
    const authToken = localStorage.getItem('watch_token');
    if (!authToken) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    setStatus('loading');
    const apiBase = SHARED_API_BASE;
    fetch(`${apiBase}/api/admin/accept-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ token, email }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          localStorage.setItem('watch_role', d.role || 'admin');
          setStatus('success'); setMsg(d.message || 'Welcome to the SahaPlay admin team!');
        } else {
          setStatus('error'); setMsg(d.error || 'Failed to accept invite.');
        }
      })
      .catch(() => { setStatus('error'); setMsg('Network error. Please try again.'); });
  }, []);

  const bg = '#0a0a12'; const card = 'rgba(255,255,255,0.04)'; const border = 'rgba(255,255,255,0.08)';
  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 18, padding: '40px 48px', maxWidth: 420, width: '90%', textAlign: 'center' }}>
        <img src="/logos/trans_webl.png" alt="SahaPlay" style={{ width: 40, height: 40, marginBottom: 16 }} />
        <h2 style={{ color: '#fff', margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>SahaPlay Admin</h2>
        {status === 'loading' && <p style={{ color: 'rgba(255,255,255,0.5)', margin: '24px 0' }}>Verifying invite…</p>}
        {status === 'success' && (
          <>
            <p style={{ color: '#34d399', margin: '20px 0 8px', fontWeight: 700, fontSize: 15 }}>{msg}</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '0 0 24px' }}>You now have admin access.</p>
            <button onClick={() => window.location.href = '/admin'}
              style={{ padding: '11px 28px', borderRadius: 10, border: 'none', background: 'rgba(var(--brand-1-rgb),0.2)', color: 'var(--brand-1-light)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Go to Dashboard
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <p style={{ color: '#f87171', margin: '20px 0 8px', fontWeight: 700, fontSize: 15 }}>{msg}</p>
            <button onClick={() => window.location.href = '/'}
              style={{ padding: '11px 28px', borderRadius: 10, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 12 }}>
              Back to Home
            </button>
          </>
        )}
        {status === 'idle' && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, margin: '20px 0' }}>Loading…</p>}
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Suspense fallback shown while a lazy route chunk loads. Delayed by
// SHOW_DELAY_MS so cached/fast chunk loads (the common case after the first
// visit) never flash it at all — it only appears for loads that are
// actually slow enough to need one.
const ROUTE_FALLBACK_SHOW_DELAY_MS = 200;
function RouteLoadingFallback() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), ROUTE_FALLBACK_SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!show) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, height: '100vh', width: '100%', background: '#0a0a12' }}>
      <img src="/logos/trans_webl.png" alt="SahaPlay" style={{ width: 44, height: 44, opacity: 0.9 }} />
      <div style={{ width: 30, height: 30, border: '3px solid rgba(var(--brand-1-rgb),0.2)', borderTop: '3px solid var(--brand-1-light)', borderRadius: '50%', animation: 'app-route-spin 0.8s linear infinite' }} />
      <style>{'@keyframes app-route-spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = !!localStorage.getItem('watch_token');
  const isGuest = localStorage.getItem('watch_is_guest') === 'true';
  useInactivityLogout();
  return (isAuthenticated || isGuest) ? children : <Navigate to="/login" replace />;
};

// Root route: web visitors always get Home (the marketing landing page), regardless of
// auth state — this is the public SEO entry point and must not require a session (it
// previously did, via an outer ProtectedRoute wrapper, which silently redirected every
// anonymous visitor — and every crawler — straight to /login before Home ever rendered).
// The Tauri desktop app is a different context: it already has the user's attention
// (they installed it), so a logged-in/guest session there skips straight to the
// functional Dashboard, while a logged-out Tauri session still needs its own auth gate
// since there's no public marketing surface to show inside the installed app.
const RootRoute = () => {
  const isAuthenticated = !!localStorage.getItem('watch_token');
  const isGuest = localStorage.getItem('watch_is_guest') === 'true';
  useInactivityLogout();
  if (isTauriApp()) return (isAuthenticated || isGuest) ? <Dashboard /> : <Navigate to="/login" replace />;
  return <Home />;
};

// AdminRoute: checks role from the DB via /api/me on every render — never trusts localStorage
const AdminRoute = ({ children }) => {
  const [status, setStatus] = useState('loading'); // 'loading' | 'admin' | 'denied'
  useInactivityLogout();

  useEffect(() => {
    const token = localStorage.getItem('watch_token');
    if (!token) { setStatus('denied'); return; }
    const apiBase = SHARED_API_BASE;
    fetch(`${apiBase}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setStatus(['super_admin', 'admin', 'moderator', 'support'].includes(data.role) ? 'admin' : 'denied'))
      .catch(() => setStatus('denied'));
  }, []);

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>Verifying access…</div>
      </div>
    );
  }
  return status === 'admin' ? children : <Navigate to="/" replace />;
};

const roomMatch = window.location.pathname.match(/^\/room\/([^/]+)/);
if (roomMatch) {
  const token = localStorage.getItem('watch_token');
  const isGuest = localStorage.getItem('watch_is_guest') === 'true';
  if (!token && !isGuest) {
    const ADJECTIVES = ["Anonymous", "Happy", "Clever", "Swift", "Bright", "Quiet", "Silly", "Fancy", "Jolly", "Cool", "Chilly", "Kind", "Brave", "Calm", "Eager", "Friendly", "Gentle", "Witty", "Spunky", "Sneaky"];
    const ANIMALS = ["Penguin", "Fox", "Bear", "Koala", "Panda", "Otter", "Rabbit", "Squirrel", "Dolphin", "Tiger", "Lion", "Owl", "Sloth", "Beaver", "Hedgehog", "Raccoon", "Hamster", "Deer", "Elephant", "Badger"];
    const randomAdj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const randomAnim = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const randomNum = Math.floor(100 + Math.random() * 900);
    const guestName = `${randomAdj} ${randomAnim} ${randomNum}`;

    const keysToRemove = [
      'watch_token',
      'watch_username',
      'watch_is_guest',
      'watch_guest_id',
      'wt_kp_pw',
      'wt_session_key',
      'wt_session_pw'
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));

    localStorage.setItem('watch_username', 'guest_' + guestName);
    localStorage.setItem('watch_is_guest', 'true');
  }
}

function App() {
  const { i18n } = useTranslation();
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // Room.jsx is by far the largest lazy chunk in the app (the video
  // player, chat, calling, and every game/media integration all live in
  // it) — reported as "clicking a room takes a long time to load". Most
  // room entries (Home's hero Join form, Pinned Rooms/Room History cards,
  // Public Rooms cards, search) never open the chat widget first, so they
  // never hit GlobalChatWidget.jsx's own existing prefetch of this same
  // chunk (triggered only once a room-type chat is open there). Warming it
  // once, here, as soon as the browser is idle after first paint — instead
  // of waiting for any specific click — means by the time a user actually
  // taps a room from anywhere, the chunk is very likely already fetched
  // and parsed, so entering feels instant instead of paying that cost
  // synchronously on the click. Cheap and harmless if never used (worst
  // case: one extra chunk fetch on a session that never opens a room).
  useEffect(() => {
    const warm = () => { import('./Room').catch(() => {}); };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(warm, { timeout: 4000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = setTimeout(warm, 2000);
    return () => clearTimeout(id);
  }, []);

  // See appUpdateCheck.js — proactively detects a new deploy going live
  // while this tab/window is still open, so the user gets a chance to
  // refresh on their own terms instead of the app silently going stale
  // until a lazy-loaded chunk 404s (the ErrorBoundary's reactive fallback
  // below still exists as a safety net for exactly that case).
  useEffect(() => {
    return initAppUpdateCheck(() => setUpdateAvailable(true));
  }, []);

  // Clear the ErrorBoundary's one-shot auto-reload guard once the app has been
  // running stably for a few seconds, so a future genuine chunk load failure
  // (e.g. after the next deploy) can still trigger one auto-reload.
  //
  // This must NOT clear immediately on mount: App() mounts synchronously well
  // before a lazy route's async import() has resolved or rejected, including
  // on the reloaded page right after an auto-reload. Clearing unconditionally
  // here raced the guard — if the same chunk failure re-threw moments after
  // the reload (e.g. a genuinely broken/missing asset, not just a stale tab),
  // the guard had already been wiped, so componentDidCatch reloaded again,
  // and again, in a real infinite reload loop instead of stopping at one
  // attempt like the guard is supposed to guarantee. Delaying the clear gives
  // a persistently-broken chunk time to re-throw while the guard is still set.
  useEffect(() => {
    const timer = setTimeout(() => {
      sessionStorage.removeItem('watch_chunk_reload_attempted');
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Unlocks the shared Web Audio context (notification/message tones) on the
  // very first tap anywhere in the app — mobile browsers/WebViews (Android's
  // Capacitor WebView included) otherwise leave it permanently silent since
  // it's normally first created from an async socket-event handler, with no
  // user gesture in that call stack. See notificationSounds.js's unlockAudio.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('touchend', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchend', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Belt-and-suspenders on top of `user-select: none` (e.g. the chat
  // message bubbles, and the quoted-reply preview shown on a message that
  // is itself a reply) — the CSS property alone is enough on most engines,
  // but some Android WebView versions can still let a long-press start a
  // native text selection despite it, since their selection handling
  // doesn't purely defer to user-select in every case. The 'selectstart'
  // event fires right as a selection is about to begin, independent of
  // user-select support, and preventing it there is a well-established
  // second line of defense for exactly this — reported as the quoted-reply
  // preview still being selectable on long-press on some phones even after
  // user-select:none was already in place. Delegated on document (checking
  // computed style at the actual target) rather than one listener per
  // element, so it automatically covers every current and future
  // user-select:none element in the app with no per-component wiring.
  useEffect(() => {
    const onSelectStart = (e) => {
      const el = e.target?.closest?.('[style*="user-select"], .msg-sent, .msg-received');
      if (el && getComputedStyle(el).userSelect === 'none') e.preventDefault();
    };
    document.addEventListener('selectstart', onSelectStart);
    return () => document.removeEventListener('selectstart', onSelectStart);
  }, []);

  useEffect(() => {
    const fetchAndApplySettings = () => {
      const token = localStorage.getItem('watch_token');
      if (token) {
        const apiBase = SHARED_API_BASE;
        fetch(`${apiBase}/api/settings`, { headers: { 'Authorization': `Bearer ${token}` } })
          .then(r => r.json())
          .then(data => {
            if (!data.error && data.language) {
              const normalizedLang = data.language.split('-')[0].toLowerCase();
              i18n.changeLanguage(normalizedLang);
              localStorage.setItem('watch_language', normalizedLang);
            }
          }).catch(()=>{});
      }
    };

    fetchAndApplySettings();

    window.addEventListener('login_success', fetchAndApplySettings);
    window.addEventListener('settings_changed', fetchAndApplySettings);

    return () => {
      window.removeEventListener('login_success', fetchAndApplySettings);
      window.removeEventListener('settings_changed', fetchAndApplySettings);
    };
  }, [i18n]);

  useEffect(() => {
    // ── Runtime Light Mode Stylesheet ──
    // We inject a <style id="light-mode-overrides"> tag when theme=light.
    // This is the ONLY reliable way to override inline styles in React:
    // we use `color` and `background-color` cascade overrides via * selectors.
    const LIGHT_STYLE_ID = 'light-mode-overrides';

    const LIGHT_CSS = `
      /* ── Base page ── */
      html[data-theme='light'] body {
        background: linear-gradient(135deg, #f0f0f8 0%, #e8e8f5 50%, #f0f0f8 100%) !important;
        color: #111 !important;
      }

      /* ── Force ALL text to be dark unless it's inside an element with a colored gradient bg or explicitly marked to stay white/red/custom ── */
      html[data-theme='light'] *:not(.stay-white):not(.unread-badge):not(.badge-text):not(.danger-red-btn):not(.msg-sent):not(.gcw-force-dark):not(.gcw-force-dark *):not(.stay-red):not(.stay-color) {
        color: inherit;
        border-color: rgba(0,0,0,0.1);
      }

      /* Protection for explicitly white text */
      html[data-theme='light'] .stay-white,
      html[data-theme='light'] .stay-white *,
      html[data-theme='light'] .stay-color,
      html[data-theme='light'] .back-to-top-btn,
      html[data-theme='light'] .unread-badge,
      html[data-theme='light'] .unread-badge *,
      html[data-theme='light'] .danger-red-btn,
      html[data-theme='light'] .danger-red-btn *,
      html[data-theme='light'] .msg-sent,
      html[data-theme='light'] .msg-sent * {
        color: #ffffff !important;
        -webkit-text-fill-color: #ffffff !important;
      }

      /* ── Navbar, panels, cards – force bg to white/light ── */
      html[data-theme='light'] nav,
      html[data-theme='light'] [style*="background: rgba(255,255,255,0.02)"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="background: rgba(255,255,255,0.03)"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="background: rgba(255,255,255,0.04)"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="background: rgba(255,255,255,0.05)"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="background: rgba(255,255,255,0.06)"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="background: rgba(255,255,255,0.07)"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="background: rgba(255,255,255,0.08)"]:not(.gcw-force-dark):not(.gcw-force-dark *) {
        background: rgba(0,0,0,0.03) !important;
      }
      html[data-theme='light'] [style*="background: rgba(255,255,255,0.1)"]:not(.gcw-force-dark):not(.gcw-force-dark *) {
        background: rgba(0,0,0,0.05) !important;
      }
      html[data-theme='light'] [style*="background: rgba(255,255,255,0.12)"]:not(.gcw-force-dark):not(.gcw-force-dark *) {
        background: rgba(0,0,0,0.07) !important;
      }
      html[data-theme='light'] [style*="background: rgba(255,255,255,0.15)"]:not(.gcw-force-dark):not(.gcw-force-dark *) {
        background: rgba(0,0,0,0.08) !important;
      }

      /* ── Dark card backgrounds (#111, #0a0a0a etc.) become white cards ── */
      html[data-theme='light'] [style*="background: #111"],
      html[data-theme='light'] [style*="background:#111"],
      html[data-theme='light'] [style*="background: #0a0a0a"],
      html[data-theme='light'] [style*="background: #0d0d0d"],
      html[data-theme='light'] [style*="background: #141418"],
      html[data-theme='light'] [style*="background: #1a1a2e"],
      html[data-theme='light'] [style*="background: #16213e"] {
        background: #ffffff !important;
        border-color: rgba(0,0,0,0.08) !important;
      }

      /* ── All semi-transparent white TEXT → proper dark text ── */
      html[data-theme='light'] [style*="color: rgba(255,255,255"]:not(.stay-white):not(.stay-color):not(.gcw-force-dark):not(.gcw-force-dark *):not(.footer-social-btn):not(.back-to-top-btn),
      html[data-theme='light'] [style*="color:rgba(255,255,255"]:not(.stay-white):not(.stay-color):not(.gcw-force-dark):not(.gcw-force-dark *):not(.footer-social-btn):not(.back-to-top-btn),
      html[data-theme='light'] [style*="color: rgb(255, 255, 255"]:not(.stay-white):not(.stay-color):not(.gcw-force-dark):not(.gcw-force-dark *):not(.footer-social-btn):not(.back-to-top-btn),
      html[data-theme='light'] [style*="color: #fff"]:not(.stay-white):not(.stay-color):not(.gcw-force-dark):not(.gcw-force-dark *):not(.footer-social-btn):not(.back-to-top-btn),
      html[data-theme='light'] [style*="color:#fff"]:not(.stay-white):not(.stay-color):not(.gcw-force-dark):not(.gcw-force-dark *):not(.footer-social-btn):not(.back-to-top-btn),
      html[data-theme='light'] [style*="color: #ffffff"]:not(.stay-white):not(.stay-color):not(.gcw-force-dark):not(.gcw-force-dark *):not(.footer-social-btn):not(.back-to-top-btn),
      html[data-theme='light'] [style*="color: #f1f1f1"]:not(.stay-white):not(.stay-color):not(.gcw-force-dark):not(.gcw-force-dark *):not(.footer-social-btn):not(.back-to-top-btn),
      html[data-theme='light'] [style*="color: #e2e8f0"]:not(.stay-white):not(.stay-color):not(.gcw-force-dark):not(.gcw-force-dark *):not(.footer-social-btn):not(.back-to-top-btn),
      html[data-theme='light'] [style*="color: #ccc"]:not(.stay-white):not(.stay-color):not(.gcw-force-dark):not(.gcw-force-dark *):not(.footer-social-btn):not(.back-to-top-btn),
      html[data-theme='light'] [style*="color:#ccc"]:not(.stay-white):not(.stay-color):not(.gcw-force-dark):not(.gcw-force-dark *):not(.footer-social-btn):not(.back-to-top-btn),
      html[data-theme='light'] [style*="color: #ddd"]:not(.stay-white):not(.stay-color):not(.gcw-force-dark):not(.gcw-force-dark *):not(.footer-social-btn):not(.back-to-top-btn),
      html[data-theme='light'] [style*="color:#ddd"]:not(.stay-white):not(.stay-color):not(.gcw-force-dark):not(.gcw-force-dark *):not(.footer-social-btn):not(.back-to-top-btn) {
        color: #111 !important;
      }

      /* ── Mid-gray text → proper readable dark gray ── */
      html[data-theme='light'] [style*="color: #888"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="color:#888"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="color: #666"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="color:#666"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="color: #555"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="color:#555"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="color: #aaa"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="color:#aaa"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="color: #999"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="color:#999"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="color: #6b7280"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="color:#6b7280"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="color: #4b5563"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="color: #444"]:not(.gcw-force-dark):not(.gcw-force-dark *),
      html[data-theme='light'] [style*="color:#444"]:not(.gcw-force-dark):not(.gcw-force-dark *) {
        color: #4a5568 !important;
      }

      /* ── Fix BORDER-color for semi-transparent white borders ── */
      html[data-theme='light'] [style*="border: 1px solid rgba(255,255,255"],
      html[data-theme='light'] [style*="border-bottom: 1px solid rgba(255,255,255"],
      html[data-theme='light'] [style*="border-top: 1px solid rgba(255,255,255"],
      html[data-theme='light'] [style*="border-left: 1px solid rgba(255,255,255"],
      html[data-theme='light'] [style*="border-right: 1px solid rgba(255,255,255"],
      html[data-theme='light'] [style*="border: 1px solid rgba(255, 255, 255"] {
        border-color: rgba(0,0,0,0.1) !important;
      }

      /* ── Buttons with dark semi-transparent backgrounds → light surface ── */
      html[data-theme='light'] button[style*="background: rgba(255,255,255,0.05)"]:not(.gcw-force-dark button),
      html[data-theme='light'] button[style*="background: rgba(255,255,255,0.06)"]:not(.gcw-force-dark button),
      html[data-theme='light'] button[style*="background: rgba(255,255,255,0.08)"]:not(.gcw-force-dark button),
      html[data-theme='light'] button[style*="background: rgba(255,255,255,0.1)"]:not(.gcw-force-dark button) {
        background: rgba(0,0,0,0.06) !important;
        color: #333 !important;
      }

      /* ── Input / textarea fields ── */
      html[data-theme='light'] input[style]:not(.gcw-force-dark input),
      html[data-theme='light'] textarea[style]:not(.gcw-force-dark textarea) {
        background: #ffffff !important;
        color: #111 !important;
        border-color: rgba(0,0,0,0.15) !important;
      }
      html[data-theme='light'] input::placeholder:not(.gcw-force-dark input::placeholder),
      html[data-theme='light'] textarea::placeholder:not(.gcw-force-dark textarea::placeholder) {
        color: rgba(0,0,0,0.35) !important;
      }
      html[data-theme='light'] .input-field {
        background: #ffffff !important;
        color: #111 !important;
        border-color: rgba(0,0,0,0.2) !important;
      }

      /* ── select dropdowns ── */
      html[data-theme='light'] select:not(.gcw-force-dark select),
      html[data-theme='light'] .device-select:not(.gcw-force-dark .device-select) {
        background: #f9f9f9 !important;
        color: #111 !important;
        border-color: rgba(0,0,0,0.15) !important;
      }
      html[data-theme='light'] select option:not(.gcw-force-dark option) {
        background: #ffffff !important;
        color: #111 !important;
      }

      /* ── h1 gradient text fix ── */
      html[data-theme='light'] h1 {
        -webkit-text-fill-color: #111 !important;
        background: none !important;
        color: #111 !important;
      }
      
      /* ── Chat widget container (fixed positioned floating panel) ── */

       html[data-theme='light'] [style*="position: fixed"][style*="background"]:not(.chat-widget-main-panel):not(.chat-modal-overlay):not(.share-modal-overlay):not(.room-modals-overlay):not(.lock-screen-overlay):not(.safety-modal-overlay):not(.report-modal-overlay):not(.report-modal-card):not(.gcw-force-dark .chat-modal-overlay):not(.back-to-top-btn):not(.media-lightbox-overlay):not(.media-selector-overlay):not(.subtitle-modal-overlay):not(.customize-room-overlay):not(.block-confirm-overlay):not(.admin-modal-overlay):not(.chat-theme-sheet-overlay):not(.reactors-sheet-overlay):not(.gcw-force-dark):not(.gcw-force-dark *),
       html[data-theme='light'] [style*="position: fixed"] > div[style*="background"]:not(.chat-widget-main-panel):not(.chat-modal-overlay):not(.share-modal-overlay):not(.room-modals-overlay):not(.lock-screen-overlay):not(.block-confirm-overlay):not(.admin-modal-card):not(.report-modal-overlay):not(.report-modal-card):not(.chat-theme-sheet-overlay):not(.reactors-sheet-overlay):not(.chat-wallpaper-backdrop):not(.gcw-composer-bar):not(.gcw-force-dark):not(.gcw-force-dark *):not(.media-lightbox-card) {
        background: #f7f8fc !important;
        border-color: rgba(0,0,0,0.1) !important;
      }
      html[data-theme='light'] .block-confirm-overlay {
        background: rgba(15, 23, 42, 0.35) !important;
        backdrop-filter: blur(4px) !important;
        -webkit-backdrop-filter: blur(4px) !important;
      }
      html[data-theme='light'] .subtitle-modal-overlay {
        background: rgba(255,255,255,0.4) !important;
        backdrop-filter: blur(4px) !important;
        -webkit-backdrop-filter: blur(4px) !important;
      }
      html[data-theme='light'] .customize-room-overlay {
        background: rgba(0,0,0,0.55) !important;
        backdrop-filter: blur(8px) !important;
        -webkit-backdrop-filter: blur(8px) !important;
      }
      html[data-theme='light'] .media-selector-overlay {
        background: rgba(0, 0, 0, 0.35) !important;
        backdrop-filter: blur(18px) !important;
        -webkit-backdrop-filter: blur(18px) !important;
      }
      html[data-theme='light'] .chat-modal-overlay:not(.gcw-force-dark .chat-modal-overlay) {
        background: rgba(15, 23, 42, 0.4) !important;
      }
      html[data-theme='light'] .safety-modal-overlay {
        background: rgba(0,0,0,0.75) !important;
        backdrop-filter: blur(8px) !important;
        -webkit-backdrop-filter: blur(8px) !important;
      }
      html[data-theme='light'] .report-modal-overlay {
        background: rgba(0,0,0,0.45) !important;
        backdrop-filter: blur(4px) !important;
        -webkit-backdrop-filter: blur(4px) !important;
      }

      /* ── Admin ticket detail (Reports / Support) — right-side drawer on real desktop ── */
      /* Gated on hover+fine pointer (not just width) so iPads of any size/orientation keep the centered modal below */
      @media (min-width: 901px) and (hover: hover) and (pointer: fine) {
        .admin-ticket-overlay {
          justify-content: flex-end !important;
          align-items: stretch !important;
          padding: 0 !important;
        }
        .admin-ticket-card {
          width: min(480px, 100vw) !important;
          max-width: 480px !important;
          height: 100vh !important;
          max-height: 100vh !important;
          border-radius: 16px 0 0 16px !important;
          animation: adminTicketSlideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }
      }
      @keyframes adminTicketSlideIn {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }

      /* Skeleton shimmer — used for the admin ticket-detail loading state */
      @keyframes skeletonShimmer {
        0% { background-position: -400px 0; }
        100% { background-position: 400px 0; }
      }
      .skeleton-block {
        border-radius: 8px;
        background-image: linear-gradient(90deg, var(--skel-base, rgba(255,255,255,0.06)) 25%, var(--skel-shine, rgba(255,255,255,0.14)) 37%, var(--skel-base, rgba(255,255,255,0.06)) 63%);
        background-size: 800px 100%;
        animation: skeletonShimmer 1.4s ease-in-out infinite;
      }
      html[data-theme='light'] .skeleton-block {
        --skel-base: rgba(15,23,42,0.06);
        --skel-shine: rgba(15,23,42,0.14);
      }
      html[data-theme='light'] .chat-widget-main-panel:not(.gcw-force-dark) {
        background: #ffffff !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        border-color: rgba(0, 0, 0, 0.08) !important;
      }

      /* ── Force white text for danger buttons ── */
      html[data-theme='light'] .chat-modal-danger-btn,
      html[data-theme='light'] .chat-modal-danger-btn * {
        color: #ffffff !important;
      }

      /* ── Settings cards ── */
      html[data-theme='light'] .settings-card {
        background: rgba(255,255,255,0.8) !important;
        border-color: rgba(0,0,0,0.08) !important;
        box-shadow: 0 2px 12px rgba(0,0,0,0.06) !important;
      }
      html[data-theme='light'] .settings-card:hover {
        border-color: rgba(0,0,0,0.15) !important;
      }
      html[data-theme='light'] .acc-header h3 {
        color: #1a202c !important;
      }

      /* ── Scrollbars ── */
      html[data-theme='light'] ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
        display: block !important;
      }
      html[data-theme='light'] ::-webkit-scrollbar-track {
        background: transparent !important;
      }
      html[data-theme='light'] ::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.15) !important;
        border-radius: 10px !important;
      }
      html[data-theme='light'] ::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.25) !important;
      }
      html[data-theme='light'] *:not(.admin-wrapper):not(.admin-wrapper *) {
        -ms-overflow-style: auto !important;
        scrollbar-width: auto !important;
      }
      html[data-theme='light'] .no-scrollbar::-webkit-scrollbar {
        display: none !important;
      }
      html[data-theme='light'] .no-scrollbar {
        -ms-overflow-style: none !important;
        scrollbar-width: none !important;
      }

      /* ── Red Danger Buttons (Clear Chat, Delete, etc.) ── */
      html[data-theme='light'] .danger-red-btn,
      html[data-theme='light'] .danger-red-btn * {
        color: #ffffff !important;
      }

      /* ── Notification/alert badge (red) ── */
      html[data-theme='light'] .unread-badge {
        background-color: #ef4444 !important;
        color: #ffffff !important;
      }

      /* ── Dropdowns (Search, Notifications, Profile) ── */
      html[data-theme='light'] .nav-dropdown:not(.gcw-force-dark .nav-dropdown) {
        background: #ffffff !important;
        border: 1px solid rgba(0,0,0,0.12) !important;
        box-shadow: 0 10px 40px rgba(0,0,0,0.1) !important;
      }

      /* Text color for dropdowns */
      html[data-theme='light'] .nav-dropdown:not(.gcw-force-dark .nav-dropdown) {
        color: #1e293b !important;
      }
      html[data-theme='light'] .nav-dropdown button:not(.gcw-force-dark button):not(.notif-action-btn) {
        color: #1e293b !important;
      }
      /* Preserve Log Out button red text */
      html[data-theme='light'] .nav-dropdown button[style*="f87171"]:not(.gcw-force-dark button) {
        color: #ef4444 !important;
      }

      /* Enhance Profile Menu Icon backgrounds in Light Mode */
      html[data-theme='light'] .nav-dropdown div[style*="var(--brand-1-rgb)"] {
        background: rgba(var(--brand-1-rgb),0.25) !important;
      }
      html[data-theme='light'] .nav-dropdown div[style*="16, 185, 129"],
      html[data-theme='light'] .nav-dropdown div[style*="16,185,129"] {
        background: rgba(16,185,129,0.25) !important;
      }
      html[data-theme='light'] .nav-dropdown div[style*="245, 158, 11"],
      html[data-theme='light'] .nav-dropdown div[style*="245,158,11"] {
        background: rgba(245,158,11,0.25) !important;
      }
      html[data-theme='light'] .nav-dropdown div[style*="239, 68, 68"],
      html[data-theme='light'] .nav-dropdown div[style*="239,68,68"] {
        background: rgba(239,68,68,0.25) !important;
      }

      /* 3-dot options menu on public profiles */
      html[data-theme='light'] .options-dropdown {
        background: #ffffff !important;
        border: 1px solid rgba(0,0,0,0.1) !important;
        box-shadow: 0 10px 40px rgba(0,0,0,0.12) !important;
      }
      html[data-theme='light'] .options-dropdown-country {
        color: #475569 !important;
        border-bottom-color: rgba(0,0,0,0.07) !important;
      }
      html[data-theme='light'] .options-dropdown-btn {
        color: #1e293b !important;
      }
      html[data-theme='light'] .options-dropdown-btn:hover {
        background: rgba(0,0,0,0.04) !important;
      }

      /* Bio text on public profiles */
      html[data-theme='light'] .profile-bio-text {
        color: #1e293b !important;
      }

      /* 3-dot button: black icon on hover in light mode */
      html[data-theme='light'] .options-three-dot-btn {
        color: #374151 !important;
      }
      html[data-theme='light'] .options-three-dot-btn:hover {
        color: #000000 !important;
        background: rgba(0,0,0,0.07) !important;
      }

      /* Share Profile URL text: pitch black in light mode */
      html[data-theme='light'] .options-dropdown-btn {
        color: #000000 !important;
        font-weight: 600 !important;
      }

      /* Share Modal */
      html[data-theme='light'] .share-modal-overlay {
        background: rgba(0,0,0,0.45) !important;
        backdrop-filter: blur(10px) !important;
        -webkit-backdrop-filter: blur(10px) !important;
      }
      html[data-theme='light'] .share-modal-content {
        background: rgba(255,255,255,0.95) !important;
        border-color: rgba(0,0,0,0.1) !important;
        box-shadow: 0 24px 60px rgba(0,0,0,0.2) !important;
      }
      html[data-theme='light'] .share-modal-title {
        color: #0f172a !important;
      }
      html[data-theme='light'] .share-modal-url-row {
        background: transparent !important;
        border: 1.5px solid #cbd5e1 !important;
        border-radius: 10px !important;
        padding: 6px 6px 6px 14px !important;
      }
      html[data-theme='light'] .share-modal-url-input {
        color: #374151 !important;
      }
      html[data-theme='light'] .share-modal-copy-btn {
        color: #ffffff !important;
        border-radius: 8px !important;
        padding: 8px 16px !important;
      }
      html[data-theme='light'] .share-modal-close {
        background: #e2e8f0 !important;
        border: 1px solid #cbd5e1 !important;
        color: #0f172a !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important;
      }
      html[data-theme='light'] .share-modal-close:hover {
        background: #cbd5e1 !important;
        color: #000000 !important;
      }

      /* Dropdown Inputs */
      html[data-theme='light'] .nav-input {
        background: rgba(0,0,0,0.05) !important;
        border: 1px solid rgba(0,0,0,0.12) !important;
        color: #000000 !important;
      }
      html[data-theme='light'] .nav-input::placeholder {
        color: #666666 !important;
      }

      /* Navigation Icons */
      html[data-theme='light'] .nav-icon-btn {
        color: #555555 !important;
        background: rgba(0,0,0,0.04) !important;
        border-color: rgba(0,0,0,0.08) !important;
      }
      html[data-theme='light'] .nav-icon-btn:hover {
        color: #000000 !important;
        background: rgba(0,0,0,0.08) !important;
        border-color: rgba(0,0,0,0.15) !important;
      }
      html[data-theme='light'] .nav-icon-btn.active {
        color: var(--brand-2-dark) !important;
        background: rgba(var(--brand-2-rgb), 0.08) !important;
        border-color: rgba(var(--brand-2-rgb), 0.3) !important;
      }

      /* Profile Pill */
      html[data-theme='light'] .profile-pill {
        background: rgba(0,0,0,0.04) !important;
        border-color: rgba(0,0,0,0.1) !important;
        color: #000000 !important;
      }

      /* Dropdown Arrow color (matching preview) */
      html[data-theme='light'] .chat-item-arrow {
        color: #444444 !important;
      }
      html[data-theme='light'] .chat-item-arrow:hover {
        color: #000000 !important;
      }

      html[data-theme='light'] .msg-bubble,
      html[data-theme='light'] .msg-bubble * {
        color: #ffffff !important;
      }

      /* File card text overrides inside sent message bubbles. :not(.on-wallpaper)
         on each — a wallpaper needs this text to stay white regardless of the
         light/dark toggle (see GlobalChatWidget.jsx/RoomChatPanel.jsx's own
         ".on-wallpaper .fc-name"-style rules), and this rule was winning
         over that one on ties since it's a global rule with no reliable
         ordering relative to a component-local <style> tag. */
      html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .fc-name { color: #111827 !important; }
      html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .fc-sub { color: #374151 !important; }
      html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .fc-expiry-warn { color: #d97706 !important; }
      html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .fc-expiry-ok { color: #9ca3af !important; }
      html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .fc-dl,
      html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .fc-dl * { color: var(--brand-2-darker) !important; }
      html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .media-expiry-warn { color: #d97706 !important; }
      html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .media-expiry-ok { color: #666666 !important; }

      /* Voice note text overrides inside message bubbles in light mode — see
         the :not(.on-wallpaper) comment just above. */
      html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .rcp-vn-time,
      html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .rcp-vn-time * {
        color: rgba(0,0,0,0.6) !important;
        -webkit-text-fill-color: rgba(0,0,0,0.6) !important;
      }
      html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .rcp-vn-expiry,
      html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .rcp-vn-expiry * {
        color: rgba(0,0,0,0.6) !important;
        -webkit-text-fill-color: rgba(0,0,0,0.6) !important;
      }

      /* Restore colors for action icons inside dropdowns with better contrast */
      html[data-theme='light'] .nav-dropdown [style*="color: var(--brand-1)"],
      html[data-theme='light'] .nav-dropdown [style*="color:var(--brand-1)"] { color: var(--brand-1-dark) !important; stroke: var(--brand-1-dark) !important; }
      html[data-theme='light'] .nav-dropdown [style*="color: #10b981"],
      html[data-theme='light'] .nav-dropdown [style*="color:#10b981"] { color: #059669 !important; stroke: #059669 !important; }
      html[data-theme='light'] .nav-dropdown [style*="color: #f59e0b"],
      html[data-theme='light'] .nav-dropdown [style*="color:#f59e0b"] { color: #d97706 !important; stroke: #d97706 !important; }
      
      /* Destructive actions red hover */
      html[data-theme='light'] .nav-dropdown .menu-btn-destructive:hover {
        background: rgba(239, 68, 68, 0.08) !important;
        color: #ef4444 !important;
      }
      html[data-theme='light'] .nav-dropdown .menu-btn-destructive:hover *,
      html[data-theme='light'] .nav-dropdown .menu-btn-destructive:hover svg {
        color: #ef4444 !important;
        stroke: #ef4444 !important;
      }

      /* Generic hover highlight for plain menu-row buttons (Settings, Log
         Out, etc.) inside a dropdown — excludes .notif-action-btn (Allow/
         Follower/Following/Follow Back in the notifications dropdown),
         whose background/color is meaningful state, not decoration. This
         rule's background:rgba(0,0,0,0.06) was completely replacing those
         buttons' own gradient/tinted backgrounds on hover (background is a
         shorthand — it wipes the previous background-image too), which is
         why hovering Follow Back visibly washed it out to near-white. */
      html[data-theme='light'] .nav-dropdown button:not(.notif-action-btn):hover {
        background: rgba(0,0,0,0.06) !important;
      }

      html[data-theme='light'] .chat-list-header:not(.gcw-force-dark .chat-list-header) {
        background: #ffffff !important;
        border-bottom: 1px solid rgba(0,0,0,0.08) !important;
      }
      html[data-theme='light'] .chat-list-header *:not(.gcw-force-dark *):not(.chat-avatar-initial),
      html[data-theme='light'] .chat-header-title:not(.gcw-force-dark .chat-header-title) {
        color: #111111 !important;
      }
      html[data-theme='light'] .chat-list-header .chat-avatar-initial,
      html[data-theme='light'] .chat-avatar-initial { color: #ffffff !important; }
      html[data-theme='light'] .chat-list-header input:not(.gcw-force-dark input) {
        background: rgba(0,0,0,0.05) !important;
        border: 1px solid rgba(0,0,0,0.12) !important;
        color: #111111 !important;
      }
      html[data-theme='light'] .chat-list-header input::placeholder:not(.gcw-force-dark input::placeholder) {
        color: #888 !important;
      }

      /* Tags and Previews */
      html[data-theme='light'] .chat-tag:not(.gcw-force-dark .chat-tag) {
        font-weight: 800 !important;
      }
      /* Darken the tag text for room/private */
      html[data-theme='light'] .chat-tag[style*="var(--brand-1-light)"]:not(.gcw-force-dark .chat-tag),
      html[data-theme='light'] .chat-tag[style*="var(--brand-1-rgb)"]:not(.gcw-force-dark .chat-tag) {
        color: var(--brand-1-darker) !important;
        background: rgba(var(--brand-1-rgb), 0.12) !important;
      }
      html[data-theme='light'] .chat-tag[style*="rgb(74, 222, 128)"]:not(.gcw-force-dark .chat-tag),
      html[data-theme='light'] .chat-tag[style*="#4ade80"]:not(.gcw-force-dark .chat-tag),
      html[data-theme='light'] .chat-tag[style*="rgba(34, 197, 94"]:not(.gcw-force-dark .chat-tag) { 
        color: #047857 !important; 
        background: rgba(4, 120, 87, 0.12) !important; 
      }

      html[data-theme='light'] .chat-preview:not(.gcw-force-dark .chat-preview),
      html[data-theme='light'] .chat-preview *:not(.gcw-force-dark .chat-preview *) {
        color: #444444 !important;
      }

      /* Force all unread/count badges to be red/white */
      html[data-theme='light'] .unread-badge {
        background: #ef4444 !important;
        color: #ffffff !important;
      }

      /* Vault Header Icons & Text (Direct children only to avoid leaking into dropdown) */
      html[data-theme='light'] .vault-header {
        background: rgba(239, 68, 68, 0.12) !important;
        border-bottom: 1px solid rgba(239, 68, 68, 0.2) !important;
      }
      html[data-theme='light'] .vault-header > button,
      html[data-theme='light'] .vault-header > span,
      html[data-theme='light'] .vault-header > svg {
        color: #b91c1c !important; /* Darker red for text/icons */
        stroke: #b91c1c !important;
      }

      /* Vault Select Dropdown */
      html[data-theme='light'] .vault-select {
        background: #ffffff !important;
        border: 1px solid rgba(0,0,0,0.12) !important;
        color: #111111 !important;
      }

      /* Status icons (Mute, Pin, Lock) - Dark but NOT FILLED */
      html[data-theme='light'] .chat-status-icon:not(.gcw-force-dark .chat-status-icon) {
        color: #1a1a1a !important;
        stroke: #1a1a1a !important;
        fill: none !important;
      }

      /* ── Purple/violet gradient buttons stay as-is (they look great in both modes) ──
         Matches the literal var(--brand-...) text CSS custom-property references
         serialize to in the DOM's style attribute (browsers preserve the reference,
         they don't resolve it before serializing) — so this keeps matching correctly
         regardless of which accent theme is active. */
      html[data-theme='light'] [style*="background: linear-gradient(135deg, var(--brand-1)"],
      html[data-theme='light'] [style*="background:linear-gradient(135deg, var(--brand-1)"],
      html[data-theme='light'] [style*="background: var(--brand-gradient)"],
      html[data-theme='light'] [style*="background:var(--brand-gradient)"] {
        color: #ffffff !important;
        box-shadow: none !important;
      }
      html[data-theme='light'] [style*="background: linear-gradient(135deg, var(--brand-1)"] *,
      html[data-theme='light'] [style*="background:linear-gradient(135deg, var(--brand-1)"] *,
      html[data-theme='light'] [style*="background: var(--brand-gradient)"] *,
      html[data-theme='light'] [style*="background:var(--brand-gradient)"] * {
        color: #ffffff !important;
      }

      /* ── Menu hover effects (Removing !important to allow dynamic JS colors) ── */
      html[data-theme='light'] .menu-btn:hover { background: rgba(0,0,0,0.05); }
      html[data-theme='light'] .chat-menu-item:hover:not(.gcw-force-dark .chat-menu-item:hover) { background: rgba(0,0,0,0.05); }
      html[data-theme='light'] .settings-menu-btn:hover { background: rgba(0,0,0,0.04) !important; }
      html[data-theme='light'] .settings-menu-btn-danger:hover { background: rgba(220,38,38,0.1) !important; }

      /* ── Home page specifics ── */
      html[data-theme='light'] .hero-title { color: #000 !important; }
      html[data-theme='light'] .hero-desc { color: #1a202c !important; font-weight: 500; }
      html[data-theme='light'] section h2 { color: #000 !important; }
      html[data-theme='light'] section h3 { color: #111 !important; }
      html[data-theme='light'] section p { color: #4a5568 !important; }
      html[data-theme='light'] .hiw-section h2 { color: #111 !important; }
      html[data-theme='light'] .hiw-section p { color: #4a5568 !important; }
      html[data-theme='light'] .hiw-step-card h3 { color: #111 !important; }
      html[data-theme='light'] .hiw-step-card p { color: #4a5568 !important; }
      /* ── Dark-always sections inside hiw-section (e.g. Safety page CTA) ── */
      html[data-theme='light'] .gcw-force-dark.hiw-section h2,
      html[data-theme='light'] .gcw-force-dark.hiw-section h2 * { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
      html[data-theme='light'] .gcw-force-dark.hiw-section p,
      html[data-theme='light'] .gcw-force-dark.hiw-section p * { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }

      /* ── CrazyGames Lobby: always dark-themed, force white text in light mode ── */
      html[data-theme='light'] .gcw-force-dark button[style*="color: #fff"],
      html[data-theme='light'] .gcw-force-dark button[style*="color:#fff"],
      html[data-theme='light'] .gcw-force-dark button[style*="color: #ffffff"],
      html[data-theme='light'] .gcw-force-dark [style*="color: #fff"],
      html[data-theme='light'] .gcw-force-dark [style*="color:#fff"],
      html[data-theme='light'] .gcw-force-dark [style*="color: #ffffff"] {
        color: #ffffff !important;
        -webkit-text-fill-color: #ffffff !important;
      }
      html[data-theme='light'] .crazygames-lobby button[style*="color: #888"],
      html[data-theme='light'] .crazygames-lobby button[style*="color:#888"],
      html[data-theme='light'] .crazygames-lobby [style*="color: #888"],
      html[data-theme='light'] .crazygames-lobby [style*="color:#888"],
      html[data-theme='light'] .crazygames-lobby [style*="color: var(--brand-1-light)"] {
        color: inherit !important;
      }

      /* ── Global Navigation and Components ── */
      html[data-theme='light'] nav { background: rgba(255,255,255,0.95) !important; backdrop-filter: blur(20px) !important; border-bottom: 1px solid rgba(0,0,0,0.08) !important; }
      html[data-theme='light'] nav h1 { color: #111 !important; -webkit-text-fill-color: #111 !important; }
      
      html[data-theme='light'] .nav-link-btn { color: #555 !important; font-size: 13px; font-weight: 600; background: none; border: none; cursor: pointer; transition: all 0.2s; }
      html[data-theme='light'] .nav-link-btn:hover { color: #111 !important; background: rgba(0,0,0,0.04) !important; border-radius: 8px; }
      html[data-theme='light'] .nav-link-btn.active {
        background: rgba(var(--brand-1-rgb),0.08) !important;
        color: var(--brand-1-dark) !important;
        border-radius: 8px;
        box-shadow: 0 0 0 1px rgba(var(--brand-1-rgb),0.1);
      }

      /* Navigation Icons refined */
      html[data-theme='light'] .nav-icon-btn { 
        color: #555 !important; 
        background: rgba(0,0,0,0.04) !important; 
        border: none !important; 
        padding: 8px; 
        border-radius: 50%; 
        cursor: pointer; 
        transition: all 0.2s; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
      }
      html[data-theme='light'] .nav-icon-btn:hover { 
        color: #000 !important; 
        background: rgba(0,0,0,0.08) !important; 
      }
      html[data-theme='light'] .nav-icon-btn.active {
        color: var(--brand-2-dark) !important;
        background: rgba(var(--brand-2-rgb), 0.08) !important;
        box-shadow: 0 0 0 1px rgba(var(--brand-2-rgb), 0.15) !important;
        border-radius: 12px !important;
      }
      
      /* Dropdown and Popovers */
      html[data-theme='light'] .nav-dropdown {
        background: #ffffff !important;
        border: 1px solid rgba(0,0,0,0.12) !important;
        box-shadow: 0 10px 40px rgba(0,0,0,0.12) !important;
      }

      html[data-theme='light'] .profile-pill { background: rgba(0,0,0,0.04) !important; border: 1px solid rgba(0,0,0,0.08) !important; color: #111 !important; }
      
      html[data-theme='light'] .pinned-card { background: #ffffff !important; border: 1px solid rgba(0,0,0,0.08) !important; box-shadow: 0 4px 20px rgba(0,0,0,0.06) !important; color: #111 !important; }
      html[data-theme='light'] .pinned-card:hover { border-color: rgba(var(--brand-1-rgb),0.3) !important; }
      html[data-theme='light'] .unpin-btn { background: rgba(0,0,0,0.05) !important; color: #555 !important; border: none !important; }
      html[data-theme='light'] .unpin-btn:hover { background: rgba(239,68,68,0.1) !important; color: #ef4444 !important; }
      
      /* Back Button Refinement */
      html[data-theme='light'] .back-btn {
        background: #ffffff !important;
        border: 1px solid rgba(0,0,0,0.1) !important;
        color: #111111 !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.04) !important;
      }
      html[data-theme='light'] .back-btn:hover {
        background: #f8f9fa !important;
        border-color: rgba(0,0,0,0.15) !important;
        color: #000000 !important;
      }
      html[data-theme='light'] .back-btn svg {
        color: #111111 !important;
        stroke: #111111 !important;
      }
      
      /* Footer violet hover */
      html[data-theme='light'] .footer-link-btn:hover { color: var(--brand-1) !important; }
      /* footer-social-btn hover: brand bg + white icon come from React inline styles; don't override them here */
      html[data-theme='light'] .footer-social-btn:hover { transform: translateY(-2px); }
      
      /* Pinned room corrections */
      html[data-theme='light'] .pinned-name { color: #111 !important; }
      html[data-theme='light'] .pinned-id { color: #718096 !important; }
      html[data-theme='light'] .pinned-tag { background: #edf2f7 !important; color: #4a5568 !important; border-color: #cbd5e0 !important; }

      /* ── Guest login buttons – keep white text in light mode ── */
      html[data-theme='light'] .guest-submit-btn,
      html[data-theme='light'] .guest-submit-btn *,
      html[data-theme='light'] .guest-outline-btn,
      html[data-theme='light'] .guest-outline-btn * {
        color: #ffffff !important;
      }

      /* ── Media Selector Modal Close Button ── */
      html[data-theme='light'] .media-selector-close-btn {
        background: #f1f5f9 !important;
        color: #000000 !important;
      }
      html[data-theme='light'] .media-selector-close-btn-svg {
        color: #000000 !important;
        stroke: #000000 !important;
      }
      html[data-theme='light'] .media-selector-close-btn:hover {
        background: #ef4444 !important;
        color: #ffffff !important;
      }
      html[data-theme='light'] .media-selector-close-btn:hover .media-selector-close-btn-svg {
        color: #ffffff !important;
        stroke: #ffffff !important;
      }
    `;

    const applyTheme = () => {
      const savedTheme = localStorage.getItem('watch_theme') || 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);
      syncStatusBarTheme(savedTheme);
      setNativeThemePreference(savedTheme);

      // A plain mobile browser tab (never an installed PWA/TWA, never the
      // native app) paints Chrome's own address-bar/toolbar strip using the
      // static <meta name="theme-color"> in index.html — a fixed brand
      // purple regardless of light/dark theme. Against this app's near-black
      // dark background, the boundary between that purple strip and the
      // page's own content reads as a stray bar/line right below the address
      // bar. Installed PWA/TWA and the native app don't have this address
      // bar at all (native has its own separate real status-bar coloring via
      // syncStatusBarTheme above), so only update the meta tag here —
      // leaving their appearance exactly as it's always been, per explicit
      // instruction not to touch those.
      if (!isStandalonePWA()) {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', savedTheme === 'light' ? '#f7fafc' : '#0b0c10');
      }

      // Remove existing injected style
      const existing = document.getElementById(LIGHT_STYLE_ID);
      if (existing) existing.remove();

      if (savedTheme === 'light') {
        const styleEl = document.createElement('style');
        styleEl.id = LIGHT_STYLE_ID;
        styleEl.textContent = LIGHT_CSS;
        document.head.appendChild(styleEl);
      }
    };

    applyTheme();
    window.addEventListener('theme_changed', applyTheme);
    return () => window.removeEventListener('theme_changed', applyTheme);
  }, [i18n]);

  // Accent color theme — independent axis from light/dark above. Sets CSS
  // custom properties directly on documentElement, which always win over the
  // :root defaults in index.css, so this runs unconditionally on every load
  // (no special-casing "Default" — it's just the first entry in APP_THEMES).
  useEffect(() => {
    const applyAccentTheme = () => {
      const savedId = localStorage.getItem('watch_accent_theme') || 'default';
      const theme = APP_THEMES.find(t => t.id === savedId) || APP_THEMES[0];
      const root = document.documentElement.style;
      root.setProperty('--brand-1', theme.accent1);
      root.setProperty('--brand-2', theme.accent2);
      root.setProperty('--brand-1-rgb', theme.accent1Rgb);
      root.setProperty('--brand-2-rgb', theme.accent2Rgb);
      root.setProperty('--brand-1-light', theme.accent1Light);
      root.setProperty('--brand-2-light', theme.accent2Light);
      root.setProperty('--brand-1-dark', theme.accent1Dark);
      root.setProperty('--brand-2-dark', theme.accent2Dark);
      root.setProperty('--brand-1-darker', theme.accent1Darker);
      root.setProperty('--brand-2-darker', theme.accent2Darker);
      // theme.previewCss is already the theme's own gradient string (2 or 3
      // stops), so tritone themes show all 3 colors wherever CSS reads
      // var(--brand-gradient) instead of collapsing to just brand-1/brand-2.
      root.setProperty('--brand-gradient', theme.previewCss);
      root.setProperty('--brand-1-deep', theme.ctaBg1);
      root.setProperty('--brand-2-deep', theme.ctaBg2);

      // Flowing body-background tint (index.css's animated gradientPan) —
      // has separate dark/light values per theme, so pick based on the
      // current light/dark axis (independent of this accent axis).
      const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
      root.setProperty('--bg-gradient-1', isLightMode ? theme.bgGradient1Light : theme.bgGradient1);
      root.setProperty('--bg-gradient-2', isLightMode ? theme.bgGradient2Light : theme.bgGradient2);
    };

    applyAccentTheme();
    window.addEventListener('accent_theme_changed', applyAccentTheme);
    // Light/dark toggling needs the accent theme's bg-gradient re-applied,
    // since the dark/light tint values differ.
    window.addEventListener('theme_changed', applyAccentTheme);
    return () => {
      window.removeEventListener('accent_theme_changed', applyAccentTheme);
      window.removeEventListener('theme_changed', applyAccentTheme);
    };
  }, []);

  // ── Desktop (Tauri) chrome: hide scrollbars everywhere (scrolling itself is
  // untouched — only the OS scrollbar indicator is hidden) so the app reads as
  // a native window rather than a webpage. The extra [data-theme='light']-
  // qualified selector exists purely to out-specificity the light-mode
  // scrollbar reset above (`*:not(.admin-wrapper)... { scrollbar-width: auto }`)
  // — without it, that rule would win in light mode and bring scrollbars back.
  useEffect(() => {
    if (!isTauriApp()) return;
    document.documentElement.setAttribute('data-desktop-app', 'true');
    const styleEl = document.createElement('style');
    styleEl.id = 'desktop-app-overrides';
    styleEl.textContent = `
      html[data-desktop-app='true'] {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      html[data-theme='light'][data-desktop-app='true'] *:not(.admin-wrapper):not(.admin-wrapper *) {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      html[data-theme='light'][data-desktop-app='true'] ::-webkit-scrollbar,
      html[data-desktop-app='true']:not([data-theme='light']) ::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
    `;
    document.head.appendChild(styleEl);
  }, []);


  // Load Google Client ID from environment variables (.env file)
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_HERE';

  return (
    <ErrorBoundary>
    <HelmetProvider>
    <CryptoProvider>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <Router>
          <AnimatedSplash />
          <KeyRecoveryModal />
          {/* Fixed opaque strip covering the status bar area (time/wifi/battery),
              above every page, modal, and overlay in the app (z-index beats even
              ChatLockScreen's 10000000). Height collapses to 0 on web/PWA, where
              --sp-status-bar-inset is never set. Without this, any page/scroll
              state that doesn't happen to reserve its own top padding lets content
              scroll right up under the status bar icons — this guarantees it never
              can, the same way Instagram's own top bar always stays solid. */}
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: 'var(--sp-status-bar-inset, 0px)',
              background: 'var(--bg-color)',
              zIndex: 2147483000,
              pointerEvents: 'none',
            }}
          />
          {/* Non-disruptive — never auto-reloads on its own (that could land
              mid-call or mid-typed-message, exactly the class of bug this
              session spent a lot of time fixing for calls). Just offers a
              refresh; the user decides when it's safe. */}
          {updateAvailable && (
            <div
              // No gcw-force-dark here on purpose — this toast's background
              // is a plain inline color (no stay-white on the text/container
              // either), so it now goes through the same light-mode
              // position:fixed override every other floating panel in this
              // file gets (further down this file), flipping to the app's
              // usual #f7f8fc card color in light mode instead of staying
              // black. Text inherits --text-primary (near-white in dark,
              // near-black in light) instead of being forced white. Layout
              // is one row on desktop/tablet, and text+close on top with
              // Refresh below on phones — see .update-toast* in index.css.
              className="update-toast"
              style={{
                position: 'fixed',
                left: '50%',
                transform: 'translateX(-50%)',
                bottom: 'max(16px, env(safe-area-inset-bottom))',
                zIndex: 2147483001,
                // width (not maxWidth) with a fixed 360px cap forced a two-row
                // wrap even on a spacious desktop window where the text +
                // Refresh + X would happily fit on one line — width:max-content
                // lets it size to its actual content, only clamping once
                // maxWidth is genuinely too narrow to fit on one row (phones
                // get their own explicit column layout instead, see CSS).
                width: 'max-content',
                maxWidth: 'calc(100vw - 32px)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 16,
                background: '#18181f',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <div className="update-toast-text-row">
                <span className="update-toast-text" style={{ flex: '1 1 auto', minWidth: 0 }}>A new version of SahaPlay is available</span>
                <button
                  onClick={() => setUpdateAvailable(false)}
                  aria-label="Dismiss"
                  className="update-toast-close"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4, flexShrink: 0,
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="update-toast-refresh stay-white"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--brand-1, #a855f7)', border: 'none',
                  borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                <RefreshCw size={14} className="stay-white" /> Refresh
              </button>
            </div>
          )}
          <ScrollToTop />
          <CallProvider>
          <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/tv" element={<TvPairing />} />
            <Route path="/features" element={<Features />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/report-bug" element={<ReportBug />} />
            <Route path="/safety" element={<Safety />} />
            <Route path="/cookies" element={<Cookies />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/legal/law-enforcement" element={<LawEnforcement />} />
            <Route path="/" element={<RootRoute />} />
            <Route path="/public" element={<ProtectedRoute><PublicRooms /></ProtectedRoute>} />
            <Route path="/pinned-rooms" element={<ProtectedRoute><PinnedRooms /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/profile/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/app-settings" element={<ProtectedRoute><AppSettings /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><AppSettings /></ProtectedRoute>} />
            <Route path="/room/:roomId" element={<ProtectedRoute><Room /></ProtectedRoute>} />
            <Route path="/admin/accept-invite" element={<AcceptInvitePage />} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          </Routes>
          </Suspense>
          <BottomNav />
          </CallProvider>
        </Router>
      </GoogleOAuthProvider>
    </CryptoProvider>
    </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;





