import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Lock, EyeOff, Trash2, Mail, Bug, UserX, BookOpen, Zap, User,
  X, FolderOpen, MessageSquare, Clock, LockOpen, HelpCircle, Key, AlertTriangle, ChevronUp, Scale,
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SeoHead from './components/SeoHead';
import { useTranslation } from 'react-i18next';
import { useBackIntercept } from './hooks/useBackIntercept';

export default function Safety() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState(() => localStorage.getItem('watch_theme') || 'dark');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [showChatLockModal, setShowChatLockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const h = () => setTheme(localStorage.getItem('watch_theme') || 'dark');
    window.addEventListener('theme_changed', h);
    return () => window.removeEventListener('theme_changed', h);
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

  useEffect(() => {
    if (showChatLockModal || showReportModal) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [showChatLockModal, showReportModal]);

  // Mobile/iPad swipe-back should close these modals instead of navigating away.
  useBackIntercept((showChatLockModal || showReportModal) ? 1 : 0, (newLevel) => {
    if (newLevel === 0) { setShowChatLockModal(false); setShowReportModal(false); }
  });

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

  const sec1Bg = isLight ? '#ffffff' : '#0f0f18';
  const sec2Bg = isLight ? '#f8f7ff' : '#13131f';
  const sec3Bg = isLight ? '#ffffff' : '#0f0f18';
  const sec4Bg = isLight ? '#f8f7ff' : '#13131f';
  const sec5Bg = isLight ? '#ffffff' : '#0f0f18';

  return (
    <div className="page-enter" style={{ minHeight: '100vh', background: pageBg, color: textPrimary }}>
      <SeoHead path="/safety" />
      {showChatLockModal && (
        <ChatLockInfoModal
          isLight={isLight}
          isMobile={isMobile}
          onClose={() => setShowChatLockModal(false)}
        />
      )}
      {showReportModal && (
        <ReportHowModal
          isLight={isLight}
          isMobile={isMobile}
          onClose={() => setShowReportModal(false)}
        />
      )}
      <Navbar />
      <Toaster position="top-center" />
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
              {t('sfBadge')}
            </div>

            <h1 style={{
              fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, lineHeight: 1.1,
              marginBottom: 20, background: 'none',
              WebkitTextFillColor: isLight ? '#111' : 'unset',
              color: isLight ? '#111' : '#f8f9fa',
            }}>
              {t('sfTitlePart1')}{' '}
              <span style={{
                background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {t('sfTitlePart2')}
              </span>
            </h1>

            <p style={{
              maxWidth: 560, margin: '0 auto 40px',
              color: textMuted, fontSize: 18, lineHeight: 1.6,
            }}>
              {t('sfSubtitle')}
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[t('sfHeroPill1'), t('sfHeroPill2'), t('sfHeroPill3')].map((pill, i) => (
                <div key={i} style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '8px 18px', borderRadius: 99,
                  background: 'rgba(var(--brand-1-rgb),0.08)',
                  border: `1px solid ${isLight ? 'rgba(var(--brand-1-rgb),0.25)' : 'rgba(var(--brand-1-rgb),0.3)'}`,
                  color: isLight ? 'var(--brand-1)' : 'var(--brand-1-light)',
                  fontSize: 13, fontWeight: 600,
                }}>
                  {pill}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 2 — QUICK ACTIONS
        ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec2Bg }}>
          <div className="hiw-container">
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, marginBottom: 12, color: textPrimary }}>
                {t('sfQuickActionsTitle')}
              </h2>
              <p style={{ color: textMuted, fontSize: 16, maxWidth: 440, margin: '0 auto' }}>
                {t('sfQuickActionsSubtitle')}
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 24,
              maxWidth: 880,
              margin: '0 auto',
            }}>
              {/* Block a User */}
              <ActionCard
                cardStyle={cardStyle}
                accent="var(--brand-1)"
                emoji="🚫"
                title={t('sfBlockUserTitle')}
                desc={t('sfBlockUserDesc')}
                steps={[t('sfBlockUserStep1'), t('sfBlockUserStep2'), t('sfBlockUserStep3')]}
                stepsHeader={t('sfStepsHeader')}
                textPrimary={textPrimary}
                textMuted={textMuted}
                isLight={isLight}
                link={
                  <Link
                    to="/profile"
                    state={{ openSection: 'blockedUsers' }}
                    style={{ color: isLight ? 'var(--brand-1-darker)' : 'var(--brand-1-light)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
                  >
                    {t('sfBlockUserLink')}
                  </Link>
                }
              />

              {/* Lock Your Chats */}
              <ActionCard
                cardStyle={cardStyle}
                accent="var(--brand-2)"
                emoji="🔒"
                title={t('sfLockChatsTitle')}
                desc={t('sfLockChatsDesc')}
                steps={[t('sfLockChatsStep1'), t('sfLockChatsStep2'), t('sfLockChatsStep3')]}
                stepsHeader={t('sfStepsHeader')}
                textPrimary={textPrimary}
                textMuted={textMuted}
                isLight={isLight}
                link={
                  <button
                    onClick={() => setShowChatLockModal(true)}
                    style={{
                      background: 'none', border: 'none', padding: 0,
                      color: isLight ? 'var(--brand-1-darker)' : 'var(--brand-1-light)', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', textDecoration: 'none',
                    }}
                  >
                    {t('sfLockChatsLink')}
                  </button>
                }
              />

              {/* Report a Bug */}
              <div
                style={{ ...cardStyle, borderTop: '3px solid #3b82f6' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = isLight ? '0 8px 32px rgba(var(--brand-1-rgb),0.18)' : '0 8px 24px rgba(0,0,0,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = isLight ? '0 4px 24px rgba(var(--brand-1-rgb),0.12)' : 'none'; }}
              >
                <div style={{ fontSize: 24, marginBottom: 12 }}>🐛</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: textPrimary }}>{t('sfReportBugTitle')}</h3>
                <p style={{ color: textMuted, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
                  {t('sfReportBugDesc')}
                </p>
                <Link to="/report-bug" style={{ color: isLight ? 'var(--brand-1-darker)' : 'var(--brand-1-light)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  {t('sfReportBugLink')}
                </Link>
              </div>

              {/* Contact Support */}
              <div
                style={{ ...cardStyle, borderTop: '3px solid #10b981' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = isLight ? '0 8px 32px rgba(var(--brand-1-rgb),0.18)' : '0 8px 24px rgba(0,0,0,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = isLight ? '0 4px 24px rgba(var(--brand-1-rgb),0.12)' : 'none'; }}
              >
                <div style={{ fontSize: 24, marginBottom: 12 }}>📧</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: textPrimary }}>{t('sfContactSupportTitle')}</h3>
                <p style={{ color: textMuted, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
                  {t('sfContactSupportDesc')}
                </p>
                <Link to="/contact" style={{ color: isLight ? 'var(--brand-1-darker)' : 'var(--brand-1-light)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  {t('sfContactSupportLink')}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 3 — COMMUNITY RULES
        ══════════════════════════════════════════ */}
        <section id="community-rules" className="hiw-section" style={{ background: sec3Bg }}>
          <div className="hiw-container">
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, marginBottom: 12, color: textPrimary }}>
                {t('sfRulesTitle')}
              </h2>
              <p style={{ color: textMuted, fontSize: 16, maxWidth: 480, margin: '0 auto' }}>
                {t('sfRulesSubtitle')}
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 24,
              maxWidth: 900,
              margin: '0 auto 24px',
            }}>
              {/* Encouraged */}
              <div style={{
                background: 'rgba(16,185,129,0.05)',
                border: '1px solid rgba(16,185,129,0.15)',
                borderRadius: 12,
                padding: 24,
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#10b981', marginBottom: 20 }}>{t('sfRulesEncouraged')}</h3>
                {[
                  t('sfRulesEncouraged1'),
                  t('sfRulesEncouraged2'),
                  t('sfRulesEncouraged3'),
                  t('sfRulesEncouraged4'),
                  t('sfRulesEncouraged5'),
                  t('sfRulesEncouraged6'),
                  t('sfRulesEncouraged7'),
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12, fontSize: 14, color: isLight ? '#374151' : textMuted }}>
                    <span style={{ color: '#10b981', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                    {item}
                  </div>
                ))}
              </div>

              {/* Not Allowed */}
              <div style={{
                background: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: 12,
                padding: 24,
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', marginBottom: 20 }}>{t('sfRulesNotAllowed')}</h3>
                {[
                  t('sfRulesNotAllowed1'),
                  t('sfRulesNotAllowed2'),
                  t('sfRulesNotAllowed3'),
                  t('sfRulesNotAllowed4'),
                  t('sfRulesNotAllowed5'),
                  t('sfRulesNotAllowed6'),
                  t('sfRulesNotAllowed7'),
                  t('sfRulesNotAllowed8'),
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12, fontSize: 14, color: isLight ? '#374151' : textMuted }}>
                    <span style={{ color: '#ef4444', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✗</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Warning box */}
            <div style={{
              maxWidth: 900,
              margin: '0 auto',
              background: 'rgba(239,68,68,0.06)',
              borderLeft: '4px solid #ef4444',
              borderRadius: 8,
              padding: '16px 20px',
            }}>
              <div style={{ color: isLight ? '#b91c1c' : '#fca5a5', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                {t('sfRulesWarning')}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 4 — HOW TO REPORT
        ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec4Bg }}>
          <div className="hiw-container">
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, marginBottom: 12, color: textPrimary }}>
                {t('sfReportTitle')}
              </h2>
              <p style={{ color: textMuted, fontSize: 16, maxWidth: 480, margin: '0 auto' }}>
                {t('sfReportSubtitle')}
              </p>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: 'flex-start',
              maxWidth: 860,
              margin: '0 auto 32px',
            }}>
              {[
                {
                  num: '1',
                  Icon: UserX,
                  title: t('sfReportStep1Title'),
                  bodyEl: (
                    <div style={{ fontSize: 14, lineHeight: 1.65 }}>
                      {t('sfReportStep1Desc')}{' '}
                      <button
                        onClick={() => setShowReportModal(true)}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          color: isLight ? 'var(--brand-1-darker)' : 'var(--brand-1-light)', fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', display: 'inline',
                        }}
                      >
                        {t('sfReportStep1Link')}
                      </button>
                    </div>
                  ),
                },
                {
                  num: '2',
                  Icon: Mail,
                  title: t('sfReportStep2Title'),
                  bodyEl: (
                    <span style={{ fontSize: 14, lineHeight: 1.65 }}>
                      {t('sfReportStep2Desc').split('safety@sahaplay.com')[0]}
                      <a href="mailto:safety@sahaplay.com" style={{ color: isLight ? 'var(--brand-1-darker)' : 'var(--brand-1-light)', textDecoration: 'none', fontWeight: 600 }}>
                        safety@sahaplay.com
                      </a>
                      {t('sfReportStep2Desc').split('safety@sahaplay.com')[1]}
                    </span>
                  ),
                },
                {
                  num: '3',
                  Icon: Shield,
                  title: t('sfReportStep3Title'),
                  body: t('sfReportStep3Desc'),
                },
              ].map((step, i) => (
                <React.Fragment key={i}>
                  <div style={{ flex: 1, textAlign: 'center', padding: isMobile ? '20px 0' : '24px 20px' }}>
                    <div className="stay-white" style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 16px',
                      fontSize: 20, fontWeight: 900, color: '#fff',
                    }}>
                      {step.num}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                      <step.Icon size={24} color="var(--brand-1-light)" />
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: textPrimary }}>{step.title}</h3>
                    <div style={{ color: textMuted, fontSize: 14, lineHeight: 1.6 }}>
                      {step.bodyEl || step.body}
                    </div>
                  </div>
                  {i < 2 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      color: isLight ? 'rgba(var(--brand-1-rgb),0.4)' : 'rgba(var(--brand-1-rgb),0.5)',
                      padding: isMobile ? '0' : '48px 4px 0',
                      transform: isMobile ? 'rotate(90deg)' : 'none',
                      flexShrink: 0,
                      width: isMobile ? '100%' : 'auto',
                    }}>
                      →
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Response time banner */}
            <div style={{
              background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
              borderRadius: 12,
              padding: '20px 32px',
              textAlign: 'center',
              maxWidth: 680,
              margin: '0 auto',
            }}>
              <p className="stay-white" style={{ color: '#fff', fontWeight: 600, fontSize: 15, margin: 0, lineHeight: 1.5 }}>
                {t('sfReportBanner')}
              </p>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 4B — CHILD SAFETY STANDARDS (CSAE)
            Externally published, publicly accessible, non-editable — this
            exact section is what Google Play's Child Safety Standards
            declaration (App content > Child safety standards) points its
            "Safety standards URL" at: https://sahaplay.com/safety#child-safety
        ══════════════════════════════════════════ */}
        <section id="child-safety" className="hiw-section" style={{ background: sec3Bg }}>
          <div className="hiw-container">
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: isLight ? 'rgba(220,38,38,0.08)' : 'rgba(252,165,165,0.1)',
                color: isLight ? '#b91c1c' : '#fca5a5',
                padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700,
                marginBottom: 20,
              }}>
                <Shield size={14} /> {t('sfChildSafetyBadge')}
              </div>
              <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, marginBottom: 16, color: textPrimary, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
                {t('sfChildSafetyTitle')}
              </h2>
              <p style={{ color: textMuted, fontSize: 15, lineHeight: 1.7, maxWidth: 640, margin: '0 auto' }}>
                {t('sfChildSafetyIntro')}
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: 24,
              maxWidth: 960,
              margin: '0 auto 24px',
            }}>
              {[
                { Icon: UserX, title: t('sfChildSafetyCard1Title'), body: t('sfChildSafetyCard1Desc') },
                { Icon: Mail, title: t('sfChildSafetyCard2Title'), body: t('sfChildSafetyCard2Desc') },
                { Icon: Scale, title: t('sfChildSafetyCard3Title'), body: t('sfChildSafetyCard3Desc') },
              ].map((card, i) => (
                <div key={i} style={{ ...cardStyle, textAlign: 'left' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'rgba(var(--brand-1-rgb),0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 14,
                  }}>
                    <card.Icon size={20} color="var(--brand-1-light)" />
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: textPrimary }}>{card.title}</h3>
                  <p style={{ color: textMuted, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{card.body}</p>
                </div>
              ))}
            </div>

            <div style={{
              maxWidth: 800, margin: '0 auto',
              background: isLight ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.1)',
              border: `1px solid ${isLight ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.25)'}`,
              borderRadius: 12, padding: '16px 20px',
            }}>
              <p style={{ color: textMuted, fontSize: 13, lineHeight: 1.65, margin: 0 }}>
                {t('sfChildSafetyEncryptionNote')}
              </p>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 5 — PRIVACY HIGHLIGHTS
        ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec5Bg }}>
          <div className="hiw-container">
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, marginBottom: 12, color: textPrimary }}>
                {t('sfPrivacyTitle')}
              </h2>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: 24,
              maxWidth: 900,
              margin: '0 auto',
            }}>
              {[
                { Icon: Lock, title: t('sfPrivacyCard1Title'), body: t('sfPrivacyCard1Desc') },
                { Icon: EyeOff, title: t('sfPrivacyCard2Title'), body: t('sfPrivacyCard2Desc') },
                { Icon: Trash2, title: t('sfPrivacyCard3Title'), body: t('sfPrivacyCard3Desc') },
              ].map((card, i) => (
                <div
                  key={i}
                  style={{ ...cardStyle, textAlign: 'center' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = isLight ? '0 8px 32px rgba(var(--brand-1-rgb),0.18)' : '0 8px 24px rgba(0,0,0,0.4)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = isLight ? '0 4px 24px rgba(var(--brand-1-rgb),0.12)' : 'none'; }}
                >
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: 'rgba(var(--brand-1-rgb),0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}>
                    <card.Icon size={22} color="var(--brand-1-light)" />
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: textPrimary }}>{card.title}</h3>
                  <p style={{ color: textMuted, fontSize: 14, lineHeight: 1.6 }}>{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 6 — NEED SAFETY HELP
        ══════════════════════════════════════════ */}
        <section className="gcw-force-dark hiw-section" style={{ background: 'linear-gradient(135deg, var(--brand-1-deep), var(--brand-2-deep))' }}>
          <div className="hiw-container" style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
            <Shield size={48} color="var(--brand-1-light)" style={{ marginBottom: 24 }} />

            <h2 className="stay-white" style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, marginBottom: 16, color: '#fff' }}>
              {t('sfHelpTitle')}
            </h2>
            <p className="stay-white" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16, maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.6 }}>
              {t('sfHelpDesc')}
            </p>

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
              <Link
                to="/contact?subject=Safety+Report"
                style={{
                  background: '#ffffff',
                  color: 'var(--brand-1-dark)',
                  fontWeight: 700,
                  borderRadius: 50,
                  padding: '14px 28px',
                  textDecoration: 'none',
                  fontSize: 15,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'opacity 0.2s, transform 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <Mail size={15} />
                {t('sfHelpContactBtn')}
              </Link>

              <button
                onClick={() => document.getElementById('community-rules')?.scrollIntoView({ behavior: 'smooth' })}
                style={{
                  background: 'rgba(255,255,255,0.13)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 50,
                  padding: '14px 28px',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.13)'; }}
              >
                <BookOpen size={15} />
                {t('sfHelpRulesBtn')}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'nowrap' }}>
              {[
                { icon: <Lock size={11} />, label: t('sfHelpBadgeConfidential') },
                { icon: <Zap size={11} />, label: t('sfHelpBadgeResponse') },
                { icon: <User size={11} />, label: t('sfHelpBadgePersonal') },
              ].map((badge, i) => (
                <div key={i} style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'rgba(255,255,255,0.11)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: 12,
                  padding: '6px 12px',
                  borderRadius: 20,
                  whiteSpace: 'nowrap',
                }}>
                  {badge.icon}
                  {badge.label}
                </div>
              ))}
            </div>
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

