import React, { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { CheckCircle, AlertCircle, ChevronDown, Upload, X } from 'lucide-react';

const BUG_TYPES = [
  '🎬 Video / Sync Issue',
  '💬 Chat Not Working',
  '🔐 Login / Account Problem',
  '📱 Mobile / Responsive Layout',
  '🔔 Notifications Not Working',
  '🎤 Audio / Microphone Issue',
  '📷 Camera / Screenshare Issue',
  '⚡ App Crashing / Freezing',
  '📶 Performance / Slow Loading',
  '🎨 UI / Visual Glitch',
  '🔗 Link / URL Problem',
  '🔒 Security Concern',
  '🔹 Other Bug',
];

const SEVERITIES = [
  { key: 'minor', emoji: '🟡', label: 'Minor', desc: 'Small annoyance, still usable' },
  { key: 'major', emoji: '🟠', label: 'Major', desc: 'Significantly affects my experience' },
  { key: 'critical', emoji: '🔴', label: 'Critical', desc: 'App completely broken for me' },
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
    const host = window.location.hostname;
    fetch(`http://${host}:3001/api/profile`, {
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
      e.name = 'Please enter your name (min 2 characters)';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e.email = 'Please enter a valid email address';
    if (!form.bugType)
      e.bugType = 'Please select a bug type';
    if (!form.whatHappened.trim() || form.whatHappened.trim().length < 20)
      e.whatHappened = 'Please describe what happened (min 20 characters)';
    if (!form.whatExpected.trim() || form.whatExpected.trim().length < 10)
      e.whatExpected = 'Please describe what you expected (min 10 characters)';
    if (!form.actualResult.trim() || form.actualResult.trim().length < 10)
      e.actualResult = 'Please describe what actually happened (min 10 characters)';
    if (!form.browser.trim())
      e.browser = 'Please enter your browser';
    if (!form.os.trim())
      e.os = 'Please enter your operating system';
    return e;
  };

  /* ── file processing ── */
  const processFiles = useCallback((files) => {
    setAttachErr('');
    const slots = MAX_ATTACH - attachments.length;
    if (slots <= 0) { setAttachErr(`Max ${MAX_ATTACH} files allowed.`); return; }
    const toAdd = [];
    let errMsg = '';
    for (const f of Array.from(files).slice(0, slots)) {
      if (!ALLOWED_ATT.includes(f.type)) { errMsg = 'Only JPG, PNG, GIF, WEBP, MP4, WEBM allowed.'; continue; }
      if (f.size > MAX_BYTES) { errMsg = `"${f.name}" exceeds 10 MB limit.`; continue; }
      toAdd.push({ file: f, preview: URL.createObjectURL(f), name: f.name, type: f.type, size: f.size, isVideo: f.type.startsWith('video/') });
    }
    if (errMsg) setAttachErr(errMsg);
    if (toAdd.length) setAttachments(p => [...p, ...toAdd]);
  }, [attachments.length]);

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

      const host = window.location.hostname;
      const res = await fetch(`http://${host}:3001/api/report-bug`, {
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

  /* ══════════════════════════════════════════════════════
     SUCCESS STATE
  ══════════════════════════════════════════════════════ */
  if (status === 'success') {
    return (
      <div style={{ minHeight: '100vh', background: pageBg, display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '40px 12px' : '60px 24px' }}>
          <div style={{ ...cardSt, borderRadius: 20, padding: isMobile ? '40px 24px' : '60px 48px', textAlign: 'center', maxWidth: 540, width: '100%', animation: 'fadeInUp 0.4s ease' }}>

            {/* Icon */}
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', border: '2px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', animation: 'popIn 0.4s ease', fontSize: 36, lineHeight: 1 }}>
              ✅
            </div>

            {/* Title */}
            <h2 style={{ fontSize: isMobile ? 24 : 30, fontWeight: 900, color: isLight ? '#111' : '#fff', margin: '0 0 16px', letterSpacing: '-0.5px' }}>
              Bug Report Submitted!
            </h2>

            {/* Personalized message */}
            <p style={{ fontSize: 15, color: isLight ? '#4a5568' : '#9ca3af', lineHeight: 1.8, margin: '0 0 20px' }}>
              Thanks <strong style={{ color: isLight ? '#111' : '#fff' }}>{form.name}</strong>! We received your{' '}
              <strong style={{ color: '#818cf8' }}>{form.severity}</strong> bug report about{' '}
              <strong style={{ color: '#818cf8' }}>{form.bugType}</strong> and will investigate it right away.
              We'll update you at <strong style={{ color: '#818cf8' }}>{form.email}</strong>.
            </p>

            {/* Report ID pill */}
            <div style={{ display: 'inline-block', background: isLight ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '8px 18px', marginBottom: 28, fontFamily: "'Courier New', monospace", fontSize: 14, fontWeight: 700, color: '#818cf8', letterSpacing: '0.5px' }}>
              Report ID: {reportId}
            </div>

            {/* What happens next */}
            <div style={{ background: isLight ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 32, textAlign: 'left' }}>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#818cf8', margin: '0 0 12px' }}>
                What happens next
              </p>
              {[
                '🔍 Our team will investigate your report',
                '⚡ Critical bugs are prioritized immediately',
                "📧 We'll email you when it's fixed",
                '🔄 You may be contacted for more details',
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
                  border: `1px solid ${hoveredSuccessBtn === 'secondary' ? 'rgba(99,102,241,0.45)' : cardBorder}`,
                  background: hoveredSuccessBtn === 'secondary' ? 'rgba(99,102,241,0.08)' : 'transparent',
                  color: hoveredSuccessBtn === 'secondary' ? '#818cf8' : (isLight ? '#374151' : '#9ca3af'),
                  transform: hoveredSuccessBtn === 'secondary' ? 'translateY(-2px)' : 'translateY(0)',
                  transition: 'all 0.18s ease',
                }}
              >
                Report Another Bug
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                onMouseEnter={() => setHoveredSuccessBtn('primary')}
                onMouseLeave={() => setHoveredSuccessBtn(null)}
                style={{
                  flex: 1, padding: '12px 20px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  color: '#fff',
                  transform: hoveredSuccessBtn === 'primary' ? 'translateY(-2px)' : 'translateY(0)',
                  boxShadow: hoveredSuccessBtn === 'primary' ? '0 8px 20px rgba(99,102,241,0.4)' : '0 0px 0px transparent',
                  opacity: hoveredSuccessBtn === 'primary' ? 0.9 : 1,
                  transition: 'all 0.18s ease',
                }}
              >
                Back to Home →
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
    <div style={{ minHeight: '100vh', background: pageBg, display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: isMobile ? '48px 12px 80px' : '72px 24px 100px' }}>

        {/* ── Badge ── */}
        <div className="rb-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: isLight ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.12)', border: `1px solid rgba(99,102,241,${isLight ? '0.3' : '0.25'})`, color: isLight ? '#4f46e5' : '#818cf8', padding: '6px 18px', borderRadius: 100, fontSize: 13, fontWeight: 700, letterSpacing: '0.3px', marginBottom: 28 }}>
          🐛 Bug Report
        </div>

        {/* ── Title ── */}
        <h1 style={{ fontSize: 'clamp(28px,5vw,48px)', fontWeight: 900, textAlign: 'center', margin: '0 0 16px', color: isLight ? '#111' : '#fff', letterSpacing: '-1px', lineHeight: 1.1 }}>
          Found a Bug?
        </h1>
        <p style={{ textAlign: 'center', fontSize: 16, lineHeight: 1.8, color: isLight ? '#4a5568' : '#9ca3af', maxWidth: 500, margin: '0 0 24px' }}>
          Help us fix it. Describe what went wrong and we'll investigate as soon as possible.
        </p>

        {/* ── Info pills ── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 48 }}>
          {['🔍 Every report is reviewed', '⚡ Fast response for critical bugs', '🔒 Your info stays private'].map((pill, i) => (
            <div key={i} style={{ background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)', border: `1px solid ${cardBorder}`, borderRadius: 100, padding: '6px 14px', fontSize: 13, color: isLight ? '#4a5568' : '#9ca3af' }}>
              {pill}
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
                  Failed to submit bug report
                </div>
                <div style={{ color: isLight ? '#7f1d1d' : '#fca5a5', fontSize: 13, lineHeight: 1.6 }}>
                  {apiErr || 'Something went wrong.'}{' '}
                  Email us at{' '}
                  <a href="mailto:sahaaplay@gmail.com?subject=Bug%20Report" style={{ color: '#818cf8', textDecoration: 'none' }}>
                    sahaaplay@gmail.com
                  </a>
                  {' '}with subject: <strong>Bug Report</strong>
                </div>
                <button
                  onClick={() => { setStatus('idle'); setApiErr(''); }}
                  style={{ marginTop: 10, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            {/* ── Row: Name + Email ── */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>

              {/* Name */}
              <div>
                <label style={labelSt}>Your Name<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span></label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={form.name}
                  disabled={status === 'loading'}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); if (errors.name) setErrors(r => ({ ...r, name: '' })); }}
                  style={inputBase(!!errors.name)}
                />
                {errors.name && <div className="rb-field-error" style={errSt}><AlertCircle size={11} />{errors.name}</div>}
              </div>

              {/* Email */}
              <div>
                <label style={labelSt}>Your Email<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span></label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={form.email}
                  disabled={status === 'loading'}
                  onChange={e => { setForm(f => ({ ...f, email: e.target.value })); if (errors.email) setErrors(r => ({ ...r, email: '' })); }}
                  style={inputBase(!!errors.email)}
                />
                {errors.email
                  ? <div className="rb-field-error" style={errSt}><AlertCircle size={11} />{errors.email}</div>
                  : <div style={{ fontSize: 11, color: '#6b7280', marginTop: 5 }}>
                    {localStorage.getItem('watch_token') && form.email ? '✓ Pre-filled from your account' : "We'll update you when fixed"}
                  </div>}
              </div>
            </div>

            {/* ── Bug Type ── */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelSt}>What type of bug is this?<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <select
                  value={form.bugType}
                  disabled={status === 'loading'}
                  onChange={e => { setForm(f => ({ ...f, bugType: e.target.value })); if (errors.bugType) setErrors(r => ({ ...r, bugType: '' })); }}
                  style={{ ...selectBase(!!errors.bugType), appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', paddingRight: 38 }}
                >
                  <option value="" disabled style={optionPlaceholderSt}>Select bug type…</option>
                  {BUG_TYPES.map(t => <option key={t} value={t} style={optionSt}>{t}</option>)}
                </select>
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280', display: 'flex' }}>
                  <ChevronDown size={16} />
                </div>
              </div>
              {errors.bugType && <div className="rb-field-error" style={errSt}><AlertCircle size={11} />{errors.bugType}</div>}
            </div>

            {/* ── Severity ── */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelSt}>How bad is it?<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 }}>
                {SEVERITIES.map(({ key, emoji, label, desc }) => {
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
                        border: selected ? '2px solid #6366f1' : `1px solid ${cardBorder}`,
                        background: selected ? 'rgba(99,102,241,0.08)' : 'transparent',
                      }}
                    >
                      <div style={{ fontSize: 20, marginBottom: 6 }}>{emoji}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: selected ? '#818cf8' : (isLight ? '#111' : '#fff'), marginBottom: 4 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 12, color: isLight ? '#6b7280' : '#9ca3af', lineHeight: 1.4 }}>
                        {desc}
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
                  What were you doing when it happened?<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>
                </label>
                <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0, marginLeft: 8, color: form.whatHappened.length >= 500 ? '#ef4444' : form.whatHappened.length >= 450 ? '#f59e0b' : '#6b7280' }}>
                  {form.whatHappened.length} / 500
                </span>
              </div>
              <textarea
                placeholder={`e.g. I was in a watch room with 3 friends, I clicked play on a YouTube video and the video started for me but my friends saw it was still paused...`}
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
                  What did you expect to happen?<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>
                </label>
                <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0, marginLeft: 8, color: form.whatExpected.length >= 300 ? '#ef4444' : form.whatExpected.length >= 270 ? '#f59e0b' : '#6b7280' }}>
                  {form.whatExpected.length} / 300
                </span>
              </div>
              <textarea
                placeholder={`e.g. The video should have played for everyone at the same time...`}
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
                  What actually happened?<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>
                </label>
                <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0, marginLeft: 8, color: form.actualResult.length >= 300 ? '#ef4444' : form.actualResult.length >= 270 ? '#f59e0b' : '#6b7280' }}>
                  {form.actualResult.length} / 300
                </span>
              </div>
              <textarea
                placeholder={`e.g. Only my screen started playing, my friends saw a paused video...`}
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
                  How can we reproduce this bug?{' '}
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11, color: '#6b7280' }}>(optional)</span>
                </label>
                <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0, marginLeft: 8, color: form.stepsToReproduce.length >= 500 ? '#ef4444' : form.stepsToReproduce.length >= 450 ? '#f59e0b' : '#6b7280' }}>
                  {form.stepsToReproduce.length} / 500
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Step-by-step helps us fix it faster</div>
              <textarea
                placeholder={`1. Create a room\n2. Invite a friend\n3. Paste a YouTube link\n4. Click play\n5. Bug happens...`}
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
              <label style={labelSt}>Your device and browser<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <input
                    type="text"
                    placeholder="e.g. Chrome 124, Safari 17"
                    value={form.browser}
                    disabled={status === 'loading'}
                    onChange={e => { setForm(f => ({ ...f, browser: e.target.value })); if (errors.browser) setErrors(r => ({ ...r, browser: '' })); }}
                    style={inputBase(!!errors.browser)}
                  />
                  {errors.browser && <div className="rb-field-error" style={errSt}><AlertCircle size={11} />{errors.browser}</div>}
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Browser (auto-detected)</div>
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="e.g. Windows 11, iPhone iOS 17"
                    value={form.os}
                    disabled={status === 'loading'}
                    onChange={e => { setForm(f => ({ ...f, os: e.target.value })); if (errors.os) setErrors(r => ({ ...r, os: '' })); }}
                    style={inputBase(!!errors.os)}
                  />
                  {errors.os && <div className="rb-field-error" style={errSt}><AlertCircle size={11} />{errors.os}</div>}
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Operating System (auto-detected)</div>
                </div>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="e.g. 1920x1080"
                  value={form.screenSize}
                  disabled={status === 'loading'}
                  onChange={e => setForm(f => ({ ...f, screenSize: e.target.value }))}
                  style={inputBase(false)}
                />
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Screen size (optional, auto-detected)</div>
              </div>
            </div>

            {/* ── Attachments ── */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelSt}>
                Attach screenshots or screen recording{' '}
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#6b7280' }}>(optional, up to {MAX_ATTACH})</span>
              </label>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                Screenshots help us see exactly what you're seeing. Max 5 files, 10MB each.
              </div>

              {attachments.length < MAX_ATTACH && (
                <div
                  onDragEnter={onDragEnter}
                  onDragLeave={onDragLeave}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onClick={() => status !== 'loading' && fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragging ? '#6366f1' : isLight ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 12, padding: '28px 20px', textAlign: 'center',
                    cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    background: dragging ? (isLight ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.07)') : 'transparent',
                  }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: isLight ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Upload size={18} color="#818cf8" />
                  </div>
                  <div style={{ fontSize: 14, color: isLight ? '#374151' : '#9ca3af', marginBottom: 4 }}>
                    <span style={{ color: '#818cf8', fontWeight: 600 }}>Click to attach</span> or drag and drop
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Images (JPG, PNG, GIF, WEBP) or Videos (MP4, WEBM) — up to 10 MB each
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
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(99,102,241,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21" /></svg>
                            </div>
                            <div style={{ background: 'rgba(99,102,241,0.85)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>
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
                    {attachments.length} / {MAX_ATTACH} files selected
                  </div>
                </>
              )}
            </div>

            {/* ── Console Errors (optional) ── */}
            <div style={{ marginBottom: 32 }}>
              <label style={labelSt}>
                Any error messages or console errors?{' '}
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11, color: '#6b7280' }}>(optional)</span>
              </label>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                Open browser DevTools (F12 → Console tab) and paste any red error messages here.
              </div>
              <textarea
                placeholder={`Paste error messages here...\ne.g. TypeError: Cannot read property...`}
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
                background: status === 'loading' ? 'rgba(99,102,241,0.55)' : 'linear-gradient(135deg,#6366f1,#a855f7)',
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
                  Submitting…
                </>
              ) : (
                <>Submit Bug Report 🐛</>
              )}
            </button>

            <p style={{ textAlign: 'center', fontSize: 12, color: '#6b7280', marginTop: 12, marginBottom: 0 }}>
              We typically investigate critical bugs within 24 hours.
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
