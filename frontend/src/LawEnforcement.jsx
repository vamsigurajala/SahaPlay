import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Scale, Lock, ShieldCheck, ShieldOff, Mail, Clock, Database,
  FileWarning, AlertTriangle, CheckCircle2, XCircle, ChevronUp, Send
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SeoHead from './components/SeoHead';

export default function LawEnforcement() {
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
  const bodyText = isLight ? '#374151' : 'rgba(255,255,255,0.85)';

  const cardStyle = {
    background: isLight ? '#ffffff' : '#1e1e30',
    border: `1px solid ${isLight ? 'rgba(var(--brand-1-rgb),0.22)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 16,
    padding: 28,
    boxShadow: isLight ? '0 4px 24px rgba(var(--brand-1-rgb),0.12)' : 'none',
  };

  const sec1Bg = isLight ? '#ffffff' : '#09090b';
  const sec2Bg = isLight ? '#f8f7ff' : '#13131f';
  const sec3Bg = isLight ? '#ffffff' : '#09090b';

  const canProvide = [
    {
      title: t('leAccountTitle', 'Basic account information'),
      items: [
        t('leAccountItem1', 'Username, display name, and email address (if provided)'),
        t('leAccountItem2', 'Account creation date and most recent login timestamp'),
        t('leAccountItem3', 'Country, derived automatically at signup — we do not store IP addresses on the account'),
      ],
    },
    {
      title: t('leRoomTitle', 'Room metadata'),
      items: [
        t('leRoomItem1', 'Room name, room ID, host account, creation date, and public/private setting'),
        t('leRoomItem2', "We do not keep a membership roster — who is currently in a room is tracked live in memory, never written to a database. The only durable trace of a room's participants is whichever accounts actually sent a message in it."),
      ],
    },
    {
      title: t('leMessageMetaTitle', 'Message metadata'),
      items: [
        t('leMessageMetaItem1', 'For a specific message or conversation: timestamp, sender account, the room or conversation identifier, and delivery/read-receipt timestamps'),
        t('leMessageMetaItem2', 'This is metadata only — see the next section for what is structurally excluded'),
      ],
    },
    {
      title: t('leModTitle', 'Moderation records'),
      items: [
        t('leModItem1', 'Reports filed against or by an account, and active bans — where directly relevant to a specific request'),
      ],
    },
  ];

  const cannotProvide = [
    t('leCannotItem1', 'Direct message content'),
    t('leCannotItem2', 'Group chat message content'),
    t('leCannotItem3', 'Photos, videos, voice notes, and any other files sent in a chat'),
  ];

  const retentionRows = [
    { label: t('leRetLabel1', 'Photos'), value: t('leRetValue1', '30 days after being sent, then permanently deleted') },
    { label: t('leRetLabel2', 'Voice notes & other audio'), value: t('leRetValue2', '14 days after being sent, then permanently deleted') },
    { label: t('leRetLabel3', 'Videos, documents & other files'), value: t('leRetValue3', '7 days after being sent, then permanently deleted') },
    { label: t('leRetLabel4', 'Message metadata (timestamp, sender, room)'), value: t('leRetValue4', 'Purged automatically once a conversation has gone 12 months without a new message') },
    { label: t('leRetLabel5', 'Deleted accounts'), value: t('leRetValue5', 'Removing an account also removes the messages that account sent. Messages other people sent to a deleted account may remain until the 12-month inactivity purge clears them.') },
  ];

  return (
    <div className="page-enter" style={{ minHeight: '100vh', background: pageBg, color: textPrimary }}>
      <SeoHead path="/legal/law-enforcement" />
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
              <Scale size={14} style={{ marginRight: 2 }} /> {t('lePageBadge', 'Legal & Compliance')}
            </div>

            <h1 style={{
              fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, lineHeight: 1.1,
              marginBottom: 20,
              WebkitTextFillColor: isLight ? '#111' : 'unset',
              color: isLight ? '#111' : '#f8f9fa',
            }}>
              {t('lePageTitlePart1', 'Law Enforcement')}{' '}
              <span style={{
                background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {t('lePageTitlePart2', 'Guidelines')}
              </span>
            </h1>

            <p style={{ maxWidth: 700, margin: '0 auto 30px', color: textMuted, fontSize: 17, lineHeight: 1.6 }}>
              {t('leHeroDesc', "What SahaPlay can and cannot provide in response to a government or law enforcement request, and how our architecture shapes the answer.")}
            </p>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: isLight ? 'rgba(var(--brand-1-rgb),0.06)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${isLight ? 'rgba(var(--brand-1-rgb),0.15)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 8, padding: '6px 16px',
              fontSize: 12, fontWeight: 500, color: textMuted,
            }}>
              {t('leLastUpdated', 'Last Updated: August 2026')}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 2 — ARCHITECTURE, IN BRIEF
        ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec2Bg }}>
          <div className="hiw-container">
            <div style={{
              ...cardStyle, maxWidth: 820, margin: '0 auto',
              display: 'flex', gap: 24, alignItems: 'center',
              flexDirection: isMobile ? 'column' : 'row',
              borderTop: '3px solid #6366f1',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Lock size={32} color="#818cf8" />
              </div>
              <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, color: textPrimary }}>
                  {t('leArchTitle', 'Our architecture, in brief')}
                </h2>
                <p style={{ color: bodyText, fontSize: 15, lineHeight: 1.7, margin: 0 }}>
                  {t('leArchDesc', "One-on-one chats, group chats, and any media or voice notes sent through SahaPlay are end-to-end encrypted. Encryption and decryption happen only on the devices of the people in the conversation, using keys that are generated on-device and never leave it. SahaPlay's servers store and relay ciphertext — data that is meaningless without a key we do not have. This shapes everything below: it is not a policy choice we could waive, it's how the system is built.")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 3 — WHAT WE CAN PROVIDE
        ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec3Bg }}>
          <div className="hiw-container">
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, marginBottom: 12, color: textPrimary }}>
                {t('leCanTitle', 'What we can provide, given valid legal process')}
              </h2>
              <p style={{ color: textMuted, fontSize: 16, maxWidth: 600, margin: '0 auto' }}>
                {t('leCanDesc', 'Account and metadata records our servers actually hold.')}
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 24, maxWidth: 900, margin: '0 auto',
            }}>
              {canProvide.map((group, idx) => (
                <div key={idx} style={{ ...cardStyle, borderTop: '3px solid #10b981' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: 'rgba(16,185,129,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CheckCircle2 size={18} color="#10b981" />
                    </div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: textPrimary, margin: 0 }}>{group.title}</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {group.items.map((line, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: bodyText }}>
                        <span style={{ color: '#10b981', fontWeight: 'bold', marginTop: 1 }}>&#8226;</span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 4 — WHAT WE CANNOT PROVIDE
        ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec2Bg }}>
          <div className="hiw-container">
            <div style={{
              ...cardStyle, maxWidth: 820, margin: '0 auto', borderTop: '3px solid #ef4444',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: 'rgba(239,68,68,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <ShieldOff size={22} color="#ef4444" />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: textPrimary, margin: 0 }}>
                  {t('leCannotTitle', 'What we cannot provide, under any circumstances')}
                </h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {cannotProvide.map((line, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 15, color: bodyText }}>
                    <XCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{line}</span>
                  </div>
                ))}
              </div>

              <p style={{ color: bodyText, fontSize: 15, lineHeight: 1.7, margin: 0 }}>
                {t('leCannotDesc', 'All of it is encrypted on a device before it ever reaches our servers, using per-message keys that only the participants’ own devices hold. Our infrastructure never has the keys needed to decrypt any of it — not for us, and not for anyone presenting us with a warrant, subpoena, or court order. We cannot produce content we are structurally unable to access, regardless of the legal instrument compelling us.')}
              </p>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 5 — DATA RETENTION
        ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec3Bg }}>
          <div className="hiw-container">
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, marginBottom: 12, color: textPrimary }}>
                {t('leRetentionTitle', 'Data retention')}
              </h2>
              <p style={{ color: textMuted, fontSize: 16, maxWidth: 600, margin: '0 auto' }}>
                {t('leRetentionDesc', "We don't keep things longer than we have to. Everything below deletes itself on a schedule — no manual request required.")}
              </p>
            </div>

            <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {retentionRows.map((row, i) => (
                <div key={i} style={{
                  ...cardStyle, padding: '18px 24px',
                  display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 8 : 24,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: isMobile ? 'auto' : 300 }}>
                    <Clock size={16} color="var(--brand-1-light)" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: textPrimary }}>{row.label}</span>
                  </div>
                  <span style={{ fontSize: 14, color: bodyText, lineHeight: 1.6 }}>{row.value}</span>
                </div>
              ))}
            </div>

            <p style={{ textAlign: 'center', maxWidth: 700, margin: '28px auto 0', color: textMuted, fontSize: 14, lineHeight: 1.6 }}>
              {t('leRetentionNote', 'We do not maintain backups or archives beyond what is described here. If your investigation needs data preserved past its normal expiry pending formal legal process, see the preservation-request note below.')}
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 6 — HOW TO SUBMIT A REQUEST
        ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{ background: sec2Bg }}>
          <div className="hiw-container">
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, marginBottom: 12, color: textPrimary }}>
                {t('leSubmitTitle', 'How to submit a request')}
              </h2>
            </div>

            <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ ...cardStyle, borderTop: '3px solid var(--brand-1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <Mail size={20} color="var(--brand-1-light)" />
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: textPrimary, margin: 0 }}>
                    {t('leSubmitWhere', 'Send requests to')}
                  </h3>
                </div>
                <a
                  href="mailto:legal@sahaplay.com"
                  style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-1-light)', textDecoration: 'none' }}
                >
                  legal@sahaplay.com
                </a>
                <p style={{ color: bodyText, fontSize: 14, lineHeight: 1.6, marginTop: 12, marginBottom: 0 }}>
                  {t('leSubmitFromDomain', 'Requests must come from an official government or law enforcement email domain — we cannot act on requests sent from personal email addresses.')}
                </p>
              </div>

              <div style={{ ...cardStyle, borderTop: '3px solid #3b82f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <FileWarning size={20} color="#3b82f6" />
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: textPrimary, margin: 0 }}>
                    {t('leSubmitIncludeTitle', 'Include in every request')}
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    t('leSubmitInclude1', 'The legal authority compelling disclosure (subpoena, court order, search warrant, or the equivalent for your jurisdiction)'),
                    t('leSubmitInclude2', 'The specific SahaPlay username(s), room ID(s), or timeframe in question'),
                    t('leSubmitInclude3', 'A return address or case contact for our response'),
                  ].map((line, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: bodyText }}>
                      <span style={{ color: '#3b82f6', fontWeight: 'bold', marginTop: 1 }}>&#8226;</span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
                <p style={{ color: bodyText, fontSize: 14, lineHeight: 1.6, marginTop: 14, marginBottom: 0 }}>
                  {t('leSubmitScope', 'We will only ever provide what is described under "What we can provide" above. No legal instrument expands that scope, because the rest is not something our servers have.')}
                </p>
              </div>

              <div style={{ ...cardStyle, borderTop: '3px solid #f59e0b' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <AlertTriangle size={20} color="#f59e0b" />
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: textPrimary, margin: 0 }}>
                    {t('leEmergencyTitle', 'Emergency disclosure requests')}
                  </h3>
                </div>
                <p style={{ color: bodyText, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                  {t('leEmergencyDesc', 'If a request involves an imminent risk of death or serious physical harm, mark the subject line "Emergency Disclosure Request" and describe the nature of the emergency. We review these on an expedited basis — but the request still needs to describe genuine imminent danger, not general investigative interest.')}
                </p>
              </div>

              <div style={{ ...cardStyle, borderTop: '3px solid #a855f7' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <Database size={20} color="#a855f7" />
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: textPrimary, margin: 0 }}>
                    {t('lePreserveTitle', 'Preservation requests')}
                  </h3>
                </div>
                <p style={{ color: bodyText, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                  {t('lePreserveDesc', "If you're pursuing formal legal process and need account or metadata records preserved past their normal retention window in the meantime, send a preservation request to the same address, identifying the account or room and referencing the pending legal process.")}
                </p>
              </div>

              <div style={{ ...cardStyle, borderTop: '3px solid #10b981' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <ShieldCheck size={20} color="#10b981" />
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: textPrimary, margin: 0 }}>
                    {t('leNoticeTitle', 'User notification')}
                  </h3>
                </div>
                <p style={{ color: bodyText, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                  {t('leNoticeDesc', "Where legally permitted, we notify the affected account that a request for their data was made. We will not do so where a court order or law prohibits it, or where we believe notice would create a genuine safety risk.")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            SECTION 7 — CTA
        ══════════════════════════════════════════ */}
        <section className="hiw-section" style={{
          background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
          textAlign: 'center', paddingTop: 60, paddingBottom: 60,
        }}>
          <div className="hiw-container">
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 800, color: '#fff', marginBottom: 12 }}>
              {t('leCtaTitle', 'Questions about this policy?')}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, maxWidth: 520, margin: '0 auto 24px' }}>
              {t('leCtaDesc', 'General inquiries about this page should go through Contact Us — the legal address above is for official government and law enforcement requests only.')}
            </p>

            <Link
              to="/contact"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '14px 32px', background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: 50,
                color: '#ffffff', fontSize: 15, fontWeight: 600, textDecoration: 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            >
              <Send size={16} color="#fff" /> {t('leCtaBtn', 'Contact Us')} &rarr;
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
            zIndex: 999, padding: '10px 22px', borderRadius: 50,
            background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            color: '#fff', fontSize: 14, fontWeight: 600,
            boxShadow: '0 4px 20px rgba(var(--brand-1-rgb),0.5)',
            whiteSpace: 'nowrap',
          }}
        >
          <ChevronUp size={18} color="#fff" />
          {t('termsBackToTop', 'Back to Top')}
        </button>
      )}
    </div>
  );
}