function ReportHowModal({ isLight, isMobile, onClose }) {
  const { t } = useTranslation();
  const cardBg = isLight ? 'rgba(var(--brand-1-rgb),0.06)' : 'rgba(255,255,255,0.05)';
  const cardBorder = isLight ? '1px solid rgba(var(--brand-1-rgb),0.15)' : '1px solid rgba(255,255,255,0.08)';
  const titleColor = isLight ? '#111827' : '#ffffff';
  const bodyColor = isLight ? '#374151' : 'rgba(255,255,255,0.7)';
  const strongColor = isLight ? '#111827' : '#ffffff';

  return (
    <div
      className="safety-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        className="gcw-force-dark"
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          background: isLight ? '#ffffff' : '#1e1b3a',
          border: `1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 20,
          padding: isMobile ? '24px 20px' : '32px',
          maxWidth: 460,
          width: '100%',
          boxShadow: isLight ? '0 20px 60px rgba(0,0,0,0.15)' : 'none',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            width: 32, height: 32, borderRadius: '50%',
            background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)',
            border: `1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)'}`,
            color: isLight ? '#555' : 'rgba(255,255,255,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)'; }}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <UserX size={28} color="var(--brand-1-light)" style={{ marginBottom: 10 }} />
        <div style={{ fontSize: 20, fontWeight: 800, color: titleColor, marginBottom: 6 }}>
          {t('sfRepModalTitle')}
        </div>
        <div style={{ fontSize: 13, color: isLight ? '#6b7280' : 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
          {t('sfRepModalSubtitle')}
        </div>
        <div style={{ borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`, marginBottom: 20 }} />

        {/* Option 1: From Group Chat */}
        <div style={{ background: cardBg, border: cardBorder, borderRadius: 12, padding: '16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'rgba(var(--brand-1-rgb),0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <MessageSquare size={16} color="var(--brand-1-light)" />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: titleColor }}>{t('sfRepModalHeader1')}</div>
          </div>
          <div style={{ fontSize: 13, color: bodyColor, lineHeight: 1.65 }}>
            {t('sfRepModalBody1').split('Report')[0]}
            <strong style={{ color: strongColor }}>Report</strong>
            {t('sfRepModalBody1').split('Report')[1]}
          </div>
        </div>

        {/* Option 2: From Their Profile */}
        <div style={{ background: cardBg, border: cardBorder, borderRadius: 12, padding: '16px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'rgba(var(--brand-1-rgb),0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <User size={16} color="var(--brand-1-light)" />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: titleColor }}>{t('sfRepModalHeader2')}</div>
          </div>
          <div style={{ fontSize: 13, color: bodyColor, lineHeight: 1.65 }}>
            {t('sfRepModalBody2')}
          </div>
        </div>

        {/* Bottom button */}
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '12px',
            background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))',
            border: 'none', borderRadius: 12,
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {t('sfRepModalButton')}
        </button>
      </div>
    </div>
  );
}

function ChatLockInfoModal({ isLight, isMobile, onClose }) {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <>
      <style>{`
        .chatlock-modal::-webkit-scrollbar { display: none; }
        
        .chatlock-modal {
          background: #1a1730 !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        
        html[data-theme='light'] .chatlock-modal {
          background: #ffffff !important;
          border: 1px solid rgba(var(--brand-1-rgb), 0.25) !important;
        }

        /* ── Warning title "Important Recovery Warning" ── */
        .cl-warning-title {
          color: #f87171 !important;
        }
        html[data-theme='light'] .cl-warning-title {
          color: #b91c1c !important;
        }

        /* ── Text of the warning block ── */
        .cl-warning-text {
          color: rgba(255, 255, 255, 0.85) !important;
        }
        html[data-theme='light'] .cl-warning-text {
          color: #7f1d1d !important;
        }

        /* ── Highlighted terms: "Master Key", "erased permanently." ── */
        .cl-warning-highlight-primary {
          color: #fca5a5 !important;
        }
        html[data-theme='light'] .cl-warning-highlight-primary {
          color: #991b1b !important;
        }

        .cl-warning-highlight-secondary {
          color: #f87171 !important;
        }
        html[data-theme='light'] .cl-warning-highlight-secondary {
          color: #b91c1c !important;
        }

        /* ── Badge "Always save your Master Key" ── */
        .cl-warning-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(239, 68, 68, 0.15) !important;
          border: 1px solid rgba(239, 68, 68, 0.3) !important;
          border-radius: 6px;
          padding: 5px 12px;
          font-weight: 700;
          font-size: 12px;
          color: #ffffff !important; /* bright white in dark mode */
        }
        
        html[data-theme='light'] .cl-warning-badge {
          background: rgba(185, 28, 28, 0.1) !important;
          border: 1px solid rgba(185, 28, 28, 0.25) !important;
          color: #b91c1c !important; /* dark red in light mode */
        }
      `}</style>
      <div
        className="safety-modal-overlay"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.48)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: isMobile ? 16 : 24,
        }}
      >
        <div
          className="chatlock-modal"
          onClick={e => e.stopPropagation()}
          style={{
            position: 'relative',
            borderRadius: 20,
            padding: isMobile ? '20px 16px' : '28px 24px',
            maxWidth: isMobile ? '90%' : 460,
            width: '100%',
            maxHeight: isMobile ? '80vh' : '75vh',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            boxShadow: isLight
              ? '0 24px 80px rgba(var(--brand-1-rgb),0.22)'
              : '0 24px 80px rgba(0,0,0,0.6)',
          }}
        >
          {/* ── Sticky Header Wrapper ── */}
          <div style={{
            position: 'sticky',
            top: isMobile ? -20 : -28,
            marginTop: isMobile ? -20 : -28,
            paddingTop: isMobile ? 20 : 28,
            background: isLight ? '#ffffff' : '#1a1730',
            zIndex: 10,
          }}>
            {/* ── Close button ── */}
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                position: 'absolute', top: isMobile ? 28 : 36, right: 0,
                width: 32, height: 32, borderRadius: '50%',
                background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)',
                border: `1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)'}`,
                color: isLight ? '#555' : 'rgba(255,255,255,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)'; }}
            >
              <X size={16} />
            </button>

            {/* ── Header Info ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, paddingRight: 40 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                background: 'rgba(var(--brand-2-rgb),0.18)',
                border: '1px solid rgba(var(--brand-2-rgb),0.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Lock size={22} color="var(--brand-2-light)" />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: isLight ? '#111' : '#ffffff', lineHeight: 1.2 }}>{t('sfLockModalTitle')}</div>
                <div style={{ fontSize: 13, color: isLight ? '#6b7280' : 'rgba(255,255,255,0.55)', marginTop: 3 }}>
                  {t('sfLockModalSubtitle')}
                </div>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`, margin: '20px 0' }} />
          </div>

          {/* ── Section 1: How to Lock a Chat ── */}
          <CLSection icon={<Lock size={15} />} label={t('sfLockSec1Title')} isLight={isLight} />
          {[
            t('sfLockSec1Step1'),
            t('sfLockSec1Step2'),
            t('sfLockSec1Step3'),
            t('sfLockSec1Step4'),
            t('sfLockSec1Step5'),
            t('sfLockSec1Step6'),
            t('sfLockSec1Step7'),
          ].map((text, i) => <CLStep key={i} num={i + 1} text={text} isLight={isLight} />)}

          {/* ── Section 2: How to Open Locked Chats ── */}
          <CLSection icon={<FolderOpen size={15} />} label={t('sfLockSec2Title')} isLight={isLight} />
          {[
            t('sfLockSec2Step1'),
            t('sfLockSec2Step2'),
            t('sfLockSec2Step3'),
            t('sfLockSec2Step4'),
            t('sfLockSec2Step5'),
          ].map((text, i) => <CLStep key={i} num={i + 1} text={text} isLight={isLight} />)}

          <div style={{
            background: isLight ? 'rgba(var(--brand-1-rgb),0.05)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isLight ? 'rgba(var(--brand-1-rgb),0.15)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 10, padding: '14px 16px', marginBottom: 22, marginTop: 4,
            fontSize: 13, color: isLight ? '#374151' : 'rgba(255,255,255,0.75)', lineHeight: 1.8,
          }}>
            <strong style={{ color: isLight ? 'var(--brand-1-dark)' : 'var(--brand-1-light)' }}>{t('sfLockAttemptsTitle')}</strong>
            <br />
            • <strong style={{ color: isLight ? '#111' : '#fff' }}>{t('sfLockAttemptsBullet1')}</strong>
            <br />
            • <strong style={{ color: isLight ? '#111' : '#fff' }}>{t('sfLockAttemptsBullet2')}</strong>
            <br />
            • {t('sfLockAttemptsBullet3')}
            <br />
            • {t('sfLockAttemptsBullet4')}
          </div>

          {/* ── Section 3: Auto-Lock Feature ── */}
          <CLSection icon={<Clock size={15} />} label={t('sfLockSec3Title')} isLight={isLight} />
          <div style={{
            background: isLight ? 'rgba(var(--brand-1-rgb),0.05)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isLight ? 'rgba(var(--brand-1-rgb),0.15)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 10, padding: '14px 16px', marginBottom: 22,
            fontSize: 13, color: isLight ? '#374151' : 'rgba(255,255,255,0.75)', lineHeight: 1.8,
          }}>
            {t('sfLockSec3Desc1')}
            <br /><br />
            <span style={{ color: 'var(--brand-1-light)', fontWeight: 600 }}>{t('sfLockSec3Desc2')}</span>
            <br /><br />
            {t('sfLockSec3Desc3')}
            <br /><br />
            <span style={{ fontSize: 12, color: isLight ? '#9ca3af' : 'rgba(255,255,255,0.4)' }}>
              {t('sfLockSec3Path')}
            </span>
          </div>

          {/* ── Section 4: Chat Lock Inside Rooms ── */}
          <CLSection icon={<MessageSquare size={15} />} label={t('sfLockSec4Title')} isLight={isLight} />
          <div style={{
            background: isLight ? 'rgba(var(--brand-1-rgb),0.05)' : 'rgba(var(--brand-1-rgb),0.07)',
            border: `1px solid ${isLight ? 'rgba(var(--brand-1-rgb),0.15)' : 'rgba(var(--brand-1-rgb),0.18)'}`,
            borderRadius: 10, padding: '14px 16px', marginBottom: 22,
            fontSize: 13, color: isLight ? '#374151' : 'rgba(255,255,255,0.75)', lineHeight: 1.8,
          }}>
            {t('sfLockSec4Desc1')}
            <br /><br />
            {t('sfLockSec4Desc2').split('lock indicator')[0]}
            <strong style={{ color: 'var(--brand-1-light)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Lock size={12} /> lock indicator
            </strong>
            {t('sfLockSec4Desc2').split('lock indicator')[1]}
            <br /><br />
            {t('sfLockSec4Desc3')}
            <br /><br />
            <span style={{ fontSize: 12, color: isLight ? '#9ca3af' : 'rgba(255,255,255,0.45)' }}>
              {t('sfLockSec4Desc4')}
            </span>
          </div>

          {/* ── Section 5: How to Disable Chat Lock ── */}
          <CLSection icon={<LockOpen size={15} />} label={t('sfLockSec5Title')} isLight={isLight} />
          {[
            t('sfLockSec5Step1'),
            t('sfLockSec5Step2'),
            t('sfLockSec5Step3'),
            t('sfLockSec5Step4'),
            t('sfLockSec5Step5'),
          ].map((text, i) => <CLStep key={i} num={i + 1} text={text} isLight={isLight} />)}

          {/* ── Section 6: Important Recovery Warning ── */}
          <CLSection
            icon={<AlertTriangle size={15} />}
            label={t('sfLockSec6Title')}
            isLight={isLight}
            className="cl-warning-title"
          />
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1.5px solid rgba(239,68,68,0.3)',
            borderRadius: 12, padding: '16px 18px', marginBottom: 8,
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <AlertTriangle size={20} className="cl-warning-title" />
              </div>
              <div className="cl-warning-text" style={{ fontSize: 13, lineHeight: 1.8 }}>
                {t('sfLockSec6Desc1').split('Master Key')[0]}
                <strong className="cl-warning-highlight-primary">Master Key</strong>
                {t('sfLockSec6Desc1').split('Master Key')[1]}
                <br /><br />
                {t('sfLockSec6Desc2')}
                <br /><br />
                <div style={{
                  background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 8, padding: '10px 12px', margin: '12px 0',
                  fontSize: 12, fontFamily: 'monospace',
                }}>
                  <span style={{ fontWeight: 600, color: isLight ? '#475569' : '#9ca3af' }}>{t('sfLockSec6Format')}</span>
                  <br />
                  XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
                  <br />
                  <span style={{ fontWeight: 600, color: isLight ? '#475569' : '#9ca3af' }}>{t('sfLockSec6Example')}</span>
                  <br />
                  9244-9229-3FA4-51E7-5E98-6EE7-7A9B-DE57
                  <br />
                  <span style={{ fontSize: 11, color: isLight ? '#64748b' : '#6b7280' }}>
                    {t('sfLockSec6Sub')}
                  </span>
                </div>
                {t('sfLockSec6Desc3')}
                <br /><br />
                <span className="cl-warning-badge">
                  <Key size={14} /> {t('sfLockSec6Badge')}
                </span>
              </div>
            </div>
          </div>

          {/* ── Footer button ── */}
          <button
            onClick={onClose}
            className="stay-white"
            style={{
              width: '100%', padding: '13px',
              marginTop: 24,
              background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))',
              border: 'none', borderRadius: 12,
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            {t('sfLockModalButton')}
          </button>
        </div>
      </div>
    </>
  );
}

function ActionCard({ cardStyle, accent, emoji, title, desc, steps, stepsHeader, textPrimary, textMuted, isLight, link, midContent }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        ...cardStyle,
        borderTop: `3px solid ${accent}`,
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered
          ? (isLight ? '0 8px 32px rgba(var(--brand-1-rgb),0.18)' : '0 8px 24px rgba(0,0,0,0.4)')
          : cardStyle.boxShadow,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ fontSize: 24, marginBottom: 12 }}>{emoji}</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: textPrimary }}>{title}</h3>
      <p style={{ color: isLight ? '#374151' : '#9ca3af', fontSize: 14, lineHeight: 1.6, marginBottom: midContent ? 0 : 16 }}>{desc}</p>
      {midContent}
      {steps && steps.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#374151' : '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            {stepsHeader}
          </div>
          {steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: isLight ? '#4b5563' : '#9ca3af', marginBottom: 5 }}>
              <span style={{ color: accent, fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{i + 1}.</span>
              <span>{step}</span>
              {i < steps.length - 1 && <span style={{ color: 'var(--brand-2)', fontSize: 11, marginLeft: 2 }}>→</span>}
            </div>
          ))}
        </div>
      )}
      {link}
    </div>
  );
}

/* ── Helpers used only inside ChatLockInfoModal ── */
function CLSection({ icon, label, isLight, color, className }) {
  const iconColor = color || (isLight ? 'var(--brand-1)' : 'var(--brand-1-light)');
  return (
    <div
      className={className}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        margin: '4px 0 12px',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase',
        color: iconColor,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {React.isValidElement(icon) ? React.cloneElement(icon, { color: iconColor }) : icon}
      </span>
      {label}
    </div>
  );
}

function CLStep({ num, text, isLight }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
      <div style={{
        width: 22, height: 22, flexShrink: 0,
        borderRadius: '50%',
        background: 'rgba(var(--brand-2-rgb),0.18)',
        border: '1px solid rgba(var(--brand-2-rgb),0.3)',
        color: 'var(--brand-2-light)',
        fontSize: 11, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {num}
      </div>
      <div style={{
        fontSize: 13,
        color: isLight ? '#374151' : 'rgba(255,255,255,0.8)',
        lineHeight: 1.65, paddingTop: 3,
      }}>
        {text}
      </div>
    </div>
  );
}
