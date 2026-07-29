import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import {
  CheckCircle, AlertCircle, ChevronDown, Upload, X,
  Play, MessageSquare, Lock, Smartphone, Bell, Mic, Camera,
  Zap, Activity, Palette, Link, Shield, HelpCircle,
  AlertTriangle, Flame, Bug, Search, Home
} from 'lucide-react';
import { API } from './lib/api';

const BUG_TYPES = [
  { key: 'video-sync', Icon: Play,          color: '#6366f1', labelKey: 'rbTypeVideoSync',    fallback: 'Video / Sync Issue' },
  { key: 'chat',       Icon: MessageSquare,  color: '#3b82f6', labelKey: 'rbTypeChat',          fallback: 'Chat Not Working' },
  { key: 'login',      Icon: Lock,           color: '#10b981', labelKey: 'rbTypeLoginAccount',  fallback: 'Login / Account Problem' },
  { key: 'mobile',     Icon: Smartphone,     color: '#8b5cf6', labelKey: 'rbTypeMobileLayout',  fallback: 'Mobile / Responsive Layout' },
  { key: 'notif',      Icon: Bell,           color: '#f59e0b', labelKey: 'rbTypeNotifications', fallback: 'Notifications Not Working' },
  { key: 'audio',      Icon: Mic,            color: '#ec4899', labelKey: 'rbTypeAudioMic',      fallback: 'Audio / Microphone Issue' },
  { key: 'camera',     Icon: Camera,         color: '#06b6d4', labelKey: 'rbTypeCamScreen',     fallback: 'Camera / Screenshare Issue' },
  { key: 'crash',      Icon: Zap,            color: '#ef4444', labelKey: 'rbTypeCrash',         fallback: 'App Crashing / Freezing' },
  { key: 'perf',       Icon: Activity,       color: '#f97316', labelKey: 'rbTypePerf',          fallback: 'Performance / Slow Loading' },
  { key: 'ui',         Icon: Palette,        color: '#a855f7', labelKey: 'rbTypeUI',            fallback: 'UI / Visual Glitch' },
  { key: 'link',       Icon: Link,           color: '#14b8a6', labelKey: 'rbTypeLink',          fallback: 'Link / URL Problem' },
  { key: 'security',   Icon: Shield,         color: '#22c55e', labelKey: 'rbTypeSecurity',      fallback: 'Security Concern' },
  { key: 'other',      Icon: HelpCircle,     color: '#94a3b8', labelKey: 'rbTypeOther',         fallback: 'Other Bug' },
];

const SEVERITIES = [
  { key: 'minor',    Icon: AlertTriangle, color: '#f59e0b', labelKey: 'rbSeverityMinorLabel',    descKey: 'rbSeverityMinorDesc',    fallbackLabel: 'Minor',    fallbackDesc: 'Small annoyance, still usable' },
  { key: 'major',    Icon: Zap,          color: '#f97316', labelKey: 'rbSeverityMajorLabel',    descKey: 'rbSeverityMajorDesc',    fallbackLabel: 'Major',    fallbackDesc: 'Significantly affects my experience' },
  { key: 'critical', Icon: Flame,        color: '#ef4444', labelKey: 'rbSeverityCriticalLabel', descKey: 'rbSeverityCriticalDesc', fallbackLabel: 'Critical', fallbackDesc: 'App completely broken for me' },
];

const MAX_ATTACH = 5;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_ATT = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];

const getBorderColor = (hasError, isLight) =>
  hasError ? '#ef4444' : isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)';

const formatBytes = (b) =>
  b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

const getFileExt = (name, type) => {
  if (type === 'video/mp4') return 'MP4';
  if (type === 'video/webm') return 'WEBM';
  const ext = name.split('.').pop().toUpperCase();
  return ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP'].includes(ext)
    ? (ext === 'JPEG' ? 'JPG' : ext)
    : type.split('/')[1].toUpperCase();
};

