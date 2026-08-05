import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FileText, User, Trash2, Upload, Shield, Lock,
  Database, AlertTriangle, Clock, Edit, Globe,
  Layers, Mail, Scale, Users, ChevronUp, Info, MessageSquare,
  Play, HardDrive, Flag, CreditCard,
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SeoHead from './components/SeoHead';
import { isStandalonePWA } from './lib/platform';

const SECTIONS = [
  { id: 'introduction',         num: 1,  titleKey: 'termsSec1Title',  defaultTitle: 'Introduction',                           Icon: FileText      },
  { id: 'account-registration', num: 2,  titleKey: 'termsSec2Title',  defaultTitle: 'Account Registration',                   Icon: User          },
  { id: 'account-termination',  num: 3,  titleKey: 'termsSec3Title',  defaultTitle: 'Account Termination',                    Icon: Trash2        },
  { id: 'user-content',         num: 4,  titleKey: 'termsSec4Title',  defaultTitle: 'User Generated Content',                 Icon: Upload        },
  { id: 'acceptable-use',       num: 5,  titleKey: 'termsSec5Title',  defaultTitle: 'Acceptable Use',                         Icon: Shield        },
  { id: 'intellectual-property',num: 6,  titleKey: 'termsSec6Title',  defaultTitle: 'Copyright & Intellectual Property',      Icon: Scale         },
  { id: 'privacy',              num: 7,  titleKey: 'termsSec7Title',  defaultTitle: 'Privacy',                                Icon: Lock          },
  { id: 'third-party',          num: 8,   titleKey: 'termsSec8Title',  defaultTitle: 'Third Party Services',                   Icon: Database       },
  { id: 'chat-messages',        num: '8B', titleKey: 'termsSec8bTitle',  defaultTitle: 'Chat Messages & User Communications',  Icon: MessageSquare  },
  { id: 'streaming-content',    num: '8C', titleKey: 'termsSec8cTitle',  defaultTitle: 'Streaming & Shared Content',           Icon: Play           },
  { id: 'disclaimers',          num: 9,    titleKey: 'termsSec9Title',   defaultTitle: 'Disclaimers & Limitation of Liability', Icon: AlertTriangle  },
  { id: 'interruptions',        num: 10,   titleKey: 'termsSec10Title',  defaultTitle: 'Service Interruptions',                 Icon: Clock          },
  { id: 'data-loss',            num: '10B', titleKey: 'termsSec10bTitle', defaultTitle: 'Data Loss',                           Icon: HardDrive      },
  { id: 'moderation',           num: '10C', titleKey: 'termsSec10cTitle', defaultTitle: 'Moderation and Enforcement',          Icon: Flag           },
  { id: 'changes',              num: 11,   titleKey: 'termsSec11Title',  defaultTitle: 'Changes to These Terms',                Icon: Edit           },
  { id: 'age',                  num: 12, titleKey: 'termsSec12Title', defaultTitle: 'Age Restrictions',                       Icon: Users         },
  { id: 'governing-law',        num: 13, titleKey: 'termsSec13Title', defaultTitle: 'Governing Law',                          Icon: Globe         },
  { id: 'severability',         num: 14,    titleKey: 'termsSec14Title',  defaultTitle: 'Severability',          Icon: Layers      },
  { id: 'future-paid',          num: '14B', titleKey: 'termsSec14bTitle', defaultTitle: 'Future Paid Services',  Icon: CreditCard  },
  { id: 'contact-us',           num: 15,    titleKey: 'termsSec15Title',  defaultTitle: 'Contact Us',            Icon: Mail        },
];

const ACCENTS = [
  '#6366f1','#a855f7','#3b82f6','#10b981','#f59e0b',
  '#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899',
  '#84cc16','#6366f1','#a855f7','#3b82f6','#10b981',
];

