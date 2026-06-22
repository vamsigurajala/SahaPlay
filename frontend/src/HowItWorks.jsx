import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  PlusCircle, Share2, Play, Home, Link, Crown, ExternalLink,
  User, Zap, MessageCircle, Lock, EyeOff, Trash2, ChevronDown,
  ChevronUp, ArrowRight, Check, Shield,
  BookOpen, Clock, ClipboardList, HelpCircle, Users,
  Smartphone, List, Mic, Monitor, PhoneOff, Camera
} from 'lucide-react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CreateRoomModal from './components/CreateRoomModal';

const HowItWorks = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Auth state
  const token = localStorage.getItem('watch_token');
  const loggedInUsername = localStorage.getItem('watch_username');
  const isLoggedIn = !!token;

  const [showCreateModal, setShowCreateModal] = useState(false);

  // Theme reactive state — matches Features.jsx pattern exactly
  const [theme, setTheme] = useState(localStorage.getItem('watch_theme') || 'dark');
  useEffect(() => {
    const handleThemeChange = () => setTheme(localStorage.getItem('watch_theme') || 'dark');
    window.addEventListener('theme_changed', handleThemeChange);
    return () => window.removeEventListener('theme_changed', handleThemeChange);
  }, []);
  const isLight = theme === 'light';

  const [showBackToTop, setShowBackToTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Section 5 tab state
  const [activeTab, setActiveTab] = useState('youtube');

  // Section 8 FAQ accordion state
  const [openFaq, setOpenFaq] = useState(null);

  // ── Scroll progress indicator ──
  const [activeSection, setActiveSection] = useState('steps');
  const sectionRefs = useRef({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: '-25% 0px -65% 0px' }
    );
    const refs = sectionRefs.current;
    Object.values(refs).forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const scrollNavItems = [
    { id: 'steps', label: t('theSteps', 'The Steps'), Icon: ClipboardList },
    { id: 'host', label: t('asAHost', 'As a Host'), Icon: Crown },
    { id: 'join', label: t('joining', 'Joining'), Icon: Users },
    { id: 'chat', label: t('chat', 'Chat'), Icon: MessageCircle },
    { id: 'faq', label: t('faq', 'FAQ'), Icon: HelpCircle },
  ];

  const smoothScrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Create room handler
  const createRoom = () => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    setShowCreateModal(true);
  };

  // ── Reusable card style (defined inside component so isLight is in scope) ──
  const cardStyle = {
    background: isLight ? '#ffffff' : '#1e1e30',
    border: `1px solid ${isLight ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 16,
    padding: 32,
    boxShadow: isLight ? '0 4px 24px rgba(99,102,241,0.12)' : 'none',
  };

  // ── Section 3 host steps — explicit white on icons ──
  const hostSteps = [
    { icon: <Home size={18} color="#ffffff" />, title: t('createYourRoomStep', 'Create Your Room'), body: t('createYourRoomStepDesc', 'Click Create Room from the home page. Your room is ready instantly with a unique link — no waiting, no setup.') },
    { icon: <Link size={18} color="#ffffff" />, title: t('addYourVideoStep', 'Add Your Video'), body: t('addYourVideoStepDesc', 'Paste a YouTube, Twitch, or Vimeo link into the video bar. Or choose a local file from your computer. Or screenshare for Netflix and Prime Video.') },
    { icon: <Share2 size={18} color="#ffffff" />, title: t('inviteFriendsStep', 'Invite Friends'), body: t('inviteFriendsStepDesc', 'Share your room link. Use the built-in buttons for WhatsApp, Telegram, X, or Gmail. Friends join with one click — no account needed.') },
    { icon: <Crown size={18} color="#ffffff" />, title: t('controlRoomStep', 'Control the Room'), body: t('controlRoomStepDesc', 'Hit play — everyone follows. Pause, seek, swap videos anytime. Mute or remove guests from the host panel if needed.') },
  ];

  // ── Section 4 guest steps — explicit white on icons ──
  const guestSteps = [
    { icon: <ExternalLink size={18} color="#ffffff" />, title: t('clickInviteLinkStep', 'Click the Invite Link'), body: t('clickInviteLinkStepDesc', 'Your friend shares a link. Click it — it opens directly in your browser. No app download, no plugins, no signup required.') },
    { icon: <User size={18} color="#ffffff" />, title: t('enterYourNameStep', 'Enter Your Name'), body: t('enterYourNameStepDesc', 'Pick a display name or sign in to your account for full features. Guests get a random name automatically if you skip this.') },
    { icon: <Zap size={18} color="#ffffff" />, title: t('youreInStep', "You're In — Instantly Synced"), body: t('youreInStepDesc', 'The video jumps to exactly where everyone else is watching. Joined 10 minutes late? No problem — you\'re caught up instantly.') },
    { icon: <MessageCircle size={18} color="#ffffff" />, title: t('chatReactStep', 'Chat and React'), body: t('chatReactStepDesc', 'Group chat is open for everyone. Send private messages to any person in the room. React with emojis to moments.') },
  ];

  // ── Section 5 platform tabs ──
  const platforms = [
    { id: 'youtube', label: '▶ ' + t('youtube', 'YouTube') },
    { id: 'twitch', label: '🟣 ' + t('twitch', 'Twitch') },
    { id: 'netflix', label: '🎬 ' + t('netflixPrime', 'Netflix / Prime') },
    { id: 'local', label: '📁 ' + t('localFiles', 'Local Files') },
  ];

  // tabContent is inside the component so it can use isLight
  const tabContent = {
    youtube: {
      steps: [
        t('ytStep1', 'Find any YouTube video you want to watch'),
        t('ytStep2', 'Copy the URL from your browser address bar'),
        t('ytStep3', 'Paste it into the video bar in your room'),
        t('ytStep4', 'Hit Enter — everyone sees it sync instantly'),
      ],
      note: { type: 'green', text: t('noYtPremiumNeeded', '✓ No YouTube Premium needed') },
      visual: (
        <div style={{ ...cardStyle, fontFamily: 'monospace' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>{t('browserUrlBar', '🌐 Browser URL Bar')}</div>
          <div style={{ background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 16, color: '#ef4444' }}>
            https://youtube.com/watch?v=dQw4w9WgXcQ
          </div>
          <div style={{ textAlign: 'center', color: '#6366f1', marginBottom: 16, fontSize: 20 }}>↓</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>{t('roomVideoBar', '📺 Room Video Bar')}</div>
          <div style={{ background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>
            https://youtube.com/watch?v=dQw4w9WgXcQ
          </div>
          <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>{t('nowPlayingWatchers', '● Now playing for 4 watchers')}</div>
        </div>
      ),
    },
    twitch: {
      steps: [
        t('twitchStep1', 'Go to any Twitch channel or live stream'),
        t('twitchStep2', 'Copy the channel URL from your browser'),
        t('twitchStep3', 'Paste into your room video bar'),
        t('twitchStep4', 'Live stream syncs for everyone in real time'),
      ],
      note: { type: 'green', text: t('worksWithTwitchLiveVod', '✓ Works with live streams and VODs') },
      visual: (
        <div style={{ ...cardStyle }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>{t('browserUrlBar', '🌐 Browser URL Bar')}</div>
          <div style={{ background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 16, color: '#9146ff' }}>
            https://twitch.tv/shroud
          </div>
          <div style={{ textAlign: 'center', color: '#6366f1', marginBottom: 16, fontSize: 20 }}>↓</div>
          <div style={{ background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="stay-white" style={{ background: '#ef4444', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{t('liveBadge', '● LIVE')}</span>
            twitch.tv/shroud
          </div>
          <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>{t('streamingLiveWatchers', '● Streaming live for 6 watchers')}</div>
        </div>
      ),
    },
    netflix: {
      steps: [
        t('netflixStep1', 'Open Netflix or Prime Video in another browser tab'),
        t('netflixStep2', 'Start playing the show or movie you want to watch'),
        t('netflixStep3', 'In your SahaPlay room click "Screenshare"'),
        t('netflixStep4', 'Select the Netflix tab from the picker'),
        t('netflixStep5', 'Friends see your screen synced in real time'),
      ],
      note: { type: 'amber', text: t('screenshareDrmNote', '⚠ Screenshare works for any platform including DRM-protected services. Audio sharing requires Chrome browser.') },
      visual: (
        <div style={{ ...cardStyle }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>{t('chooseWhatToShare', '🖥 Choose what to share')}</div>
          {[t('netflixStrangerThings', 'Netflix — Stranger Things'), t('primeTheBoys', 'Prime Video — The Boys'), t('disneyLoki', 'Disney+ — Loki')].map((tab, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 8, background: i === 0 ? 'rgba(99,102,241,0.15)' : (isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)'), border: `1px solid ${i === 0 ? 'rgba(99,102,241,0.4)' : (isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)')}`, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              {i === 0 && <Check size={14} color="#6366f1" />}
              {tab}
            </div>
          ))}
          <div className="stay-white" style={{ marginTop: 16, background: '#6366f1', color: '#fff', textAlign: 'center', padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
            {t('shareTabBtn', 'Share Tab')}
          </div>
        </div>
      ),
    },
    local: {
      steps: [
        t('localStep1', 'In your room click the "Local File" option'),
        t('localStep2', 'Select any video file from your computer (.mp4, .mkv, .avi, .mov supported)'),
        t('localStep3', 'File streams directly — no upload needed'),
        t('localStep4', 'Everyone in the room watches from your file'),
      ],
      note: { type: 'green', text: t('noFileSizeLimits', '✓ No file size limits') },
      visual: (
        <div style={{ ...cardStyle }}>
          <div style={{ border: '2px dashed rgba(99,102,241,0.3)', borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{t('mockFileNameLocal', 'movie_night.mp4')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('mockFileSizeLocal', '2.1 GB — Ready to stream')}</div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{t('preparingVideoStatus', 'Preparing video...')}</span>
              <span style={{ fontWeight: 700 }}>70%</span>
            </div>
            <div style={{ height: 6, background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
              <div style={{ width: '70%', height: '100%', background: 'linear-gradient(to right, #6366f1, #a855f7)', borderRadius: 3 }} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>{t('streamingViewers', '● Streaming to 3 viewers')}</div>
        </div>
      ),
    },
  };

  // ── Section 7 privacy cards ──
  const privacyCards = [
    { icon: <Lock size={24} />, title: t('privacyCardTitle1', 'End-to-End Encrypted'), body: t('privacyCardBody1', 'All private messages are encrypted on your device before sending. We store only the encrypted version — we cannot read them.') },
    { icon: <EyeOff size={24} />, title: t('privacyCardTitle2', 'No Data Selling'), body: t('privacyCardBody2', 'We do not sell your data, show targeted ads, or share your information with third parties. Your activity stays private.') },
    { icon: <Trash2 size={24} />, title: t('privacyCardTitle3', 'Delete Anytime'), body: t('privacyCardBody3', 'Delete individual messages, clear entire chat history, or remove your account completely. Your data, your control.') },
  ];

  // ── Section 8 FAQ data ──
  const faqs = [
    { q: t('faqQ1', 'Do my friends need to create an account?'), a: t('faqA1', 'No. Anyone with your room link can join instantly as a guest — no signup, no email, no download required. Only creating a room needs an account.') },
    { q: t('faqQ2', 'Does everyone need to have the video file?'), a: t('faqA2', 'No. For YouTube, Twitch, and Vimeo everyone just needs the link. For local files only the host needs the file — it streams to everyone else. For Netflix, only the host needs a subscription.') },
    { q: t('faqQ3', 'What if I join the room late?'), a: t('faqA3', 'We automatically detect where the video is currently playing and jump you straight to that exact moment. You\'re always in sync with the rest of the room instantly.') },
    { q: t('faqQ4', 'How many people can be in one room?'), a: t('faqA4', 'Up to 50 people can watch together in a single room at the same time.') },
    { q: t('faqQ5', 'Is SahaPlay completely free?'), a: t('faqA5', 'Yes, completely free to use. Create rooms, invite friends, and watch together with no cost and no credit card required.') },
    { q: t('faqQ6', 'Which browsers does it work in?'), a: t('faqA6', 'SahaPlay works in Chrome, Firefox, Safari, and Edge. No plugins or extensions needed. For screenshare with audio we recommend Chrome for best results.') },
    { q: t('faqQ7', 'Can I watch Netflix or Prime Video together?'), a: t('faqA7', 'Yes — using the Screenshare feature. The host shares their Netflix or Prime tab and everyone in the room sees it in real time. You need a subscription to those services.') },
    { q: t('faqQ8', 'Are my private messages really private?'), a: t('faqA8', 'Yes. Private messages are end-to-end encrypted on your device before they\'re sent. This means only you and the recipient can read them — not us, not anyone else.') },
  ];

  return (
    <div className="page-enter" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}>
      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        loggedInUsername={loggedInUsername}
      />
      <Navbar />

      {/* Inline CSS for animations and step connectors */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hiw-animate {
          animation: fadeUp 0.5s ease forwards;
        }

        .step-connector {
          display: none;
        }
        /* Scroll progress bar — hidden on mobile */
        .hiw-scroll-nav {
          display: none;
        }
        @media (min-width: 769px) {
          .hiw-scroll-nav {
            display: flex;
          }
        }

        /* Hero Trust Badges Single-Line styling */
        .hero-trust-badges {
          display: flex;
          gap: 24px;
          justify-content: center;
          align-items: center;
          flex-wrap: wrap;
        }
        .trust-badge-item {
          font-size: 14px;
          color: var(--text-secondary);
          display: inline-flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
        }
        .trust-badge-item svg {
          width: 13px;
          height: 13px;
          flex-shrink: 0;
        }
        .trust-badge-separator {
          font-size: 14px;
          color: var(--text-secondary);
        }
        @media (max-width: 1024px) {
          .hero-trust-badges {
            gap: clamp(6px, 1.8vw, 16px) !important;
            flex-wrap: nowrap !important;
          }
          .trust-badge-item {
            font-size: clamp(9px, 1.8vw, 13px) !important;
            gap: 4px !important;
          }
          .trust-badge-item svg {
            width: clamp(9px, 1.8vw, 13px) !important;
            height: clamp(9px, 1.8vw, 13px) !important;
          }
          .trust-badge-separator {
            font-size: clamp(9px, 1.8vw, 13px) !important;
          }
        }
      `}</style>

      {/* ══════════════════════════════════════════
          SECTION 1 — HERO
      ══════════════════════════════════════════ */}
      <section
        className="hiw-section"
        style={{
          background: isLight ? '#ffffff' : '#0f0f18',
          minHeight: '85vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: '50px',
        }}
      >
        <div className="hiw-container" style={{ textAlign: 'center' }}>
          {/* Badge — tutorial identity */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
            color: '#818cf8', borderRadius: 99, padding: '6px 16px',
            fontSize: 13, fontWeight: 600, marginBottom: 28,
          }}>
            <BookOpen size={14} /> {t('stepByStepGuide', 'Step-by-step guide')}
          </div>

          {/* H1 */}
          <h1 style={{
            fontSize: 'clamp(40px, 6vw, 64px)', fontWeight: 900, lineHeight: 1.1,
            marginBottom: 24, background: 'none',
            WebkitTextFillColor: isLight ? '#111' : 'unset',
            color: isLight ? '#111' : '#f8f9fa',
          }}>
            {t('upAndRunningIn', 'Up and Running in')}{' '}
            <span style={{
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              {t('sixtySeconds', '60 Seconds')}
            </span>
          </h1>

          {/* Subtitle */}
          <p style={{
            maxWidth: 560, margin: '0 auto 16px',
            color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1.6,
          }}>
            {t('heroDescHowItWorks', 'Create a room, invite friends, and watch any video together in perfect sync — no installs, no plugins, no hassle.')}
          </p>

          {/* Reading time */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            color: 'var(--text-secondary)', fontSize: 13, marginBottom: 36, opacity: 0.75,
          }}>
            <Clock size={13} />
            <span>{t('heroReadingTime', '5 min read · No account needed to follow along')}</span>
          </div>

          {/* CTA — primary button + section pill links */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 40 }}>
            <button className="btn" onClick={createRoom}>
              {t('createANewRoom', 'Create a New Room →')}
            </button>

            {/* Section jump pills */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {scrollNavItems.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => smoothScrollTo(id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 99,
                    border: `1px solid ${isLight ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.4)'}`,
                    background: 'transparent',
                    color: isLight ? '#6366f1' : '#818cf8',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Trust stats */}
          <div className="hero-trust-badges">
            <span className="trust-badge-item"><Zap /> {t('instantSetup', 'Instant Setup')}</span>
            <span className="trust-badge-separator">|</span>
            <span className="trust-badge-item"><Lock /> {t('encryptedChats', 'Encrypted Chats')}</span>
            <span className="trust-badge-separator">|</span>
            <span className="trust-badge-item"><Smartphone /> {t('worksOnMobile', 'Works on Mobile')}</span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 2 — THREE SIMPLE STEPS
      ══════════════════════════════════════════ */}
      <section id="steps" ref={el => sectionRefs.current.steps = el} className="hiw-section" style={{ background: isLight ? '#eeeaff' : '#111120' }}>
        <div className="hiw-container">
          {/* Top label */}
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: isLight ? '#4338ca' : '#818cf8', textAlign: 'center', marginBottom: 16 }}>
            {t('howItWorksLabel', 'HOW IT WORKS')}
          </div>
          {/* Title */}
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, textAlign: 'center', marginBottom: 56, color: isLight ? '#111' : '#f8f9fa' }}>
            {t('threeStepsTitle', 'Three Steps to Watch Together')}
          </h2>

          {/* Steps with connectors */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'stretch', flexWrap: 'wrap', justifyContent: 'center' }}>
            {/* Step 1 — icon LEFT, number circle RIGHT */}
            <div
              className="hiw-animate"
              style={{ flex: '1 1 280px', maxWidth: 380, ...cardStyle, animationDelay: '0s', animationFillMode: 'both', borderBottom: '3px solid #6366f1' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <PlusCircle size={28} color="#6366f1" />
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                  <span className="stay-white" style={{ color: '#ffffff' }}>01</span>
                </div>
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>{t('createARoom', 'Create a Room')}</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 15, margin: 0 }}>{t('createARoomDesc', 'Click Create Room — your private watch party is ready in seconds. No account needed for guests to join.')}</p>
            </div>

            {/* Step 2 — icon LEFT, number circle RIGHT */}
            <div
              className="hiw-animate"
              style={{ flex: '1 1 280px', maxWidth: 380, ...cardStyle, animationDelay: '0.1s', animationFillMode: 'both', borderBottom: '3px solid #3b82f6' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <Share2 size={28} color="#6366f1" />
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                  <span className="stay-white" style={{ color: '#ffffff' }}>02</span>
                </div>
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>{t('inviteYourFriends', 'Invite Your Friends')}</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 15, margin: 0 }}>{t('inviteYourFriendsDesc', 'Share your unique room link via WhatsApp, Telegram, or just copy and paste it. Friends join instantly with one click.')}</p>
            </div>

            {/* Step 3 — icon LEFT, number circle RIGHT */}
            <div
              className="hiw-animate"
              style={{ flex: '1 1 280px', maxWidth: 380, ...cardStyle, animationDelay: '0.2s', animationFillMode: 'both', borderBottom: '3px solid #10b981' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <Play size={28} color="#6366f1" />
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                  <span className="stay-white" style={{ color: '#ffffff' }}>03</span>
                </div>
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>{t('hiwStep3WatchTogether', 'Watch Together')}</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 15, margin: 0 }}>{t('watchTogetherDesc', 'Paste any video link or share your screen. Everyone sees play, pause, and seek at the exact same moment.')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 3 — HOST WALKTHROUGH
      ══════════════════════════════════════════ */}
      <section id="host" ref={el => sectionRefs.current.host = el} className="hiw-section" style={{ background: isLight ? '#ffffff' : '#0f0f18' }}>
        <div className="hiw-container">
          <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Left: Steps */}
            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
              <h2 style={{ fontWeight: 800, fontSize: 'clamp(24px, 3vw, 36px)', marginBottom: 12, color: isLight ? '#111' : '#f8f9fa' }}>{t('ifCreatingRoom', "If You're Creating a Room")}</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 40, fontSize: 16 }}>{t('asHostControl', "As the host, you're in complete control.")}</p>

              <div style={{ position: 'relative' }}>
                {hostSteps.map((step, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 16, position: 'relative', marginBottom: 0 }}>
                    {/* Vertical line */}
                    {idx < hostSteps.length - 1 && (
                      <div style={{ position: 'absolute', left: 18, top: 44, bottom: -32, width: 2, background: 'rgba(99,102,241,0.25)', zIndex: 0 }} />
                    )}
                    {/* Icon circle */}
                    <div className="gcw-force-dark" style={{ width: 36, height: 36, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                      {step.icon}
                    </div>
                    <div style={{ paddingBottom: 32 }}>
                      <h4 style={{ fontWeight: 700, marginBottom: 6, fontSize: 16 }}>{step.title}</h4>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 15, margin: 0 }}>{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Room preview — streaming · chat · calls */}
            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
              <div style={{
                border: `1px solid ${isLight ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 20,
                overflow: 'hidden',
                boxShadow: isLight ? '0 20px 60px rgba(99,102,241,0.18)' : '0 20px 60px rgba(0,0,0,0.4)',
              }}>

                {/* ── Room header bar ── */}
                <div style={{ background: '#1e1b4b', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Crown size={13} color="#a855f7" />
                  <span className="stay-white" style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{t('popcornNightLobby', 'Popcorn Night Lobby')}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="stay-white" style={{ fontSize: 9, background: 'rgba(16,185,129,0.25)', color: '#4ade80', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>{t('liveBadgeDot', '● LIVE')}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{t('threeInRoom', '3 in room')}</span>
                  </div>
                </div>

                {/* ── Screenshare / Stream area ── */}
                <div style={{ position: 'relative', background: '#0a0a14', height: 148 }}>
                  {/* Scan-line texture */}
                  <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.01) 3px,rgba(255,255,255,0.01) 4px)', pointerEvents: 'none' }} />
                  {/* Centre icon + label */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 7 }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Monitor size={18} color="#818cf8" />
                    </div>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', letterSpacing: 0.5 }}>{t('screenshareInSync', 'Screenshare · In sync')}</span>
                  </div>
                  {/* Feature badges top-left */}
                  <div style={{ position: 'absolute', top: 8, left: 10, display: 'flex', gap: 4 }}>
                    <span className="stay-white" style={{ background: 'rgba(99,102,241,0.85)', color: '#fff', fontSize: 8, padding: '2px 7px', borderRadius: 3, fontWeight: 700 }}>{t('screenBadge', '📺 SCREEN')}</span>
                    <span className="stay-white" style={{ background: 'rgba(16,185,129,0.85)', color: '#fff', fontSize: 8, padding: '2px 7px', borderRadius: 3, fontWeight: 700 }}>{t('syncBadge', '🔊 SYNC')}</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'rgba(255,255,255,0.28)', padding: '0 10px 3px' }}>
                      <span>18:42</span><span>1:45:00</span>
                    </div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.08)' }}>
                      <div style={{ width: '18%', height: '100%', background: 'linear-gradient(to right,#6366f1,#a855f7)' }} />
                    </div>
                  </div>
                </div>

                {/* ── Control bar — mic · camera · screenshare · chat · leave ── */}
                <div style={{ background: '#13131f', padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t('microphoneTooltip', 'Microphone')}>
                    <Mic size={14} color="rgba(255,255,255,0.55)" />
                  </div>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t('cameraTooltip', 'Camera')}>
                    <Camera size={14} color="rgba(255,255,255,0.55)" />
                  </div>
                  {/* Screenshare — highlighted as active */}
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(99,102,241,0.22)', border: '1.5px solid rgba(99,102,241,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(99,102,241,0.3)' }} title={t('screenshareActiveTooltip', 'Screenshare (active)')}>
                    <Monitor size={15} color="#818cf8" />
                  </div>
                  {/* Chat with unread dot */}
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }} title={t('chatTooltip', 'Chat')}>
                    <MessageCircle size={14} color="rgba(255,255,255,0.55)" />
                    <div style={{ position: 'absolute', top: 5, right: 5, width: 7, height: 7, background: '#6366f1', borderRadius: '50%', border: '1.5px solid #13131f' }} />
                  </div>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t('leaveRoomTooltip', 'Leave room')}>
                    <PhoneOff size={14} color="#ef4444" />
                  </div>
                </div>

                {/* ── Watchers + Chat ── */}
                <div style={{ padding: '12px 14px', background: isLight ? '#faf9ff' : '#0f0f1a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    {['#6366f1', '#a855f7', '#10b981'].map((c, i) => (
                      <div key={i} style={{ width: 26, height: 26, borderRadius: '50%', background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                        <span className="stay-white" style={{ color: '#fff', fontWeight: 700 }}>{['H', 'A', 'S'][i]}</span>
                      </div>
                    ))}
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 2 }}>{t('threeWatching', '3 watching')}</span>
                    <div style={{ marginLeft: 'auto', fontSize: 10, background: 'rgba(16,185,129,0.12)', color: '#10b981', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>{t('inSyncBadgeDot', '● In sync')}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 11, background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', padding: '6px 10px', borderRadius: 8 }}>
                      <strong style={{ color: '#818cf8' }}>{t('alexName', 'Alex')}: </strong>{t('alexMockMessage', 'This is so smooth! 🎬')}
                    </div>
                    <div style={{ fontSize: 11, background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', padding: '6px 10px', borderRadius: 8 }}>
                      <strong style={{ color: '#a855f7' }}>{t('sarahName', 'Sarah')}: </strong>{t('sarahMockMessage', 'Best watch party ever! 🍿')}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 4 — GUEST WALKTHROUGH
      ══════════════════════════════════════════ */}
      <section id="join" ref={el => sectionRefs.current.join = el} className="hiw-section" style={{ background: isLight ? '#f3f4f6' : '#1a1a2e' }}>
        <div className="hiw-container">
          <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Left: Join room — mobile phone frame mockup */}
            <div style={{ flex: '1 1 300px', minWidth: 300 }}>
              {/* ── Phone outer shell ── */}
              <div style={{
                position: 'relative',
                background: 'linear-gradient(160deg, #1e1b30, #2d2a40)',
                borderRadius: 46,
                padding: '14px 10px',
                maxWidth: 336,
                margin: '0 auto',
                boxShadow: isLight
                  ? '0 28px 80px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.12), 0 0 0 1.5px #1a1730'
                  : '0 28px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1.5px #111',
              }}>
                {/* Volume buttons (left) */}
                <div style={{ position: 'absolute', left: -3, top: 88, width: 3, height: 26, background: '#151225', borderRadius: '3px 0 0 3px', boxShadow: '-1px 0 3px rgba(0,0,0,0.5)' }} />
                <div style={{ position: 'absolute', left: -3, top: 128, width: 3, height: 26, background: '#151225', borderRadius: '3px 0 0 3px', boxShadow: '-1px 0 3px rgba(0,0,0,0.5)' }} />
                {/* Power button (right) */}
                <div style={{ position: 'absolute', right: -3, top: 108, width: 3, height: 44, background: '#151225', borderRadius: '0 3px 3px 0', boxShadow: '1px 0 3px rgba(0,0,0,0.5)' }} />

                {/* Top bar — speaker pill + camera dot */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 10 }}>
                  <div style={{ width: 50, height: 4, background: 'rgba(255,255,255,0.18)', borderRadius: 2 }} />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.22)' }} />
                </div>

                {/* Screen */}
                <div style={{
                  border: '1px solid rgba(99,102,241,0.25)',
                  borderRadius: 30,
                  overflow: 'hidden',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                }}>
                  {/* Header */}
                  <div style={{ background: '#1e1b4b', padding: '14px 18px', textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#a855f7)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Play size={20} color="#fff" fill="#fff" />
                    </div>
                    <div className="stay-white" style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: '#fff' }}>{t('joinWatchRoom', 'Join Watch Room')}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{t('roomHashMock', 'Room #3g5jkv')}</div>
                  </div>

                  {/* Body */}
                  <div style={{ padding: 18, background: isLight ? '#faf9ff' : '#0f0f1a' }}>
                    {/* Name input */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>{t('yourDisplayName', 'Your Display Name')}</div>
                      <div style={{ background: isLight ? '#ffffff' : 'rgba(255,255,255,0.06)', border: `1px solid ${isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                        {t('alexMockName', 'Alex_🎬')}
                      </div>
                    </div>

                    {/* Join button */}
                    <div className="stay-white" style={{ background: '#6366f1', color: '#fff', textAlign: 'center', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 13, marginBottom: 16 }}>
                      {t('joinRoomBtn', 'Join Room →')}
                    </div>

                    {/* Status */}
                    <div style={{ textAlign: 'center', fontSize: 11, color: '#10b981', fontWeight: 600 }}>
                      {t('threePeopleWatchingBadge', '● 3 people watching')}
                    </div>

                    {/* Bottom line */}
                    <div style={{ marginTop: 16, borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`, paddingTop: 12, textAlign: 'center', fontSize: 10, color: 'var(--text-secondary)' }}>
                      {t('joiningRoomMockStatus', 'Joining room 3g5jkv...')}
                    </div>
                  </div>
                </div>

                {/* Home indicator bar */}
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
                  <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.28)', borderRadius: 2 }} />
                </div>
              </div>
            </div>

            {/* Right: Guest steps */}
            <div style={{ flex: '1 1 300px', minWidth: 300 }}>
              <h2 style={{ fontWeight: 800, fontSize: 'clamp(24px, 3vw, 36px)', marginBottom: 12, color: isLight ? '#111' : '#f8f9fa' }}>{t('ifJoiningRoom', "If You're Joining a Room")}</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 40, fontSize: 16 }}>{t('noAccountNeededDesc', 'No account needed. Just click and watch.')}</p>

              <div style={{ position: 'relative' }}>
                {guestSteps.map((step, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 16, position: 'relative', marginBottom: 0 }}>
                    {idx < guestSteps.length - 1 && (
                      <div style={{ position: 'absolute', left: 18, top: 44, bottom: -32, width: 2, background: 'rgba(99,102,241,0.25)', zIndex: 0 }} />
                    )}
                    <div className="gcw-force-dark" style={{ width: 36, height: 36, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                      {step.icon}
                    </div>
                    <div style={{ paddingBottom: 32 }}>
                      <h4 style={{ fontWeight: 700, marginBottom: 6, fontSize: 16 }}>{step.title}</h4>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 15, margin: 0 }}>{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 5 — PLATFORM TABS
      ══════════════════════════════════════════ */}
      <section className="hiw-section" style={{ background: isLight ? '#ffffff' : '#0f0f18' }}>
        <div className="hiw-container">
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: isLight ? '#4338ca' : '#818cf8', marginBottom: 16 }}>{t('supportedPlatformsLabel', 'SUPPORTED PLATFORMS')}</div>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 800, marginBottom: 0, color: isLight ? '#111' : '#f8f9fa' }}>{t('worksWithPlatformsTitle', 'Works with Your Favourite Platforms')}</h2>
          </div>

          {/* Tab pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 48, justifyContent: 'center' }}>
            {platforms.map((p) => (
              <button
                key={p.id}
                className="stay-white"
                onClick={() => setActiveTab(p.id)}
                style={{
                  padding: '10px 20px',
                  borderRadius: 99,
                  border: `1px solid ${activeTab === p.id ? '#6366f1' : (isLight ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.3)')}`,
                  background: activeTab === p.id ? '#6366f1' : (isLight ? 'rgba(49,46,129,0.88)' : 'rgba(99,102,241,0.16)'),
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Left: Numbered steps */}
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {tabContent[activeTab].steps.map((step, i) => (
                  <li key={i} style={{ display: 'flex', gap: 14, marginBottom: 20, alignItems: 'flex-start' }}>
                    <div className="gcw-force-dark" style={{ width: 28, height: 28, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                    <span style={{ fontSize: 15, lineHeight: 1.6, paddingTop: 4 }}>{step}</span>
                  </li>
                ))}
              </ol>

              {/* Note badge */}
              {tabContent[activeTab].note && (() => {
                const isGreen = tabContent[activeTab].note.type === 'green';
                /* amber note → warm gold palette that reads well in both modes */
                const noteColor = isGreen ? '#10b981' : (isLight ? '#92400e' : '#ca8a04');
                const noteBg = isGreen ? 'rgba(16,185,129,0.1)' : 'rgba(250,204,21,0.1)';
                const noteBorder = isGreen ? 'rgba(16,185,129,0.3)' : 'rgba(250,204,21,0.3)';
                return (
                  <div style={{
                    marginTop: 24, padding: '12px 16px', borderRadius: 10,
                    background: noteBg,
                    border: `1px solid ${noteBorder}`,
                    color: noteColor,
                    fontSize: 13, fontWeight: 600,
                  }}>
                    {tabContent[activeTab].note.text}
                  </div>
                );
              })()}
            </div>

            {/* Right: Visual mockup */}
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              {tabContent[activeTab].visual}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 6 — CHAT WALKTHROUGH
      ══════════════════════════════════════════ */}
      <section id="chat" ref={el => sectionRefs.current.chat = el} className="hiw-section" style={{ background: isLight ? '#f3f4f6' : '#1a1a2e', paddingTop: '110px' }}>
        <div className="hiw-container">
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: isLight ? '#4338ca' : '#818cf8', marginBottom: 16 }}>{t('communicationLabel', 'COMMUNICATION')}</div>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 800, marginBottom: 0, color: isLight ? '#111' : '#f8f9fa' }}>{t('chatWhileYouWatchTitle', 'Chat While You Watch')}</h2>
          </div>

          {/* Two cards */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 32 }}>
            {/* Left: Group Chat */}
            <div style={{ flex: '1 1 300px', ...cardStyle, borderTop: '3px solid #6366f1' }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><MessageCircle size={18} color="#6366f1" /> {t('groupChatTitle', 'Group Chat')}</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{t('groupChatSub', 'Everyone in the room')}</div>
              </div>

              {[
                t('groupChatF1', 'Send messages to everyone in the room'),
                t('groupChatF2', 'React to messages with emojis'),
                t('groupChatF3', 'Reply to specific messages'),
                t('groupChatF4', "See who's typing in real time"),
                t('groupChatF5', 'Unread message badge counter'),
                t('groupChatF6', 'End-to-end encrypted — fully secure')
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <Check size={16} color="#10b981" />
                  <span style={{ fontSize: 14 }}>{f}</span>
                </div>
              ))}

              {/* Mini chat mockup */}
              <div style={{ marginTop: 20, background: isLight ? '#f8f7ff' : 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>
                {[
                  { name: t('alexName', 'Alex'), color: '#6366f1', msg: t('alexChatMsg1', 'This scene is 🔥'), side: 'other' },
                  { name: t('sarahName', 'Sarah'), color: '#a855f7', msg: t('sarahChatMsg1', 'Agreed!! Love this part'), side: 'other' },
                  { name: t('youName', 'You'), color: '#10b981', msg: t('youChatMsg1', 'Same time for everyone?'), side: 'me' },
                ].map((m, i) => (
                  <div key={i} className="gcw-force-dark" style={{ display: 'flex', gap: 8, marginBottom: 10, flexDirection: m.side === 'me' ? 'row-reverse' : 'row' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {m.name[0]}
                    </div>
                    <div style={{ background: m.side === 'me' ? '#6366f1' : (isLight ? '#ffffff' : 'rgba(255,255,255,0.08)'), color: m.side === 'me' ? '#fff' : 'var(--text-primary)', padding: '6px 10px', borderRadius: m.side === 'me' ? '12px 12px 0 12px' : '12px 12px 12px 0', fontSize: 12, maxWidth: 160 }}>
                      {m.msg}
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{t('sarahIsTyping', 'Sarah is typing...')}</div>
              </div>
            </div>

            {/* Right: Private DMs */}
            <div style={{ flex: '1 1 300px', ...cardStyle, borderTop: '3px solid #10b981' }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><Lock size={18} color="#10b981" /> {t('privateMessagesTitle', 'Private Messages')}</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{t('privateMessagesSub', 'Just between two people')}</div>
              </div>

              {[
                t('privateChatF1', 'Private chats only you two can see'),
                t('privateChatF2', 'React to messages with emojis'),
                t('privateChatF3', 'End-to-end encrypted — fully secure'),
                t('privateChatF4', 'Lock any chat with a PIN for extra privacy'),
                t('privateChatF5', 'Media sharing — images and videos'),
                t('privateChatF6', 'Reply to specific messages'),
                t('privateChatF7', 'Unread message badge counter')
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <Check size={16} color="#10b981" />
                  <span style={{ fontSize: 14 }}>{f}</span>
                </div>
              ))}

              <div style={{ marginTop: 20, background: isLight ? '#f8f7ff' : 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 11, color: '#10b981', fontWeight: 600 }}>
                  <Lock size={11} /> {t('endToEndEncryptedLabel', 'End-to-end encrypted')}
                </div>
                {[
                  { name: t('sarahName', 'Sarah'), color: '#a855f7', msg: t('sarahDmMsg1', "Let's create a private room later?"), side: 'other' },
                  { name: t('youName', 'You'), color: '#6366f1', msg: t('youDmMsg1', 'Sure! Send me the link 🎬'), side: 'me' },
                ].map((m, i) => (
                  <div key={i} className="gcw-force-dark" style={{ display: 'flex', gap: 8, marginBottom: 10, flexDirection: m.side === 'me' ? 'row-reverse' : 'row' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {m.name[0]}
                    </div>
                    <div style={{ background: m.side === 'me' ? '#6366f1' : (isLight ? '#ffffff' : 'rgba(255,255,255,0.08)'), color: m.side === 'me' ? '#fff' : 'var(--text-primary)', padding: '6px 10px', borderRadius: m.side === 'me' ? '12px 12px 0 12px' : '12px 12px 12px 0', fontSize: 12, maxWidth: 180 }}>
                      {m.msg}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Encryption banner */}
          <div className="gcw-force-dark" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', borderRadius: 16, padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', maxWidth: 900, margin: '0 auto' }}>
            <Lock size={20} color="#fff" style={{ flexShrink: 0 }} />
            <p className="stay-white" style={{ color: '#fff', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
              <strong>{t('e2eEncryptedBold', 'All Group & Private Chat messages use end-to-end encryption.')}</strong> {t('notEvenWeRead', 'Not even we can read your conversations.')}
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 7 — PRIVACY
      ══════════════════════════════════════════ */}
      <section id="privacy" ref={el => sectionRefs.current.privacy = el} className="hiw-section" style={{ background: isLight ? '#ffffff' : '#0f0f18' }}>
        <div className="hiw-container">
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: isLight ? '#4338ca' : '#818cf8', marginBottom: 16 }}>{t('yourPrivacyLabel', 'YOUR PRIVACY')}</div>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 800, marginBottom: 16, color: isLight ? '#111' : '#f8f9fa' }}>{t('privacyByDesignTitle', 'Privacy by Design')}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 17, maxWidth: 540, margin: '0 auto' }}>{t('privacyByDesignDesc', 'We built SahaPlay with your privacy as the foundation, not an afterthought.')}</p>
          </div>

          {/* Privacy cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            {privacyCards.map((card, i) => (
              <div key={i} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 16, borderTop: '3px solid #6366f1' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(99,102,241,0.12)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {card.icon}
                </div>
                <h3 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>{card.title}</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 15, margin: 0 }}>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 8 — FAQ ACCORDION
      ══════════════════════════════════════════ */}
      <section id="faq" ref={el => sectionRefs.current.faq = el} className="hiw-section" style={{ background: isLight ? '#f8f7ff' : '#13131f' }}>
        <div className="hiw-container">
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: isLight ? '#4338ca' : '#818cf8', marginBottom: 16 }}>{t('faqLabel', 'FAQ')}</div>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 800, marginBottom: 0, color: isLight ? '#111' : '#f8f9fa' }}>{t('faqTitle', 'Frequently Asked Questions')}</h2>
          </div>

          {/* FAQ accordion */}
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            {faqs.map((faq, i) => (
              <div key={i} style={{
                marginBottom: 8,
                border: `1px solid ${openFaq === i ? 'rgba(99,102,241,0.35)' : (isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)')}`,
                borderLeft: openFaq === i ? '4px solid #6366f1' : `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 12,
                background: openFaq === i ? (isLight ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.08)') : (isLight ? '#ffffff' : '#1e1e30'),
                overflow: 'hidden',
                transition: 'border-color 0.2s, background 0.2s',
              }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16 }}
                >
                  <span style={{ fontWeight: 700, fontSize: 17, color: isLight ? '#111827' : 'var(--text-primary)' }}>{faq.q}</span>
                  {openFaq === i
                    ? <ChevronUp size={20} color="#6366f1" style={{ flexShrink: 0 }} />
                    : <ChevronDown size={20} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                  }
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 24px 20px', color: isLight ? '#374151' : 'var(--text-secondary)', lineHeight: 1.7, fontSize: 16 }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 9 — FINAL CTA
      ══════════════════════════════════════════ */}
      <section
        className="hiw-section"
        style={{
          background: isLight ? '#1e1b4b' : '#0f0e17',
          position: 'relative',
          paddingTop: '52px',
          paddingBottom: '52px',
        }}
      >
        {/* stay-white on container: S9 bg is dark navy in BOTH light+dark modes, all text must stay white */}
        <div className="hiw-container stay-white" style={{ textAlign: 'center' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 20,
            background: 'rgba(108,99,255,0.18)', border: '1px solid rgba(108,99,255,0.4)',
            color: '#a5b4fc', fontSize: 13, fontWeight: 600, marginBottom: 24,
          }}>
            <Check size={13} /> {t('readGuideBadge', "You've read the guide")}
          </div>

          <h2 className="stay-white" style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, color: '#ffffff', marginBottom: 16, lineHeight: 1.1 }}>
            {t('finalCtaTitle', 'You Know How It Works.')}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 18, maxWidth: 460, margin: '0 auto 40px', lineHeight: 1.7 }}>
            {t('hiwFinalCtaLine1', 'Now experience it yourself —')}<br />
            {t('hiwFinalCtaLine2', 'your first room is ready in 30 seconds.')}
          </p>

          {/* Primary CTA button */}
          <div style={{ marginBottom: 32 }}>
            <button
              onClick={createRoom}
              style={{
                padding: '14px 36px',
                background: '#6C63FF',
                color: '#ffffff',
                border: 'none',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s',
                boxShadow: '0 4px 24px rgba(108,99,255,0.4)',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(108,99,255,0.55)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(108,99,255,0.4)'; }}
            >
              {t('createYourFirstRoom', 'Create Your First Room')} <ArrowRight size={16} color="#ffffff" />
            </button>
          </div>

          {/* Trust checklist — replaces secondary button */}
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { key: 'freeForever', val: 'Free forever' },
              { key: 'noDownload', val: 'No download' },
              { key: 'friendsJoinNoAccount', val: 'Friends join without account' },
            ].map((item) => (
              <span
                key={item.key}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  color: 'rgba(255,255,255,0.78)', fontSize: 14,
                }}
              >
                <Check size={14} color="#6C63FF" />
                {t(item.key, item.val)}
              </span>
            ))}
          </div>
        </div>
      </section>

      <Footer />

      {showBackToTop && (
        <button
          className="back-to-top-btn"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            zIndex: 999,
            padding: '10px 22px', borderRadius: 50,
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            color: '#fff', fontSize: 14, fontWeight: 600,
            boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
            whiteSpace: 'nowrap',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateX(-50%) translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 28px rgba(99,102,241,0.65)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateX(-50%)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.5)';
          }}
        >
          <ChevronUp size={18} color="#fff" />
          {t('termsBackToTop', 'Back to Top')}
        </button>
      )}
    </div>
  );
};

export default HowItWorks;