export default function ReportBug() {
  const { t, i18n } = useTranslation();

  /* ── theme ── */
  const [theme, setTheme] = useState(() => localStorage.getItem('watch_theme') || 'dark');
  const isLight = theme === 'light';
  useEffect(() => {
    const h = () => setTheme(localStorage.getItem('watch_theme') || 'dark');
    window.addEventListener('theme_changed', h);
    return () => window.removeEventListener('theme_changed', h);
  }, []);

  /* ── form ── */
  const [form, setForm] = useState({
    name: '', email: '', bugType: '', severity: 'major',
    whatHappened: '', whatExpected: '', actualResult: '',
    stepsToReproduce: '', browser: '', os: '', screenSize: '',
    consoleErrors: '',
  });
  const [errors, setErrors] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [attachErr, setAttachErr] = useState('');
  const [dragging, setDragging] = useState(false);

  /* ── submit ── */
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [apiErr, setApiErr] = useState('');
  const [reportId, setReportId] = useState('');

  /* ── refs ── */
  const fileRef = useRef(null);
  const dragCount = useRef(0);
  const bugTypeRef = useRef(null);

  /* ── mobile ── */
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  /* ── hover states ── */
  const [hoveredRemove, setHoveredRemove] = useState(null);
  const [hoveredSuccessBtn, setHoveredSuccessBtn] = useState(null);

  /* ── bug type dropdown ── */
  const [bugTypeOpen, setBugTypeOpen] = useState(false);
  useEffect(() => {
    if (!bugTypeOpen) return;
    const handler = (e) => {
      if (bugTypeRef.current && !bugTypeRef.current.contains(e.target)) setBugTypeOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [bugTypeOpen]);

  /* ── auto-detect browser / OS / screen ── */
  useEffect(() => {
    const ua = navigator.userAgent;
    let browser = 'Unknown Browser';
    if (ua.includes('Edg/') || ua.includes('Edge/')) {
      const v = ua.match(/Edg\/([\d.]+)/);
      browser = `Edge ${v ? v[1].split('.')[0] : ''}`.trim();
    } else if (ua.includes('Chrome/') && !ua.includes('Edg')) {
      const v = ua.match(/Chrome\/([\d.]+)/);
      browser = `Chrome ${v ? v[1].split('.')[0] : ''}`.trim();
    } else if (ua.includes('Firefox/')) {
      const v = ua.match(/Firefox\/([\d.]+)/);
      browser = `Firefox ${v ? v[1].split('.')[0] : ''}`.trim();
    } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
      const v = ua.match(/Version\/([\d.]+)/);
      browser = `Safari ${v ? v[1].split('.')[0] : ''}`.trim();
    }

    let os = 'Unknown OS';
    if (ua.includes('Windows NT')) {
      os = 'Windows 11/10';
    } else if (ua.includes('Mac OS X')) {
      const v = ua.match(/Mac OS X ([\d_]+)/);
      os = `macOS ${v ? v[1].replace(/_/g, '.') : ''}`.trim();
    } else if (ua.includes('iPhone')) {
      const v = ua.match(/iPhone OS ([\d_]+)/);
      os = `iPhone iOS ${v ? v[1].replace(/_/g, '.') : ''}`.trim();
    } else if (ua.includes('Android')) {
      const v = ua.match(/Android ([\d.]+)/);
      os = `Android ${v ? v[1] : ''}`.trim();
    } else if (ua.includes('Linux')) {
      os = 'Linux';
    }

    const screenSize = `${window.innerWidth}x${window.innerHeight}`;
    setForm(f => ({ ...f, browser, os, screenSize }));
  }, []);

  /* ── prefill name + email from logged-in user ── */
  useEffect(() => {
    const token = localStorage.getItem('watch_token');
    if (!token) return;
    fetch(`${API}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data || data.isGuest) return;
        setForm(f => ({
          ...f,
          email: data.email || f.email,
          name: data.displayName || data.username || f.name,
        }));
      })
      .catch(() => { });
  }, []);

  /* ── theme tokens (exact same as Contact.jsx) ── */
  const pageBg = isLight ? 'linear-gradient(135deg,#f0f0f8 0%,#e8e8f5 50%,#f0f0f8 100%)' : '#09090b';
  const cardSt = isLight
    ? { background: '#ffffff', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }
    : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' };
  const labelSt = { display: 'block', fontSize: 12, fontWeight: 700, color: isLight ? '#6b7280' : '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px' };
  const errSt = { color: '#ef4444', fontSize: 12, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 };
  const cardBorder = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)';

  const inputBase = (hasErr) => ({
    width: '100%', boxSizing: 'border-box', padding: '12px 16px', borderRadius: 10,
    border: `1px solid ${getBorderColor(hasErr, isLight)}`,
    background: isLight ? '#f9f9ff' : 'rgba(255,255,255,0.04)',
    color: isLight ? '#111' : '#fff', fontSize: 14, outline: 'none',
    fontFamily: 'inherit', transition: 'border-color 0.2s',
  });
  const selectBase = (hasErr) => ({ ...inputBase(hasErr), background: isLight ? '#f9f9ff' : '#18181b' });
  const optionSt = { background: isLight ? '#f9f9ff' : '#18181b', color: isLight ? '#111' : '#fff' };
  const optionPlaceholderSt = { background: isLight ? '#f9f9ff' : '#18181b', color: isLight ? '#9ca3af' : '#6b7280' };

  /* ── validate ── */
  const validate = () => {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      e.name = t('rbNameError', 'Please enter your name (min 2 characters)');
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e.email = t('rbEmailError', 'Please enter a valid email address');
    if (!form.bugType)
      e.bugType = t('rbTypeError', 'Please select a bug type');
    if (!form.whatHappened.trim() || form.whatHappened.trim().length < 20)
      e.whatHappened = t('rbDoingError', 'Please describe what happened (min 20 characters)');
    if (!form.whatExpected.trim() || form.whatExpected.trim().length < 10)
      e.whatExpected = t('rbExpectError', 'Please describe what you expected (min 10 characters)');
    if (!form.actualResult.trim() || form.actualResult.trim().length < 10)
      e.actualResult = t('rbActualError', 'Please describe what actually happened (min 10 characters)');
    if (!form.browser.trim())
      e.browser = t('rbBrowserError', 'Please enter your browser');
    if (!form.os.trim())
      e.os = t('rbOsError', 'Please enter your operating system');
    return e;
  };

  /* ── file processing ── */
  const processFiles = useCallback((files) => {
    setAttachErr('');
    const slots = MAX_ATTACH - attachments.length;
    if (slots <= 0) {
      setAttachErr(t('rbAttachMax', 'Max {{max}} files allowed.', { max: MAX_ATTACH }));
      return;
    }
    const toAdd = [];
    let errMsg = '';
    for (const f of Array.from(files).slice(0, slots)) {
      if (!ALLOWED_ATT.includes(f.type)) {
        errMsg = t('rbAttachTypeError', 'Only JPG, PNG, GIF, WEBP, MP4, WEBM allowed.');
        continue;
      }
      if (f.size > MAX_BYTES) {
        errMsg = t('rbAttachSizeError', '"{{name}}" exceeds 10 MB limit.', { name: f.name });
        continue;
      }
      toAdd.push({ file: f, preview: URL.createObjectURL(f), name: f.name, type: f.type, size: f.size, isVideo: f.type.startsWith('video/') });
    }
    if (errMsg) setAttachErr(errMsg);
    if (toAdd.length) setAttachments(p => [...p, ...toAdd]);
  }, [attachments.length, t]);

  const removeAttachment = (i) => {
    setAttachments(p => { URL.revokeObjectURL(p[i].preview); return p.filter((_, j) => j !== i); });
    setAttachErr('');
  };

  /* ── drag & drop ── */
  const onDragEnter = (e) => { e.preventDefault(); dragCount.current++; setDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); dragCount.current--; if (dragCount.current === 0) setDragging(false); };
  const onDragOver = (e) => { e.preventDefault(); };
  const onDrop = (e) => { e.preventDefault(); dragCount.current = 0; setDragging(false); processFiles(e.dataTransfer.files); };

  /* ── base64 ── */
  const toB64 = (f) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

  /* ── submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      setTimeout(() => {
        document.querySelector('.rb-field-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }
    setErrors({});
    setStatus('loading');
    setApiErr('');

    try {
      const attachPayload = await Promise.all(
        attachments.map(async (att) => ({
          data: await toB64(att.file),
          type: att.type,
          name: att.name,
        }))
      );

      const res = await fetch(`${API}/api/report-bug`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          bugType: form.bugType,
          severity: form.severity,
          whatHappened: form.whatHappened.trim(),
          whatExpected: form.whatExpected.trim(),
          actualResult: form.actualResult.trim(),
          stepsToReproduce: form.stepsToReproduce.trim(),
          browser: form.browser.trim(),
          os: form.os.trim(),
          screenSize: form.screenSize.trim(),
          consoleErrors: form.consoleErrors.trim(),
          attachments: attachPayload,
          lang: i18n.language,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to submit bug report.');
      setReportId(data.reportId || 'BUG-XXXXXX');
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setApiErr(err.message);
    }
  };

  const resetForm = () => {
    attachments.forEach(att => URL.revokeObjectURL(att.preview));
    setForm({
      name: '', email: '', bugType: '', severity: 'major',
      whatHappened: '', whatExpected: '', actualResult: '',
      stepsToReproduce: '', browser: '', os: '',
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      consoleErrors: '',
    });
    setAttachments([]);
    setErrors({});
    setAttachErr('');
    setApiErr('');
    setReportId('');
    setStatus('idle');
  };

  // Find translated severity display text
  const currentSeverityObj = SEVERITIES.find(s => s.key === form.severity) || SEVERITIES[1];
  const severityText = t(currentSeverityObj.labelKey, currentSeverityObj.fallbackLabel);

  // Find translated bug type display text
  const currentBugTypeObj = BUG_TYPES.find(b => b.key === form.bugType);
  const bugTypeText = currentBugTypeObj
    ? t(currentBugTypeObj.labelKey, currentBugTypeObj.fallback)
    : form.bugType;

  /* ══════════════════════════════════════════════════════
     SUCCESS STATE
  ══════════════════════════════════════════════════════ */
  if (status === 'success') {
    return (
      <div className="page-enter" style={{ minHeight: '100vh', background: pageBg, display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '40px 12px' : '60px 24px' }}>
          <div style={{ ...cardSt, borderRadius: 20, padding: isMobile ? '40px 24px' : '60px 48px', textAlign: 'center', maxWidth: 540, width: '100%', animation: 'fadeInUp 0.4s ease' }}>

            {/* Icon */}
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(var(--brand-1-rgb),0.15)', border: '2px solid rgba(var(--brand-1-rgb),0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', animation: 'popIn 0.4s ease' }}>
              <CheckCircle size={40} color="var(--brand-1-light)" strokeWidth={2} />
            </div>

            {/* Title */}
            <h2 style={{ fontSize: isMobile ? 24 : 30, fontWeight: 900, color: '#fff', margin: '0 0 16px', letterSpacing: '-0.5px' }}>
              {t('rbSuccessTitle', 'Bug Report Submitted!')}
            </h2>

            {/* Personalized message */}
            <p style={{ fontSize: 15, color: isLight ? '#4a5568' : '#9ca3af', lineHeight: 1.8, margin: '0 0 20px' }}>
              {t('rbSuccessThanks', 'Thanks {{name}}!', { name: form.name })}{' '}
              {t('rbSuccessBody', "We received your {{severity}} bug report about {{bugType}} and will investigate it right away. We'll update you at {{email}}.", {
                severity: severityText,
                bugType: bugTypeText,
                email: form.email
              })}
            </p>

            {/* Report ID pill */}
            <div style={{ display: 'inline-block', background: isLight ? 'rgba(var(--brand-1-rgb),0.08)' : 'rgba(var(--brand-1-rgb),0.12)', border: '1px solid rgba(var(--brand-1-rgb),0.25)', borderRadius: 8, padding: '8px 18px', marginBottom: 28, fontFamily: "'Courier New', monospace", fontSize: 14, fontWeight: 700, color: 'var(--brand-1-light)', letterSpacing: '0.5px' }}>
              {t('rbReportId', 'Report ID: {{reportId}}', { reportId })}
            </div>

            {/* What happens next */}
            <div style={{ background: isLight ? 'rgba(var(--brand-1-rgb),0.06)' : 'rgba(var(--brand-1-rgb),0.08)', border: '1px solid rgba(var(--brand-1-rgb),0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 32, textAlign: 'left' }}>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--brand-1-light)', margin: '0 0 12px' }}>
                {t('rbNextTitle', 'What happens next')}
              </p>
              {[
                t('rbNextStep1', '🔍 Our team will investigate your report'),
                t('rbNextStep2', '⚡ Critical bugs are prioritized immediately'),
                t('rbNextStep3', "📧 We'll email you when it's fixed"),
                t('rbNextStep4', '🔄 You may be contacted for more details'),
              ].map((item, i) => (
                <div key={i} style={{ fontSize: 14, color: isLight ? '#374151' : '#9ca3af', marginBottom: i < 3 ? 8 : 0, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  {item}
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
              <button
                onClick={resetForm}
                onMouseEnter={() => setHoveredSuccessBtn('secondary')}
                onMouseLeave={() => setHoveredSuccessBtn(null)}
                style={{
                  flex: 1, padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${hoveredSuccessBtn === 'secondary' ? 'rgba(var(--brand-1-rgb),0.45)' : cardBorder}`,
                  background: hoveredSuccessBtn === 'secondary' ? 'rgba(var(--brand-1-rgb),0.08)' : 'transparent',
                  color: hoveredSuccessBtn === 'secondary' ? 'var(--brand-1-light)' : (isLight ? '#374151' : '#9ca3af'),
                  transform: hoveredSuccessBtn === 'secondary' ? 'translateY(-2px)' : 'translateY(0)',
                  transition: 'all 0.18s ease',
                }}
              >
                {t('rbReportAnother', 'Report Another Bug')}
              </button>
              <button
                className="stay-white"
                onClick={() => { window.location.href = '/'; }}
                onMouseEnter={() => setHoveredSuccessBtn('primary')}
                onMouseLeave={() => setHoveredSuccessBtn(null)}
                style={{
                  flex: 1, padding: '12px 20px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
                  color: '#fff',
                  transform: hoveredSuccessBtn === 'primary' ? 'translateY(-2px)' : 'translateY(0)',
                  boxShadow: hoveredSuccessBtn === 'primary' ? '0 8px 20px rgba(var(--brand-1-rgb),0.4)' : '0 0px 0px transparent',
                  opacity: hoveredSuccessBtn === 'primary' ? 0.9 : 1,
                  transition: 'all 0.18s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Home size={16} color="#fff" />
                <span className="stay-white" style={{ color: '#fff' }}>{t('rbBackHome', 'Back to Home')}</span>
              </button>
            </div>

          </div>
        </main>
        <Footer />
        <style>{`
          @keyframes fadeInUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
          @keyframes popIn { 0% { transform:scale(0); opacity:0; } 70% { transform:scale(1.1); } 100% { transform:scale(1); opacity:1; } }
        `}</style>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════
     MAIN PAGE
  ══════════════════════════════════════════════════════ */
  return (
    <div className="page-enter" style={{ minHeight: '100vh', background: pageBg, display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: isMobile ? '48px 12px 80px' : '72px 24px 100px' }}>

        {/* ── Badge ── */}
        <div className="rb-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: isLight ? 'rgba(var(--brand-1-rgb),0.1)' : 'rgba(var(--brand-1-rgb),0.12)', border: `1px solid rgba(var(--brand-1-rgb),${isLight ? '0.3' : '0.25'})`, color: isLight ? 'var(--brand-1-dark)' : 'var(--brand-1-light)', padding: '6px 18px', borderRadius: 100, fontSize: 13, fontWeight: 700, letterSpacing: '0.3px', marginBottom: 28 }}>
          <Bug size={14} /> {t('rbBadge', 'Bug Report')}
        </div>

        {/* ── Title ── */}
        <h1 style={{ fontSize: 'clamp(28px,5vw,48px)', fontWeight: 900, textAlign: 'center', margin: '0 0 16px', color: isLight ? '#111' : '#fff', letterSpacing: '-1px', lineHeight: 1.1 }}>
          {t('rbTitle', 'Found a Bug?')}
        </h1>
        <p style={{ textAlign: 'center', fontSize: 16, lineHeight: 1.8, color: isLight ? '#4a5568' : '#9ca3af', maxWidth: 500, margin: '0 0 24px' }}>
          {t('rbSubtitle', "Help us fix it. Describe what went wrong and we'll investigate as soon as possible.")}
        </p>

        {/* ── Info pills ── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 48 }}>
          {[
            { Icon: Search, text: t('rbInfoPillReviewed', 'Every report is reviewed') },
            { Icon: Zap,    text: t('rbInfoPillFast',     'Fast response for critical bugs') },
            { Icon: Lock,   text: t('rbInfoPillPrivate',  'Your info stays private') },
          ].map(({ Icon, text }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)', border: `1px solid ${cardBorder}`, borderRadius: 100, padding: '6px 14px', fontSize: 13, color: isLight ? '#4a5568' : '#9ca3af' }}>
              <Icon size={13} /> {text}
            </div>
          ))}
        </div>

        {/* ══════════ FORM CARD ══════════ */}
        <div style={{ ...cardSt, borderRadius: 20, padding: isMobile ? '24px 16px' : '40px', width: '100%', maxWidth: 720 }}>

          {/* Error banner */}
          {status === 'error' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 20px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, marginBottom: 24 }}>
              <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ color: '#ef4444', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                  {t('rbErrorTitle', 'Failed to submit bug report')}
                </div>
                <div style={{ color: isLight ? '#7f1d1d' : '#fca5a5', fontSize: 13, lineHeight: 1.6 }}>
                  {apiErr || t('rbErrorFallback', 'Something went wrong.')}{' '}
                  {t('rbErrorEmailFallback', 'Email us at')}{' '}
                  <a href="mailto:report@sahaplay.com?subject=Bug%20Report" style={{ color: 'var(--brand-1-light)', textDecoration: 'none' }}>
                    report@sahaplay.com
                  </a>
                  {' '}{t('rbErrorSubject', 'with subject: Bug Report')}
                </div>
                <button
                  onClick={() => { setStatus('idle'); setApiErr(''); }}
                  style={{ marginTop: 10, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {t('rbTryAgain', 'Try Again')}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            {/* ── Row: Name + Email ── */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>

              {/* Name */}
              <div>
                <label style={labelSt}>{t('rbNameLabel', 'Your Name')}<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span></label>
                <input
                  type="text"
                  placeholder={t('rbNamePlaceholder', 'Enter your name')}
                  value={form.name}
                  disabled={status === 'loading'}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); if (errors.name) setErrors(r => ({ ...r, name: '' })); }}
                  style={inputBase(!!errors.name)}
                />
                {errors.name && <div className="rb-field-error" style={errSt}><AlertCircle size={11} />{errors.name}</div>}
              </div>

              {/* Email */}
              <div>
                <label style={labelSt}>{t('rbEmailLabel', 'Your Email')}<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span></label>
                <input
                  type="email"
                  placeholder={t('rbEmailPlaceholder', 'your@email.com')}
                  value={form.email}
                  disabled={status === 'loading'}
                  onChange={e => { setForm(f => ({ ...f, email: e.target.value })); if (errors.email) setErrors(r => ({ ...r, email: '' })); }}
                  style={inputBase(!!errors.email)}
                />
                {errors.email
                  ? <div className="rb-field-error" style={errSt}><AlertCircle size={11} />{errors.email}</div>
                  : <div style={{ fontSize: 11, color: '#6b7280', marginTop: 5 }}>
                    {localStorage.getItem('watch_token') && form.email ? t('rbEmailPrefilled', '✓ Pre-filled from your account') : t('rbEmailHint', "We'll update you when fixed")}
                  </div>}
              </div>
            </div>

            {/* ── Bug Type ── */}
            <div style={{ marginBottom: 20 }} ref={bugTypeRef}>
              <label style={labelSt}>{t('rbTypeLabel', 'What type of bug is this?')}<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span></label>
              <div style={{ position: 'relative' }}>
                {/* Trigger */}
                <button
                  type="button"
                  disabled={status === 'loading'}
                  onClick={() => setBugTypeOpen(o => !o)}
                  style={{
                    ...selectBase(!!errors.bugType),
                    display: 'flex', alignItems: 'center', gap: 10,
                    cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                    textAlign: 'left', paddingRight: 38, width: '100%',
                  }}
                >
                  {(() => {
                    const bt = BUG_TYPES.find(b => b.key === form.bugType);
                    return bt ? (
                      <>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: `${bt.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <bt.Icon size={13} color={bt.color} />
                        </div>
                        <span style={{ fontSize: 14 }}>{t(bt.labelKey, bt.fallback)}</span>
                      </>
                    ) : (
                      <span style={{ fontSize: 14, color: isLight ? '#9ca3af' : '#6b7280' }}>{t('rbTypePlaceholder', 'Select bug type…')}</span>
                    );
                  })()}
                  <ChevronDown size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: `translateY(-50%) rotate(${bugTypeOpen ? 180 : 0}deg)`, transition: 'transform 0.2s', color: isLight ? '#6b7280' : '#9ca3af' }} />
                </button>

                {/* Dropdown list */}
                {bugTypeOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
                    background: isLight ? '#fff' : '#1c1c1f',
                    border: `1px solid ${isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                    maxHeight: 300, overflowY: 'auto', padding: 6,
                  }}>
                    {BUG_TYPES.map(({ key, Icon, color, labelKey, fallback }) => {
                      const selected = form.bugType === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setForm(f => ({ ...f, bugType: key }));
                            if (errors.bugType) setErrors(r => ({ ...r, bugType: '' }));
                            setBugTypeOpen(false);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                            padding: '9px 10px', borderRadius: 8, border: 'none',
                            background: selected ? (isLight ? 'rgba(var(--brand-1-rgb),0.08)' : 'rgba(var(--brand-1-rgb),0.12)') : 'transparent',
                            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.12s',
                          }}
                          onMouseEnter={e => { if (!selected) e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'; }}
                          onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: selected ? `${color}28` : (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={14} color={selected ? color : (isLight ? '#6b7280' : '#9ca3af')} />
                          </div>
                          <span style={{ fontSize: 14, fontWeight: selected ? 600 : 400, color: selected ? (isLight ? 'var(--brand-1-dark)' : 'var(--brand-1-light)') : (isLight ? '#374151' : '#d1d5db') }}>
                            {t(labelKey, fallback)}
                          </span>
                          {selected && <CheckCircle size={14} color="var(--brand-1-light)" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {errors.bugType && <div className="rb-field-error" style={errSt}><AlertCircle size={11} />{errors.bugType}</div>}
            </div>

            {/* ── Severity ── */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelSt}>{t('rbSeverityLabel', 'How bad is it?')}<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 }}>
                {SEVERITIES.map(({ key, Icon, color, labelKey, descKey, fallbackLabel, fallbackDesc }) => {
                  const selected = form.severity === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={status === 'loading'}
                      onClick={() => setForm(f => ({ ...f, severity: key }))}
                      style={{
                        padding: '14px 12px', borderRadius: 10, textAlign: 'left',
                        cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', transition: 'all 0.15s ease',
                        border: selected ? `2px solid ${color}` : `1px solid ${cardBorder}`,
                        background: selected ? `${color}14` : 'transparent',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, marginBottom: 10,
                        background: selected ? `${color}22` : (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s',
                      }}>
                        <Icon size={18} color={selected ? color : (isLight ? '#6b7280' : '#9ca3af')} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: selected ? color : (isLight ? '#111' : '#fff'), marginBottom: 4 }}>
                        {t(labelKey, fallbackLabel)}
                      </div>
                      <div style={{ fontSize: 12, color: isLight ? '#6b7280' : '#9ca3af', lineHeight: 1.4 }}>
                        {t(descKey, fallbackDesc)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── What were you doing ── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ ...labelSt, margin: 0 }}>
                  {t('rbDoingLabel', 'What were you doing when it happened?')}<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>
                </label>
                <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0, marginLeft: 8, color: form.whatHappened.length >= 500 ? '#ef4444' : form.whatHappened.length >= 450 ? '#f59e0b' : '#6b7280' }}>
                  {form.whatHappened.length} / 500
                </span>
              </div>
              <textarea
                placeholder={t('rbDoingPlaceholder', `e.g. I was in a watch room with 3 friends, I clicked play on a YouTube video and the video started for me but my friends saw it was still paused...`)}
                value={form.whatHappened}
                disabled={status === 'loading'}
                onChange={e => {
                  if (e.target.value.length <= 500) {
                    setForm(f => ({ ...f, whatHappened: e.target.value }));
                    if (errors.whatHappened) setErrors(r => ({ ...r, whatHappened: '' }));
                    const ta = e.target; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 300) + 'px';
                  }
                }}
                style={{ ...inputBase(!!errors.whatHappened), resize: 'none', minHeight: 100, maxHeight: 300, overflowY: 'auto', lineHeight: 1.65 }}
              />
              {errors.whatHappened && <div className="rb-field-error" style={errSt}><AlertCircle size={11} />{errors.whatHappened}</div>}
            </div>

            {/* ── What did you expect ── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ ...labelSt, margin: 0 }}>
                  {t('rbExpectLabel', 'What did you expect to happen?')}<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>
                </label>
                <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0, marginLeft: 8, color: form.whatExpected.length >= 300 ? '#ef4444' : form.whatExpected.length >= 270 ? '#f59e0b' : '#6b7280' }}>
                  {form.whatExpected.length} / 300
                </span>
              </div>
              <textarea
                placeholder={t('rbExpectPlaceholder', `e.g. The video should have played for everyone at the same time...`)}
                value={form.whatExpected}
                disabled={status === 'loading'}
                onChange={e => {
                  if (e.target.value.length <= 300) {
                    setForm(f => ({ ...f, whatExpected: e.target.value }));
                    if (errors.whatExpected) setErrors(r => ({ ...r, whatExpected: '' }));
                    const ta = e.target; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
                  }
                }}
                style={{ ...inputBase(!!errors.whatExpected), resize: 'none', minHeight: 80, maxHeight: 200, overflowY: 'auto', lineHeight: 1.65 }}
              />
              {errors.whatExpected && <div className="rb-field-error" style={errSt}><AlertCircle size={11} />{errors.whatExpected}</div>}
            </div>

            {/* ── What actually happened ── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ ...labelSt, margin: 0 }}>
                  {t('rbActualLabel', 'What actually happened?')}<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>
                </label>
                <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0, marginLeft: 8, color: form.actualResult.length >= 300 ? '#ef4444' : form.actualResult.length >= 270 ? '#f59e0b' : '#6b7280' }}>
                  {form.actualResult.length} / 300
                </span>
              </div>
              <textarea
                placeholder={t('rbActualPlaceholder', `e.g. Only my screen started playing, my friends saw a paused video...`)}
                value={form.actualResult}
                disabled={status === 'loading'}
                onChange={e => {
                  if (e.target.value.length <= 300) {
                    setForm(f => ({ ...f, actualResult: e.target.value }));
                    if (errors.actualResult) setErrors(r => ({ ...r, actualResult: '' }));
                    const ta = e.target; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
                  }
                }}
                style={{ ...inputBase(!!errors.actualResult), resize: 'none', minHeight: 80, maxHeight: 200, overflowY: 'auto', lineHeight: 1.65 }}
              />
              {errors.actualResult && <div className="rb-field-error" style={errSt}><AlertCircle size={11} />{errors.actualResult}</div>}
            </div>

            {/* ── Steps to reproduce (optional) ── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ ...labelSt, margin: 0 }}>
                  {t('rbStepsLabel', 'How can we reproduce this bug?')}{' '}
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11, color: '#6b7280' }}>{t('rbStepsOptional', '(optional)')}</span>
                </label>
                <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0, marginLeft: 8, color: form.stepsToReproduce.length >= 500 ? '#ef4444' : form.stepsToReproduce.length >= 450 ? '#f59e0b' : '#6b7280' }}>
                  {form.stepsToReproduce.length} / 500
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{t('rbStepsHint', 'Step-by-step helps us fix it faster')}</div>
              <textarea
                placeholder={t('rbStepsPlaceholder', `1. Create a room\n2. Invite a friend\n3. Paste a YouTube link\n4. Click play\n5. Bug happens...`)}
                value={form.stepsToReproduce}
                disabled={status === 'loading'}
                onChange={e => {
                  if (e.target.value.length <= 500) {
                    setForm(f => ({ ...f, stepsToReproduce: e.target.value }));
                    const ta = e.target; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 300) + 'px';
                  }
                }}
                style={{ ...inputBase(false), resize: 'none', minHeight: 100, maxHeight: 300, overflowY: 'auto', lineHeight: 1.65 }}
              />
            </div>

            {/* ── Device & Browser ── */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelSt}>{t('rbDeviceLabel', 'Your device and browser')}<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <input
                    type="text"
                    placeholder={t('rbBrowserPlaceholder', 'e.g. Chrome 124, Safari 17')}
                    value={form.browser}
                    disabled={status === 'loading'}
                    onChange={e => { setForm(f => ({ ...f, browser: e.target.value })); if (errors.browser) setErrors(r => ({ ...r, browser: '' })); }}
                    style={inputBase(!!errors.browser)}
                  />
                  {errors.browser && <div className="rb-field-error" style={errSt}><AlertCircle size={11} />{errors.browser}</div>}
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{t('rbBrowserHint', 'Browser (auto-detected)')}</div>
                </div>
                <div>
                  <input
                    type="text"
                    placeholder={t('rbOsPlaceholder', 'e.g. Windows 11, iPhone iOS 17')}
                    value={form.os}
                    disabled={status === 'loading'}
                    onChange={e => { setForm(f => ({ ...f, os: e.target.value })); if (errors.os) setErrors(r => ({ ...r, os: '' })); }}
                    style={inputBase(!!errors.os)}
                  />
                  {errors.os && <div className="rb-field-error" style={errSt}><AlertCircle size={11} />{errors.os}</div>}
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{t('rbOsHint', 'Operating System (auto-detected)')}</div>
                </div>
              </div>
              <div>
                <input
                  type="text"
                  placeholder={t('rbScreenPlaceholder', 'e.g. 1920x1080')}
                  value={form.screenSize}
                  disabled={status === 'loading'}
                  onChange={e => setForm(f => ({ ...f, screenSize: e.target.value }))}
                  style={inputBase(false)}
                />
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{t('rbScreenHint', 'Screen size (optional, auto-detected)')}</div>
              </div>
            </div>

            {/* ── Attachments ── */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelSt}>
                {t('rbAttachLabel', 'Attach screenshots or screen recording')}{' '}
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#6b7280' }}>
                  {t('rbAttachOptional', '(optional, up to {{max}})', { max: MAX_ATTACH })}
                </span>
              </label>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                {t('rbAttachHint', "Screenshots help us see exactly what you're seeing. Max 5 files, 10MB each.")}
              </div>

              {attachments.length < MAX_ATTACH && (
                <div
                  onDragEnter={onDragEnter}
                  onDragLeave={onDragLeave}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onClick={() => status !== 'loading' && fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragging ? 'var(--brand-1)' : isLight ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 12, padding: '28px 20px', textAlign: 'center',
                    cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    background: dragging ? (isLight ? 'rgba(var(--brand-1-rgb),0.05)' : 'rgba(var(--brand-1-rgb),0.07)') : 'transparent',
                  }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: isLight ? 'rgba(var(--brand-1-rgb),0.08)' : 'rgba(var(--brand-1-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Upload size={18} color="var(--brand-1-light)" />
                  </div>
                  <div style={{ fontSize: 14, color: isLight ? '#374151' : '#9ca3af', marginBottom: 4 }}>
                    <span style={{ color: 'var(--brand-1-light)', fontWeight: 600 }}>{t('rbAttachClick', 'Click to attach')}</span> {t('rbAttachDrop', 'or drag and drop')}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {t('rbAttachTypes', 'Images (JPG, PNG, GIF, WEBP) or Videos (MP4, WEBM) — up to 10 MB each')}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
                    multiple
                    style={{ display: 'none' }}
                    onChange={e => { processFiles(e.target.files); e.target.value = ''; }}
                    disabled={status === 'loading'}
                  />
                </div>
              )}

              {attachErr && <div style={{ ...errSt, marginTop: 8 }}><AlertCircle size={11} />{attachErr}</div>}

              {attachments.length > 0 && (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                    {attachments.map((att, idx) => (
                      <div key={idx} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${cardBorder}` }}>
                        {att.isVideo ? (
                          /* Video thumbnail: dark box + play icon */
                          <div style={{ width: 80, height: 80, background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(var(--brand-1-rgb),0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21" /></svg>
                            </div>
                            <div style={{ background: 'rgba(var(--brand-1-rgb),0.85)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>
                              {getFileExt(att.name, att.type)}
                            </div>
                          </div>
                        ) : (
                          /* Image thumbnail */
                          <div style={{ position: 'relative' }}>
                            <img src={att.preview} alt={att.name} style={{ width: 80, height: 80, objectFit: 'cover', display: 'block' }} />
                            <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4 }}>
                              {getFileExt(att.name, att.type)}
                            </div>
                          </div>
                        )}
                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          onMouseEnter={() => setHoveredRemove(idx)}
                          onMouseLeave={() => setHoveredRemove(null)}
                          className="stay-white"
                          style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: hoveredRemove === idx ? '#ef4444' : 'rgba(0,0,0,0.65)', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'background 0.15s' }}
                        >
                          <X size={12} />
                        </button>
                        {/* File name + size */}
                        <div style={{ padding: '4px 6px', background: isLight ? '#f3f4f6' : '#111' }}>
                          <div style={{ fontSize: 10, color: isLight ? '#374151' : '#9ca3af', maxWidth: 68, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</div>
                          <div style={{ fontSize: 10, color: '#6b7280' }}>{formatBytes(att.size)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                    {t('rbAttachSelected', '{{count}} / {{max}} files selected', { count: attachments.length, max: MAX_ATTACH })}
                  </div>
                </>
              )}
            </div>

            {/* ── Console Errors (optional) ── */}
            <div style={{ marginBottom: 32 }}>
              <label style={labelSt}>
                {t('rbConsoleLabel', 'Any error messages or console errors?')}{' '}
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11, color: '#6b7280' }}>{t('rbConsoleOptional', '(optional)')}</span>
              </label>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                {t('rbConsoleHint', 'Open browser DevTools (F12 → Console tab) and paste any red error messages here.')}
              </div>
              <textarea
                placeholder={t('rbConsolePlaceholder', `Paste error messages here...\ne.g. TypeError: Cannot read property...`)}
                value={form.consoleErrors}
                disabled={status === 'loading'}
                onChange={e => setForm(f => ({ ...f, consoleErrors: e.target.value }))}
                style={{
                  ...inputBase(false),
                  resize: 'none', minHeight: 100, maxHeight: 300, overflowY: 'auto',
                  fontFamily: "'Courier New', monospace",
                  fontSize: 13,
                  background: isLight ? '#f0f0f8' : 'rgba(0,0,0,0.35)',
                  lineHeight: 1.6,
                }}
              />
            </div>

            {/* ── Submit ── */}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="stay-white rb-submit"
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: status === 'loading' ? 'rgba(var(--brand-1-rgb),0.55)' : 'linear-gradient(135deg,var(--brand-1),var(--brand-2))',
                color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
              onMouseEnter={e => { if (status !== 'loading') e.currentTarget.style.opacity = '0.88'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              {status === 'loading' ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'rb-spin 0.9s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  {t('rbSubmitting', 'Submitting…')}
                </>
              ) : (
                <><Bug size={16} /> {t('rbSubmitButton', 'Submit Bug Report')}</>
              )}
            </button>

            <p style={{ textAlign: 'center', fontSize: 12, color: '#6b7280', marginTop: 12, marginBottom: 0 }}>
              {t('rbInvestigationHint', 'We typically investigate critical bugs within 24 hours.')}
            </p>

          </form>
        </div>
      </main>

      <Footer />

      <style>{`
        @keyframes rb-spin { to { transform: rotate(360deg); } }
        @media (max-width: 480px) {
          .rb-badge  { font-size: 12px !important; padding: 5px 14px !important; }
          .rb-submit { font-size: 14px !important; padding: 13px !important; }
        }
      `}</style>
    </div>
  );
}
