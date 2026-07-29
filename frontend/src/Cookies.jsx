import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Cookie, Shield, Lock, Database, Key, Cpu, Layers, Settings,
  AlertTriangle, Mail, HelpCircle, Info, CheckCircle2, Terminal, ChevronUp
} from 'lucide-react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SeoHead from './components/SeoHead';

export default function Cookies() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState(() => localStorage.getItem('watch_theme') || 'dark');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleTheme = () => setTheme(localStorage.getItem('watch_theme') || 'dark');
    window.addEventListener('theme_changed', handleTheme);
    return () => window.removeEventListener('theme_changed', handleTheme);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isLight = theme === 'light';

  const pageBg = isLight
    ? 'linear-gradient(135deg,#f0f0f8 0%,#e8e8f5 50%,#f0f0f8 100%)'
    : '#09090b';
  const textPrimary = isLight ? '#111' : '#f8f9fa';
  const textMuted = isLight ? '#6b7280' : '#9ca3af';

  const cardStyle = {
    background: isLight ? '#ffffff' : '#1e1e30',
    border: `1px solid ${isLight ? 'rgba(var(--brand-1-rgb),0.22)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 16,
    padding: 28,
    boxShadow: isLight ? '0 4px 24px rgba(var(--brand-1-rgb),0.12)' : 'none',
    transition: 'transform 0.2s, box-shadow 0.2s',
  };

  const sec1Bg = isLight ? '#ffffff' : '#09090b';
  const sec2Bg = isLight ? '#f8f7ff' : '#13131f';
  const sec3Bg = isLight ? '#ffffff' : '#09090b';

  return (
    <div className="page-enter" style={{ minHeight: '100vh', background: pageBg, color: textPrimary }}>
      <SeoHead path="/cookies" />
      <Navbar />
      <div className="page-wrapper">

        {/* ══════════════════════════════════════════
            SECTION 1 — HERO
        ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec1Bg, paddingTop: 100, paddingBottom: 80 }}>
          <div className="hiw-container" style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(var(--brand-1-rgb),0.1)', border: '1px solid rgba(var(--brand-1-rgb),0.3)',
              color: 'var(--brand-1-light)', borderRadius: 99, padding: '6px 16px',
              fontSize: 13, fontWeight: 600, marginBottom: 28,
            }}>
              <Cookie size={14} style={{ marginRight: 2 }} /> {t('cookiePageBadge', 'Security & Storage')}
            </div>

            <h1 style={{
              fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, lineHeight: 1.1,
              marginBottom: 20, background: 'none',
              WebkitTextFillColor: isLight ? '#111' : 'unset',
              color: isLight ? '#111' : '#f8f9fa',
            }}>
              {t('cookiePolicyTitle', 'Cookie Policy').split(' ').slice(0, -1).join(' ')}{' '}
              <span style={{
                background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {t('cookiePolicyTitle', 'Cookie Policy').split(' ').slice(-1)[0]}
              </span>
            </h1>

            <p style={{
              maxWidth: 680, margin: '0 auto 30px',
              color: textMuted, fontSize: 17, lineHeight: 1.6,
            }}>
              {t('cookieHeroDesc', 'Learn how SahaPlay uses cookies, browser storage, authentication technologies, and security mechanisms to provide a secure and personalized experience.')}
            </p>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: isLight ? 'rgba(var(--brand-1-rgb),0.06)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${isLight ? 'rgba(var(--brand-1-rgb),0.15)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 8, padding: '6px 16px',
              fontSize: 12, fontWeight: 500, color: textMuted,
            }}>
              {t('cookieLastUpdated', 'Last Updated: May 2026')}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 2 — WHAT ARE COOKIES?
        ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec2Bg, paddingTop: 60, paddingBottom: 60 }}>
          <div className="hiw-container">
            <div style={{
              ...cardStyle,
              maxWidth: 800,
              margin: '0 auto',
              display: 'flex',
              gap: 24,
              alignItems: 'center',
              flexDirection: isMobile ? 'column' : 'row',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(var(--brand-2-rgb),0.15)',
                border: '1px solid rgba(var(--brand-2-rgb),0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Cookie size={32} color="var(--brand-2-light)" />
              </div>
              <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, color: textPrimary }}>{t('cookieWhatTitle', 'What are Cookies?')}</h2>
                <p style={{ color: isLight ? '#374151' : 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 1.7, margin: 0 }}>
                  {t('cookieWhatDesc', 'Cookies are small pieces of data stored in your browser that help websites remember information between visits. SahaPlay uses cookies and similar browser technologies to support authentication, security, preferences, and application performance.')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 3 — HOW WE USE COOKIES
        ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec3Bg }}>
          <div className="hiw-container">
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, marginBottom: 12, color: textPrimary }}>
                {t('cookieHowTitle', 'How SahaPlay Uses Cookies')}
              </h2>
              <p style={{ color: textMuted, fontSize: 16, maxWidth: 540, margin: '0 auto' }}>
                {t('cookieHowDesc', 'We use cookies and browser storage technologies to enable essential core features.')}
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 24,
              maxWidth: 900,
              margin: '0 auto',
            }}>
              {[
                {
                  Icon: Shield,
                  accent: '#6366f1',
                  title: t('cookieAuthTitle', 'Authentication'),
                  bullets: [
                    t('cookieAuthItem1', 'Keeps users signed in securely.'),
                    t('cookieAuthItem2', 'Maintains active sessions.'),
                    t('cookieAuthItem3', 'Reduces unnecessary logins.'),
                  ]
                },
                {
                  Icon: Lock,
                  accent: '#a855f7',
                  title: t('cookieSecurityTitle', 'Security'),
                  bullets: [
                    t('cookieSecurityItem1', 'Protects accounts and sessions.'),
                    t('cookieSecurityItem2', 'Supports security verification.'),
                    t('cookieSecurityItem3', 'Helps prevent unauthorized access.'),
                  ]
                },
                {
                  Icon: Settings,
                  accent: '#3b82f6',
                  title: t('cookiePrefsTitle', 'Preferences'),
                  bullets: [
                    t('cookiePrefsItem1', 'Remembers theme settings (dark/light mode).'),
                    t('cookiePrefsItem2', 'Remembers interface preferences.'),
                    t('cookiePrefsItem3', 'Stores user customization choices.'),
                  ]
                },
                {
                  Icon: Cpu,
                  accent: '#10b981',
                  title: t('cookiePerfTitle', 'Performance'),
                  bullets: [
                    t('cookiePerfItem1', 'Improves loading speed.'),
                    t('cookiePerfItem2', 'Supports reconnection features.'),
                    t('cookiePerfItem3', 'Optimizes application responsiveness.'),
                  ]
                }
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{ ...cardStyle, borderTop: `3px solid ${item.accent}` }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = isLight ? '0 8px 32px rgba(var(--brand-1-rgb),0.18)' : '0 8px 24px rgba(0,0,0,0.4)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = isLight ? '0 4px 24px rgba(var(--brand-1-rgb),0.12)' : 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: 'rgba(var(--brand-1-rgb),0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <item.Icon size={18} color="var(--brand-1-light)" />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: textPrimary, margin: 0 }}>{item.title}</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {item.bullets.map((bullet, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: isLight ? '#374151' : textMuted }}>
                        <span style={{ color: item.accent, fontWeight: 'bold', marginTop: 1 }}>✓</span>
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 4 — BROWSER STORAGE TECHNOLOGIES
        ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec2Bg }}>
          <div className="hiw-container">
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, marginBottom: 12, color: textPrimary }}>
                {t('cookieStorageTitle', 'Browser Storage Technologies')}
              </h2>
              <p style={{ color: textMuted, fontSize: 16, maxWidth: 540, margin: '0 auto' }}>
                {t('cookieStorageDesc', 'Apart from traditional cookies, we utilize modern browser storage mechanisms to save data locally.')}
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: 24,
              maxWidth: 900,
              margin: '0 auto',
            }}>
              {[
                {
                  Icon: Database,
                  title: t('cookieLocalTitle', 'localStorage'),
                  desc: t('cookieLocalDesc', 'Persistent key-value database that remains after the browser window is closed.'),
                  uses: [
                    t('cookieLocalItem1', 'Theme preferences'),
                    t('cookieLocalItem2', 'User interface settings'),
                    t('cookieLocalItem3', 'Room preferences'),
                  ]
                },
                {
                  Icon: Layers,
                  title: t('cookieSessionTitle', 'sessionStorage'),
                  desc: t('cookieSessionDesc', 'Temporary key-value storage that is completely cleared when the browser tab is closed.'),
                  uses: [
                    t('cookieSessionItem1', 'Temporary session info'),
                    t('cookieSessionItem2', 'Navigation state'),
                    t('cookieSessionItem3', 'Session-specific data'),
                  ]
                },
                {
                  Icon: Cpu,
                  title: t('cookieIndexedTitle', 'IndexedDB'),
                  desc: t('cookieIndexedDesc', 'A full client-side relational database designed for storing large amounts of structured data.'),
                  uses: [
                    t('cookieIndexedItem1', 'Application caching'),
                    t('cookieIndexedItem2', 'Performance optimization'),
                    t('cookieIndexedItem3', 'Encrypted local application data'),
                  ]
                }
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{ ...cardStyle, display: 'flex', flexDirection: 'column', height: '100%' }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = isLight ? '0 8px 32px rgba(var(--brand-1-rgb),0.18)' : '0 8px 24px rgba(0,0,0,0.4)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = isLight ? '0 4px 24px rgba(var(--brand-1-rgb),0.12)' : 'none';
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'rgba(var(--brand-2-rgb),0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 16,
                  }}>
                    <item.Icon size={20} color="var(--brand-2-light)" />
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: textPrimary }}>{item.title}</h3>
                  <p style={{ color: textMuted, fontSize: 13, lineHeight: 1.6, marginBottom: 16, flexGrow: 1 }}>{item.desc}</p>

                  <div style={{ borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`, paddingTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#4b5563' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                      {t('cookieUsedFor', 'Used for:')}
                    </div>
                    {item.uses.map((use, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: isLight ? '#374151' : 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                        <span style={{ color: 'var(--brand-2-light)', fontWeight: 'bold' }}>•</span>
                        <span>{use}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 5 — CHAT LOCK & SECURITY STORAGE
        ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec3Bg }}>
          <div className="hiw-container">
            <div style={{
              ...cardStyle,
              maxWidth: 800,
              margin: '0 auto',
              borderLeft: '4px solid var(--brand-2)',
              background: isLight ? 'rgba(var(--brand-2-rgb),0.02)' : 'rgba(var(--brand-2-rgb),0.04)',
            }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'rgba(var(--brand-2-rgb),0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Lock size={22} color="var(--brand-2-light)" />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: textPrimary, marginBottom: 8 }}>{t('cookieChatLockTitle', 'Chat Lock & Security Storage')}</h3>
                  <p style={{ color: textMuted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                    {t('cookieChatLockDesc', 'SahaPlay includes a built-in Chat Lock feature designed to keep your personal chats private. To protect these conversations, the app stores cryptographically secure credentials locally on your browser.')}
                  </p>
                  <p style={{
                    fontSize: 13,
                    color: isLight ? '#4b5563' : '#9ca3af',
                    marginBottom: 12,
                    marginTop: 12,
                    fontStyle: 'italic'
                  }}>
                    {t('cookieChatLockE2ee', 'End-to-end encryption key material is stored in session memory only and is never written to disk or sent to our servers.')}
                  </p>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
                    {[
                      t('cookiePinMeta', 'PIN verification metadata'),
                      t('cookieMasterKey', 'Master Key verification details'),
                      t('cookieLockTimer', 'Lockout timer state'),
                      `🔐 ${t('cookieE2eeSession', 'E2EE Key Material (session only)')}`,
                    ].map((badge, idx) => (
                      <span key={idx} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'}`,
                        borderRadius: 6, padding: '4px 10px',
                        fontSize: 11, fontWeight: 600, color: isLight ? '#4b5563' : 'rgba(255,255,255,0.7)',
                      }}>
                        <CheckCircle2 size={10} color="#10b981" />
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 6 — THIRD PARTY SERVICES
        ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec2Bg }}>
          <div className="hiw-container">
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, marginBottom: 12, color: textPrimary }}>
                {t('cookieThirdTitle', 'Third-Party Services')}
              </h2>
              <p style={{ color: textMuted, fontSize: 16, maxWidth: 540, margin: '0 auto' }}>
                {t('cookieThirdDesc', 'We work with premium service providers who also utilize cookies and local storage to run application layers.')}
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 24,
              maxWidth: 800,
              margin: '0 auto',
            }}>
              {/* Supabase */}
              <div style={{ ...cardStyle }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: 'rgba(16,185,129,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Database size={18} color="#10b981" />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: textPrimary, margin: 0 }}>{t('cookieSupabaseTitle', 'Supabase')}</h3>
                </div>
                <p style={{ color: textMuted, fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
                  {t('cookieSupabaseDesc', 'Supabase acts as our primary database and backend infrastructure provider. It stores tokens and session states locally in your browser.')}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    t('cookieSupabaseItem1', 'Authentication'),
                    t('cookieSupabaseItem2', 'Realtime Sync'),
                    t('cookieSupabaseItem3', 'Database Storage'),
                  ].map((badge, idx) => (
                    <span key={idx} style={{
                      background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
                      color: '#10b981', borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 600
                    }}>{badge}</span>
                  ))}
                </div>
              </div>

              {/* Future Integrations */}
              <div style={{ ...cardStyle }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: 'rgba(var(--brand-1-rgb),0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Terminal size={18} color="var(--brand-1-light)" />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: textPrimary, margin: 0 }}>{t('cookieFutureTitle', 'Future Integrations')}</h3>
                </div>
                <p style={{ color: textMuted, fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
                  {t('cookieFutureDesc', 'We may introduce third-party tools to help analyze user feedback, monitor application health, and report crashes.')}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    t('cookieFutureItem1', 'Analytics'),
                    t('cookieFutureItem2', 'Performance Logging'),
                    t('cookieFutureItem3', 'Error Reports'),
                  ].map((badge, idx) => (
                    <span key={idx} style={{
                      background: 'rgba(var(--brand-1-rgb),0.06)', border: '1px solid rgba(var(--brand-1-rgb),0.2)',
                      color: 'var(--brand-1-light)', borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 600
                    }}>{badge}</span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{
              maxWidth: 800,
              margin: '24px auto 0',
              textAlign: 'center',
              fontSize: 12,
              color: textMuted,
              lineHeight: 1.6,
            }}>
              * {t('cookieFutureNote', 'Third-party services operate under their own privacy policies. You can choose to block third-party cookies directly in your browser.')}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 7 — MANAGING COOKIES
        ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec3Bg }}>
          <div className="hiw-container">
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, marginBottom: 12, color: textPrimary }}>
                {t('cookieManageTitle', 'How to Manage Cookies')}
              </h2>
              <p style={{ color: textMuted, fontSize: 16, maxWidth: 540, margin: '0 auto' }}>
                {t('cookieManageDesc', 'You have full control over browser data. Here is how to modify settings in popular browsers.')}
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: 24,
              maxWidth: 700,
              margin: '0 auto',
            }}>
              {[
                {
                  browser: t('cookieChromeTitle', 'Google Chrome'),
                  path: t('cookieChromeDesc', 'Settings → Privacy and Security → Cookies and Other Site Data')
                },
                {
                  browser: t('cookieEdgeTitle', 'Microsoft Edge'),
                  path: t('cookieEdgeDesc', 'Settings → Cookies and Site Permissions → Manage and Delete Cookies')
                },
                {
                  browser: t('cookieFirefoxTitle', 'Mozilla Firefox'),
                  path: t('cookieFirefoxDesc', 'Settings → Privacy & Security → Cookies and Site Data')
                },
                {
                  browser: t('cookieSafariTitle', 'Apple Safari'),
                  path: t('cookieSafariDesc', 'Settings → Privacy → Manage Website Data → Remove All')
                }
              ].map((item, idx) => (
                <div key={idx} style={{ ...cardStyle, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, color: textPrimary }}>{item.browser}</h3>
                  <div style={{
                    background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 8, padding: '12px 14px',
                    fontSize: 12, color: textMuted, lineHeight: 1.5,
                  }}>
                    {item.path}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 8 — WHAT HAPPENS IF COOKIES ARE DISABLED?
        ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec2Bg }}>
          <div className="hiw-container">
            <div style={{
              ...cardStyle,
              maxWidth: 800,
              margin: '0 auto',
              border: '1.5px solid rgba(239,68,68,0.22)',
              background: 'rgba(239,68,68,0.04)',
            }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'rgba(239,68,68,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <AlertTriangle size={20} color="#ef4444" />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: textPrimary, marginBottom: 8 }}>{t('cookieDisableTitle', 'Disabling Browser Storage')}</h3>
                  <p style={{ color: textMuted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                    {t('cookieDisableDesc', 'Please note that if you block all cookies and local browser storage, certain parts of SahaPlay may cease to function correctly. This will specifically impact:')}
                  </p>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                    gap: 10,
                    marginTop: 16,
                  }}>
                    {[
                      t('cookieDisableItem1', 'Active login sessions and auto-login workflows'),
                      t('cookieDisableItem2', 'Theme choices (defaults back to dark mode)'),
                      t('cookieDisableItem3', 'Active room states and synchronization parameters'),
                      t('cookieDisableItem4', 'Chat Lock protection vault and PIN recovery workflows'),
                    ].map((val, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: isLight ? '#4b5563' : 'rgba(255,255,255,0.7)' }}>
                        <span style={{ color: '#ef4444', fontWeight: 'bold' }}>•</span>
                        <span>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 8b — PRIVACY & COOKIE POLICY
        ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec3Bg, paddingTop: 60, paddingBottom: 60 }}>
          <div className="hiw-container">
            <div style={{
              maxWidth: 800,
              margin: '0 auto',
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: isLight ? '0 8px 40px rgba(var(--brand-1-rgb),0.18)' : '0 8px 40px rgba(0,0,0,0.4)',
            }}>
              {/* Top gradient band */}
              <div className="gcw-force-dark" style={{
                background: 'linear-gradient(135deg, var(--brand-1) 0%, var(--brand-2) 50%, #ec4899 100%)',
                padding: '28px 36px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                flexDirection: isMobile ? 'column' : 'row',
                textAlign: isMobile ? 'center' : 'left',
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Shield size={26} color="#fff" />
                </div>
                <div>
                  <h3 className="stay-white" style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0, marginBottom: 4 }}>
                    {t('cookiePrivacyTitle', 'Privacy & Cookie Policy')}
                  </h3>
                  <p className="stay-white" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                    {t('cookiePrivacySubtitle', 'Your data, your rights — full transparency on how we protect you.')}
                  </p>
                </div>
              </div>

              {/* Body */}
              <div style={{
                background: isLight ? '#fff' : '#1e1e30',
                border: `1px solid ${isLight ? 'rgba(var(--brand-1-rgb),0.15)' : 'rgba(255,255,255,0.06)'}`,
                borderTop: 'none',
                padding: '28px 36px',
              }}>
                <p style={{ color: isLight ? '#374151' : 'rgba(255,255,255,0.8)', fontSize: 15, lineHeight: 1.7, marginBottom: 24, marginTop: 0 }}>
                  {t('cookiePrivacyDesc', 'This Cookie Policy is part of our broader Privacy Policy. Together, they explain what data we collect, why we collect it, how it is stored, and what rights you have. We encourage you to read the full Privacy Policy for a complete picture of our data practices.')}
                </p>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <a
                    className="stay-white"
                    href="https://www.iubenda.com/privacy-policy/25516226"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '12px 24px', borderRadius: 50,
                      background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
                      color: '#fff', fontSize: 14, fontWeight: 700,
                      textDecoration: 'none',
                      boxShadow: '0 2px 8px rgba(var(--brand-1-rgb),0.25)',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(var(--brand-1-rgb),0.35)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(var(--brand-1-rgb),0.25)';
                    }}
                  >
                    <Shield size={15} color="#fff" />
                    {t('cookiePrivacyBtn', 'Read Full Privacy Policy')} →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 9 — CONTACT SECTION
        ══════════════════════════════════════════ */}
        <section className="gcw-force-dark hiw-section" style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', padding: '80px 0' }}>
          <div className="hiw-container" style={{ textAlign: 'center', maxWidth: 580, margin: '0 auto' }}>
            <Mail size={44} color="var(--brand-1-light)" style={{ marginBottom: 20 }} />

            <h2 className="stay-white" style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, marginBottom: 12, color: '#fff' }}>
              {t('cookieContactTitle', 'Questions About Our Cookie Policy?')}
            </h2>
            <p className="stay-white" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, maxWidth: 440, margin: '0 auto 32px', lineHeight: 1.6 }}>
              {t('cookieContactDesc', 'Our security and support teams are here to help. Reach out if you want to know more about how we safeguard your data.')}
            </p>

            <Link
              to="/contact"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '14px 32px',
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 50,
                color: '#ffffff',
                fontSize: 15,
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            >
              <Mail size={16} color="#fff" /> {t('cookieContactBtn', 'Contact Us')} →
            </Link>
          </div>
        </section>

      </div>
      <Footer />

      {showBackToTop && (
        <button
          className="back-to-top-btn"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            zIndex: 999,
            padding: '10px 22px', borderRadius: 50,
            background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            color: '#fff', fontSize: 14, fontWeight: 600,
            boxShadow: '0 4px 20px rgba(var(--brand-1-rgb),0.5)',
            whiteSpace: 'nowrap',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateX(-50%) translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 28px rgba(var(--brand-1-rgb),0.65)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateX(-50%)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(var(--brand-1-rgb),0.5)';
          }}
        >
          <ChevronUp size={18} color="#fff" />
          {t('termsBackToTop', 'Back to Top')}
        </button>
      )}
    </div>
  );
}