export default function Terms() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState(() => localStorage.getItem('watch_theme') || 'dark');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);

  const handleLinkClick = (id) => {
    setHighlightedId(null);
    setTimeout(() => {
      setHighlightedId(id);
    }, 50);
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash) {
        const id = hash.substring(1);
        setHighlightedId(id);
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!highlightedId) return;
    const timer = setTimeout(() => {
      setHighlightedId(null);
    }, 2500);
    return () => clearTimeout(timer);
  }, [highlightedId]);

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
  const pageBg   = isLight ? 'linear-gradient(135deg,#f0f0f8 0%,#e8e8f5 50%,#f0f0f8 100%)' : '#09090b';
  const textPrimary = isLight ? '#111'    : '#f8f9fa';
  const textMuted   = isLight ? '#6b7280' : '#9ca3af';
  const textBody    = isLight ? '#374151' : 'rgba(255,255,255,0.8)';
  const sec1Bg = isLight ? '#ffffff' : '#09090b';
  const sec2Bg = isLight ? '#f8f7ff' : '#13131f';

  const cardBase = {
    background:   isLight ? '#ffffff' : '#1e1e30',
    border:       `1px solid ${isLight ? 'rgba(var(--brand-1-rgb),0.22)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 16,
    padding:      28,
    boxShadow:    isLight ? '0 4px 24px rgba(var(--brand-1-rgb),0.12)' : 'none',
    transition:   'transform 0.2s, box-shadow 0.2s',
  };

  /* ── tiny helpers ── */
  const Para = ({ children }) => (
    <p style={{ fontSize: 15, color: textBody, lineHeight: 1.75, margin: '0 0 12px' }}>{children}</p>
  );

  const Bullet = ({ children, accent = '#818cf8' }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: textBody, marginBottom: 7 }}>
      <span style={{ color: accent, fontWeight: 'bold', marginTop: 2, flexShrink: 0 }}>•</span>
      <span>{children}</span>
    </div>
  );

  const Sub = ({ children }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: textMuted, marginBottom: 5, marginLeft: 18 }}>
      <span style={{ color: '#a855f7', fontWeight: 'bold', marginTop: 1, flexShrink: 0 }}>◦</span>
      <span>{children}</span>
    </div>
  );

  const SectionCard = ({ id, num, Icon, accent = '#6366f1', children }) => {
    const sec = SECTIONS.find(s => s.id === id);
    const isHighlighted = highlightedId === id;

    const highlightStyle = isHighlighted ? {
      background: isLight ? 'rgba(var(--brand-2-rgb), 0.08)' : 'rgba(var(--brand-2-rgb), 0.16)',
      borderColor: 'var(--brand-2)',
      boxShadow: isLight ? '0 0 28px rgba(var(--brand-2-rgb), 0.4)' : '0 0 35px rgba(var(--brand-2-rgb), 0.55)',
      transform: 'scale(1.02) translateY(-2px)',
    } : {};

    return (
      <div
        id={id}
        style={{
          ...cardBase,
          ...highlightStyle,
          marginBottom: 20,
          scrollMarginTop: 90,
          transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, flexShrink: 0,
            background: `${accent}1a`, border: `1px solid ${accent}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={18} color={accent} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>
              {t('termsSectionFormat', 'Section {{num}}', { num: num })}
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: textPrimary, margin: 0 }}>{t(sec?.titleKey, sec?.defaultTitle)}</h2>
          </div>
        </div>
        {children}
      </div>
    );
  };

  return (
    <div className="page-enter" style={{ minHeight: '100vh', background: pageBg, color: textPrimary }}>
      <SeoHead path="/terms" />
      <Navbar />
      <Toaster position="top-center" />
      <div className="page-wrapper">

        {/* ══ HERO ══════════════════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec1Bg, paddingTop: 100, paddingBottom: 80 }}>
          <div className="hiw-container" style={{ textAlign: 'center' }}>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(var(--brand-1-rgb),0.1)', border: '1px solid rgba(var(--brand-1-rgb),0.3)',
              color: 'var(--brand-1-light)', borderRadius: 99, padding: '6px 16px',
              fontSize: 13, fontWeight: 600, marginBottom: 28,
            }}>
              <FileText size={14} /> {t('termsLegalDocs', 'Legal Documents')}
            </div>

            <h1 style={{
              fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, lineHeight: 1.1,
              marginBottom: 12, color: isLight ? '#111' : '#f8f9fa',
              WebkitTextFillColor: isLight ? '#111' : 'unset',
            }}>
              {t('termsTitlePart1', 'Terms &')}{' '}
              <span style={{
                background: 'var(--brand-gradient)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {t('termsTitlePart2', 'Conditions')}
              </span>
            </h1>

            <p style={{ fontSize: 15, color: textMuted, marginBottom: 20 }}>www.sahaplay.com</p>

            <p style={{ maxWidth: 620, margin: '0 auto 28px', color: textMuted, fontSize: 16, lineHeight: 1.6 }}>
              {t('termsIntroDesc', 'Please read these Terms and Conditions carefully before using SahaPlay. By using our service, you agree to be bound by these terms.')}
            </p>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: isLight ? 'rgba(var(--brand-1-rgb),0.06)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${isLight ? 'rgba(var(--brand-1-rgb),0.15)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 8, padding: '6px 16px',
              fontSize: 12, fontWeight: 500, color: textMuted,
            }}>
              {t('termsLastUpdated', 'Last Updated: June 04, 2026')}
            </div>
          </div>
        </section>

        {/* ══ TABLE OF CONTENTS ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec2Bg, paddingTop: 60, paddingBottom: 60 }}>
          <div className="hiw-container">
            <div style={{ ...cardBase, maxWidth: 860, margin: '0 auto' }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: textPrimary, marginTop: 0, marginBottom: 20 }}>
                {t('termsTableOfContents', 'Table of Contents')}
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
                gap: 8,
              }}>
                {SECTIONS.map(({ id, num, titleKey, defaultTitle }) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    onClick={() => handleLinkClick(id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', borderRadius: 8,
                      background: isLight ? 'rgba(var(--brand-1-rgb),0.05)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isLight ? 'rgba(var(--brand-1-rgb),0.12)' : 'rgba(255,255,255,0.06)'}`,
                      textDecoration: 'none', color: isLight ? 'var(--brand-1-dark)' : 'var(--brand-1-light)',
                      fontSize: 13, fontWeight: 500, transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = isLight ? 'rgba(var(--brand-1-rgb),0.1)' : 'rgba(255,255,255,0.09)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isLight ? 'rgba(var(--brand-1-rgb),0.05)' : 'rgba(255,255,255,0.04)'; }}
                  >
                    <span style={{
                      width: 22, height: 22, borderRadius: 6,
                      background: 'rgba(var(--brand-1-rgb),0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 800, color: 'var(--brand-1-light)', flexShrink: 0,
                    }}>{num}</span>
                    {t(titleKey, defaultTitle)}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══ SECTIONS 1–15 ══════════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec1Bg, paddingTop: 60, paddingBottom: 60 }}>
          <div className="hiw-container" style={{ maxWidth: 860, margin: '0 auto' }}>

            {/* 1 — Introduction */}
            <SectionCard id="introduction" num={1} Icon={FileText} accent={ACCENTS[0]}>
              <Para>
                {t('termsIntroPara1', 'These Terms and Conditions govern your use of SahaPlay (www.sahaplay.com) and any related services provided by SahaPlay.')}
              </Para>
              <Para>
                {t('termsIntroPara2', 'By accessing or using SahaPlay, you confirm that you are at least 13 years of age and agree to be bound by these Terms. If you do not agree, please do not use our service.')}
              </Para>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Mail size={14} color={ACCENTS[0]} />
                <span style={{ fontSize: 14, color: textBody }}>
                  {t('termsIntroContact', 'Contact:')}{' '}
                  <a href="mailto:contact@sahaplay.com" style={{ color: ACCENTS[0], textDecoration: 'none', fontWeight: 600 }}>
                    contact@sahaplay.com
                  </a>
                </span>
              </div>
            </SectionCard>

            {/* 2 — Account Registration */}
            <SectionCard id="account-registration" num={2} Icon={User} accent={ACCENTS[1]}>
              <Bullet accent={ACCENTS[1]}>{t('termsRegBullet1', 'Users may register an account or use the service as a guest without registering.')}</Bullet>
              <Bullet accent={ACCENTS[1]}>{t('termsRegBullet2', 'You are responsible for keeping your login credentials confidential.')}</Bullet>
              <Bullet accent={ACCENTS[1]}>{t('termsRegBullet3', 'You must provide accurate and truthful information.')}</Bullet>
              <Bullet accent={ACCENTS[1]}>{t('termsRegBullet4', 'Each user may only register one account.')}</Bullet>
              <Bullet accent={ACCENTS[1]}>{t('termsRegBullet5', 'Accounts may not be registered by bots or automated methods.')}</Bullet>
              <Bullet accent={ACCENTS[1]}>{t('termsRegBullet6', 'You must be at least 13 years old to register.')}</Bullet>
              <Bullet accent={ACCENTS[1]}>{t('termsRegBullet7', 'Users aged 13–17 may only use the service under parental or adult supervision.')}</Bullet>
            </SectionCard>

            {/* 3 — Account Termination */}
            <SectionCard id="account-termination" num={3} Icon={Trash2} accent={ACCENTS[2]}>
              <Bullet accent={ACCENTS[2]}>
                {t('termsTermBullet1', 'You may terminate your account at any time by contacting us at')}{' '}
                <a href="mailto:contact@sahaplay.com" style={{ color: ACCENTS[2], textDecoration: 'none', fontWeight: 600 }}>contact@sahaplay.com</a>.
              </Bullet>
              <Bullet accent={ACCENTS[2]}>
                {t('termsTermBullet2', 'We reserve the right to suspend or delete accounts that violate these Terms, applicable law, or that we deem inappropriate, without prior notice.')}
              </Bullet>
              <Bullet accent={ACCENTS[2]}>
                {t('termsTermBullet3', 'Suspension or deletion does not entitle users to any compensation or reimbursement.')}
              </Bullet>
            </SectionCard>

            {/* 4 — User Generated Content */}
            <SectionCard id="user-content" num={4} Icon={Upload} accent={ACCENTS[3]}>
              <Bullet accent={ACCENTS[3]}>{t('termsContentBullet1', 'Users may upload, share, and stream content through SahaPlay rooms and chat features.')}</Bullet>
              <Bullet accent={ACCENTS[3]}>
                {t('termsContentBullet2', 'By providing content, you confirm you have the legal right to do so and are not infringing any third-party rights.')}
              </Bullet>
              <Bullet accent={ACCENTS[3]}>
                {t('termsContentBullet3', 'You retain ownership of your content. However, by using SahaPlay you grant us a non-exclusive, royalty-free license to process your content solely for operating and maintaining the service.')}
              </Bullet>
              <Bullet accent={ACCENTS[3]}>
                {t('termsContentBullet4', 'We do not actively monitor user content but reserve the right to remove content that violates these Terms.')}
              </Bullet>
              <Para>{t('termsContentRemoveIntro', 'We may remove content and restrict access if:')}</Para>
              <Sub>{t('termsContentSub1', 'A complaint based on such content is received.')}</Sub>
              <Sub>{t('termsContentSub2', 'A copyright infringement notice is received.')}</Sub>
              <Sub>{t('termsContentSub3', 'Ordered by a public authority.')}</Sub>
              <Sub>{t('termsContentSub4', 'The content poses a risk to users or the service.')}</Sub>
            </SectionCard>

            {/* 5 — Acceptable Use */}
            <SectionCard id="acceptable-use" num={5} Icon={Shield} accent={ACCENTS[4]}>
              <Para>{t('termsUseIntro', 'You agree NOT to use SahaPlay to:')}</Para>
              <Bullet accent={ACCENTS[4]}>{t('termsUseBullet1', 'Violate any applicable laws or regulations.')}</Bullet>
              <Bullet accent={ACCENTS[4]}>{t('termsUseBullet2', 'Stream, share, or distribute illegal or pirated content.')}</Bullet>
              <Bullet accent={ACCENTS[4]}>{t('termsUseBullet3', 'Harass, bully, or abuse other users.')}</Bullet>
              <Bullet accent={ACCENTS[4]}>{t('termsUseBullet4', 'Share adult, explicit, or pornographic content.')}</Bullet>
              <Bullet accent={ACCENTS[4]}>{t('termsUseBullet5', 'Post hate speech or discriminatory content.')}</Bullet>
              <Bullet accent={ACCENTS[4]}>{t('termsUseBullet6', 'Spam or send unsolicited messages.')}</Bullet>
              <Bullet accent={ACCENTS[4]}>{t('termsUseBullet7', 'Impersonate other users or entities.')}</Bullet>
              <Bullet accent={ACCENTS[4]}>{t('termsUseBullet8', 'Attempt to hack, exploit, or disrupt the service.')}</Bullet>
              <Bullet accent={ACCENTS[4]}>{t('termsUseBullet9', 'Share private information about other users.')}</Bullet>
              <Bullet accent={ACCENTS[4]}>{t('termsUseBullet10', 'Exploit or abuse minors in any way.')}</Bullet>
              <Bullet accent={ACCENTS[4]}>{t('termsUseBullet11', 'Use the service for any commercial purpose without our written permission.')}</Bullet>
              <Bullet accent={ACCENTS[4]}>{t('termsUseBullet12', 'Create new accounts to evade suspensions, restrictions, or bans imposed by SahaPlay.')}</Bullet>
              <Bullet accent={ACCENTS[4]}>{t('termsUseBullet13', 'Use automated scripts, bots, or tools to interact with the service without permission.')}</Bullet>
              <div style={{
                marginTop: 14, padding: '12px 16px',
                background: isLight ? 'rgba(var(--brand-1-rgb),0.06)' : 'rgba(var(--brand-1-rgb),0.09)',
                border: `1px solid ${isLight ? 'rgba(var(--brand-1-rgb),0.15)' : 'rgba(var(--brand-1-rgb),0.22)'}`,
                borderRadius: 10, fontSize: 13, color: textBody,
              }}>
                {t('termsUseSafetyGuidelines', 'We have a detailed Safety and Community Guidelines page at')}{' '}
                <Link to="/safety" style={{ color: 'var(--brand-1-light)', textDecoration: 'none', fontWeight: 600 }}>
                  www.sahaplay.com/safety
                </Link>
              </div>
            </SectionCard>

            {/* 6 — Copyright & IP */}
            <SectionCard id="intellectual-property" num={6} Icon={Scale} accent={ACCENTS[5]}>
              <Bullet accent={ACCENTS[5]}>
                {t('termsIpBullet1', 'All content, logos, design, trademarks, and visual elements of SahaPlay are the exclusive property of SahaPlay.')}
              </Bullet>
              <Bullet accent={ACCENTS[5]}>
                {t('termsIpBullet2', 'Users may not copy, reproduce, distribute, or create derivative works from SahaPlay content.')}
              </Bullet>
              <Bullet accent={ACCENTS[5]}>
                {t('termsIpBullet3', 'If you believe your copyright has been infringed, please send a DMCA notice to:')}{' '}
                <a href="mailto:contact@sahaplay.com" style={{ color: ACCENTS[5], textDecoration: 'none', fontWeight: 600 }}>contact@sahaplay.com</a>
              </Bullet>
              <Para>{t('termsIpIncludeNotice', 'Include in your notice:')}</Para>
              <Sub>{t('termsIpSub1', 'Description of the copyrighted work.')}</Sub>
              <Sub>{t('termsIpSub2', 'Location of the infringing content on our service.')}</Sub>
              <Sub>{t('termsIpSub3', 'Your contact details.')}</Sub>
              <Sub>{t('termsIpSub4', 'A statement of good faith belief.')}</Sub>
            </SectionCard>

            {/* 7 — Privacy */}
            <SectionCard id="privacy" num={7} Icon={Lock} accent={ACCENTS[6]}>
              <Para>{t('termsPrivacyPara1', 'Your use of SahaPlay is also governed by our Privacy Policy, available at:')}</Para>
              <div style={{ marginBottom: 14 }}>
                <a
                  href="https://www.iubenda.com/privacy-policy/25516226"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    color: ACCENTS[6], textDecoration: 'none', fontWeight: 600, fontSize: 14,
                  }}
                >
                  🔗 {t('termsPrivacyLinkText', 'Privacy Policy')}
                </a>
              </div>
              <Para>{t('termsPrivacyPara2', 'By using SahaPlay you agree to our Privacy Policy.')}</Para>
            </SectionCard>

            {/* 8 — Third Party Services */}
            <SectionCard id="third-party" num={8} Icon={Database} accent={ACCENTS[7]}>
              <Para>
                {t('termsThirdPara1', 'SahaPlay integrates with third party services including Supabase for database and authentication. These services have their own terms and privacy policies. We are not responsible for third party services or content accessed through our platform.')}
              </Para>
              <Para>
                {t('termsThirdPara2', 'Users may access external content (YouTube, Netflix, Twitch etc.) through SahaPlay. We have no control over such content and are not responsible for it.')}
              </Para>
            </SectionCard>

            {/* 8B — Chat Messages & User Communications */}
            <SectionCard id="chat-messages" num="8B" Icon={MessageSquare} accent="#ec4899">
              <Para>
                {t('termsChatPara1', 'SahaPlay provides end-to-end encrypted private messaging features. Due to the nature of end-to-end encryption:')}
              </Para>
              <Bullet accent="#ec4899">
                {t('termsChatBullet1', 'Private messages between users are encrypted on the sender\'s device and can only be decrypted by the intended recipient. SahaPlay cannot access, read, monitor, or moderate the content of private encrypted messages.')}
              </Bullet>
              <Bullet accent="#ec4899">
                {t('termsChatBullet2', 'Users are solely responsible for all content they send through private chats, group room chats, and any other communication features.')}
              </Bullet>
              <Bullet accent="#ec4899">
                {t('termsChatBullet3', 'SahaPlay is not liable for any content exchanged between users in private or group communications.')}
              </Bullet>
              <Bullet accent="#ec4899">
                {t('termsChatBullet4', 'Users must not use chat features to share illegal content, threaten others, share non-consensual intimate images, or engage in any activity that violates these Terms or applicable law.')}
              </Bullet>
              <Bullet accent="#ec4899">
                {t('termsChatBullet5', 'Room chat messages and content shared within public or private rooms are the sole responsibility of the users who created them.')}
              </Bullet>
              <Bullet accent="#ec4899">
                {t('termsChatBullet6Part1', 'If you receive harmful, illegal, or abusive messages through SahaPlay, please report them immediately at')}{' '}
                <a href="mailto:contact@sahaplay.com" style={{ color: '#ec4899', textDecoration: 'none', fontWeight: 600 }}>
                  contact@sahaplay.com
                </a>{' '}
                {t('termsChatBullet6Part2', 'or through our')}{' '}
                <Link to="/safety" style={{ color: '#ec4899', textDecoration: 'none', fontWeight: 600 }}>
                  {t('termsChatBullet6Part3', 'Safety Center at www.sahaplay.com/safety')}
                </Link>
              </Bullet>
              <Para>
                {t('termsChatPinPara', 'Users are solely responsible for safeguarding their Chat Lock PIN and Master Recovery Key. If both the PIN and Master Key are lost and email reset is unavailable, locked chat data may become permanently unrecoverable. SahaPlay cannot restore deleted or inaccessible locked chat data.')}
              </Para>
            </SectionCard>

            {/* 8C — Streaming & Shared Content */}
            <SectionCard id="streaming-content" num="8C" Icon={Play} accent="#f97316">
              <Para>
                {t('termsStreamPara1', 'SahaPlay provides tools that allow users to synchronize, view, share, and discuss media content.')}
              </Para>
              <Para>
                {t('termsStreamPara2', 'Users are solely responsible for ensuring that any content they upload, stream, share, or make available through SahaPlay complies with applicable copyright laws, licenses, and permissions.')}
              </Para>
              <Para>
                {t('termsStreamPara3', 'SahaPlay does not verify ownership, licensing rights, or legal authorization for content shared or streamed by users.')}
              </Para>
              <Para>
                {t('termsStreamPara4', 'Users assume full legal responsibility for any copyright claims, legal disputes, takedown requests, or violations arising from content they share or stream through the platform.')}
              </Para>
              <Para>
                {t('termsStreamPara5Part1', 'SahaPlay cooperates with copyright holders and will act on valid DMCA notices sent to')}{' '}
                <a href="mailto:contact@sahaplay.com" style={{ color: '#f97316', textDecoration: 'none', fontWeight: 600 }}>
                  contact@sahaplay.com
                </a>
              </Para>
            </SectionCard>

            {/* 9 — Disclaimers */}
            <SectionCard id="disclaimers" num={9} Icon={AlertTriangle} accent={ACCENTS[8]}>
              <Para>{t('termsDiscPara1', 'SahaPlay is provided "as is" and "as available" without warranties of any kind.')}</Para>
              <Para>{t('termsDiscPara2', 'To the maximum extent permitted by law, SahaPlay shall not be liable for:')}</Para>
              <Bullet accent={ACCENTS[8]}>{t('termsDiscBullet1', 'Any indirect, incidental, or consequential damages.')}</Bullet>
              <Bullet accent={ACCENTS[8]}>{t('termsDiscBullet2', 'Loss of data, profits, or business opportunities.')}</Bullet>
              <Bullet accent={ACCENTS[8]}>{t('termsDiscBullet3', 'Service interruptions or malfunctions.')}</Bullet>
              <Bullet accent={ACCENTS[8]}>{t('termsDiscBullet4', 'Content uploaded or shared by users.')}</Bullet>
              <Bullet accent={ACCENTS[8]}>{t('termsDiscBullet5', 'Actions of third party services.')}</Bullet>
              <Bullet accent={ACCENTS[8]}>
                {t('termsDiscBullet6', 'Any damages exceeding the amount paid by you to SahaPlay in the past 12 months (if any).')}
              </Bullet>
              <div style={{
                marginTop: 14, padding: '12px 16px',
                background: isLight ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.22)',
                borderRadius: 10, fontSize: 13, color: textBody, lineHeight: 1.65,
              }}>
                {t('termsDiscExcludes', 'Nothing in these Terms excludes liability for fraud, death, or personal injury caused by our negligence.')}<br />
                <strong style={{ color: textPrimary }}>{t('termsDiscEuUkUsers', 'EU/UK Users:')}</strong>{' '}
                {t('termsDiscConsumerRights', 'Nothing in these Terms affects your statutory rights as a consumer.')}
              </div>
            </SectionCard>

            {/* 10 — Service Interruptions */}
            <SectionCard id="interruptions" num={10} Icon={Clock} accent={ACCENTS[9]}>
              <Para>
                {t('termsIntPara1', 'We reserve the right to interrupt, modify, or discontinue the service at any time for maintenance, updates, or any other reason.')}
              </Para>
              <Para>
                {t('termsIntPara2', 'We will endeavor to provide 30 days notice before any significant changes or discontinuation where reasonably possible.')}
              </Para>
              <Para>
                {t('termsIntPara3', 'We do not guarantee that the service will be uninterrupted, error-free, secure, or available at all times. Features may be modified, removed, suspended, or discontinued at any time without liability to users.')}
              </Para>
            </SectionCard>

            {/* 10B — Data Loss */}
            <SectionCard id="data-loss" num="10B" Icon={HardDrive} accent="#8b5cf6">
              <Para>
                {t('termsDataLossPara1', 'Users are responsible for maintaining backups of any important information they wish to preserve.')}
              </Para>
              <Para>{t('termsDataLossNotResponsible', 'SahaPlay is not responsible for:')}</Para>
              <Bullet accent="#8b5cf6">{t('termsDataLossBullet1', 'Lost, deleted, or expired messages')}</Bullet>
              <Bullet accent="#8b5cf6">{t('termsDataLossBullet2', 'Deleted or inactive rooms')}</Bullet>
              <Bullet accent="#8b5cf6">{t('termsDataLossBullet3', 'Corrupted or inaccessible data')}</Bullet>
              <Bullet accent="#8b5cf6">{t('termsDataLossBullet4', 'Unrecoverable locked chat data')}</Bullet>
              <Bullet accent="#8b5cf6">{t('termsDataLossBullet5', 'Any data loss caused by user actions, account termination, or service interruption')}</Bullet>
            </SectionCard>

            {/* 10C — Moderation and Enforcement */}
            <SectionCard id="moderation" num="10C" Icon={Flag} accent="#ef4444">
              <Para>
                {t('termsModerationPara1', 'SahaPlay reserves the right to take moderation and safety actions including warnings, content removal, account suspension, and permanent bans.')}
              </Para>
              <Para>
                {t('termsModerationPara2', 'Such actions may be performed through automated systems, manual review by our team, or a combination of both. We are not obligated to provide advance notice before taking enforcement action in cases of serious violations.')}
              </Para>
            </SectionCard>

            {/* 11 — Changes to Terms */}
            <SectionCard id="changes" num={11} Icon={Edit} accent={ACCENTS[10]}>
              <Para>
                {t('termsChangePara1', 'We reserve the right to modify these Terms at any time. We will notify users of changes by updating the "Last Updated" date at the top of this page.')}
              </Para>
              <Para>
                {t('termsChangePara2', 'Continued use of SahaPlay after changes constitutes acceptance of the new Terms.')}
              </Para>
            </SectionCard>

            {/* 12 — Age Restrictions */}
            <SectionCard id="age" num={12} Icon={Users} accent={ACCENTS[11]}>
              <Para>
                {t('termsAgePara1', 'SahaPlay is intended for users aged 13 and above. Users under 18 must have parental or guardian supervision. We do not knowingly collect data from children under 13.')}
              </Para>
              <Para>
                {t('termsAgePara2Part1', 'If you believe a child under 13 has registered, please contact us at')}{' '}
                <a href="mailto:contact@sahaplay.com" style={{ color: ACCENTS[11], textDecoration: 'none', fontWeight: 600 }}>
                  contact@sahaplay.com
                </a>
              </Para>
            </SectionCard>

            {/* 13 — Governing Law */}
            <SectionCard id="governing-law" num={13} Icon={Globe} accent={ACCENTS[12]}>
              <Para>
                {t('termsGovPara1', 'These Terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of the courts of Andhra Pradesh, India.')}
              </Para>
              <div style={{
                padding: '12px 16px',
                background: isLight ? 'rgba(var(--brand-1-rgb),0.06)' : 'rgba(var(--brand-1-rgb),0.09)',
                border: `1px solid ${isLight ? 'rgba(var(--brand-1-rgb),0.15)' : 'rgba(var(--brand-1-rgb),0.22)'}`,
                borderRadius: 10, fontSize: 13, color: textBody,
              }}>
                {t('termsGovEuUkConsumers', 'For EU/UK consumers: This does not affect your rights under the laws of your country of residence.')}
              </div>
            </SectionCard>

            {/* 14 — Severability */}
            <SectionCard id="severability" num={14} Icon={Layers} accent={ACCENTS[13]}>
              <Para>
                {t('termsSevPara1', 'If any provision of these Terms is found invalid or unenforceable, the remaining provisions will continue in full force and effect.')}
              </Para>
            </SectionCard>

            {/* 14B — Future Paid Services */}
            <SectionCard id="future-paid" num="14B" Icon={CreditCard} accent="#10b981">
              <Para>
                {t('termsPaidPara1', 'SahaPlay is currently free to use. Certain features or plans may become paid in the future.')}
              </Para>
              <Para>{t('termsPaidIfIntroduced', 'If paid features are introduced:')}</Para>
              <Bullet accent="#10b981">{t('termsPaidBullet1', 'Clear pricing will be displayed before purchase')}</Bullet>
              <Bullet accent="#10b981">{t('termsPaidBullet2', 'Billing and cancellation terms will be provided')}</Bullet>
              <Bullet accent="#10b981">{t('termsPaidBullet3', 'Existing free features will be clearly identified')}</Bullet>
              <Bullet accent="#10b981">{t('termsPaidBullet4', 'No charges will occur without your explicit consent')}</Bullet>
            </SectionCard>

            {/* 15 — Contact Us */}
            <SectionCard id="contact-us" num={15} Icon={Mail} accent={ACCENTS[14]}>
              <Para>{t('termsContactPara1', 'For any questions about these Terms:')}</Para>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${ACCENTS[14]}1a`, border: `1px solid ${ACCENTS[14]}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Mail size={14} color={ACCENTS[14]} />
                  </div>
                  <a href="mailto:contact@sahaplay.com" style={{ color: ACCENTS[14], textDecoration: 'none', fontSize: 15, fontWeight: 600 }}>
                    contact@sahaplay.com
                  </a>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${ACCENTS[14]}1a`, border: `1px solid ${ACCENTS[14]}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Globe size={14} color={ACCENTS[14]} />
                  </div>
                  <Link to="/contact" style={{ color: ACCENTS[14], textDecoration: 'none', fontSize: 15, fontWeight: 600 }}>
                    www.sahaplay.com/contact
                  </Link>
                </div>
              </div>
            </SectionCard>

          </div>
        </section>

        {/* ══ CTA ════════════════════════════════════════════════════════ */}
        <section
          className="gcw-force-dark hiw-section"
          style={{ background: 'linear-gradient(135deg, var(--brand-1-deep), var(--brand-2-deep))', padding: '80px 0' }}
        >
          <div className="hiw-container" style={{ textAlign: 'center', maxWidth: 580, margin: '0 auto' }}>
            <FileText size={44} color="var(--brand-1-light)" style={{ marginBottom: 20 }} />
            <h2 className="stay-white" style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, marginBottom: 12, color: '#fff' }}>
              {t('termsCtaTitle', 'Questions About Our Terms?')}
            </h2>
            <p className="stay-white" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, maxWidth: 440, margin: '0 auto 32px', lineHeight: 1.6 }}>
              {t('termsCtaDesc', 'If you have any questions or need clarification about these Terms and Conditions, our team is here to help.')}
            </p>
            <Link
              to="/contact"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '14px 32px',
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 50, color: '#ffffff',
                fontSize: 15, fontWeight: 600, textDecoration: 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            >
              <Mail size={16} color="#fff" /> {t('termsCtaBtn', 'Contact Us')} →
            </Link>
          </div>
        </section>

      </div>
      {!isStandalonePWA() && <Footer />}

      {/* ══ BACK TO TOP ═══════════════════════════════════════════════ */}
      {showBackToTop && (
        <button
          className="back-to-top-btn"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            zIndex: 999,
            padding: '10px 22px', borderRadius: 50,
            background: 'var(--brand-gradient)',
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
