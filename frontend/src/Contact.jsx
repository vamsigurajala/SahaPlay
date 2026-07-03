import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { CheckCircle, Send, X, Upload, AlertCircle, ChevronDown, MessageCircle } from 'lucide-react';

const MAX_CHARS = 1000;
const MAX_IMAGES = 5;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Subject options: value = English (sent to API), labelKey = i18n key for display
const SUBJECTS = [
  { value: 'General Question', labelKey: 'contactSubjectGeneral' },
  { value: 'Bug Report', labelKey: 'contactSubjectBug' },
  { value: 'Feature Request', labelKey: 'contactSubjectFeature' },
  { value: 'Account Issue', labelKey: 'contactSubjectAccount' },
  { value: 'Safety / Report User', labelKey: 'contactSubjectSafety' },
  { value: 'Content / Copyright Issue', labelKey: 'contactSubjectCopyright' },
  { value: 'Other', labelKey: 'contactSubjectOther' },
];

const API = /localhost|127\.0\.0\.1|^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|local$/i.test(window.location.hostname)
  ? `http://${window.location.hostname}:3001`
  : `https://${window.location.hostname}`;

const getBorderColor = (hasError, isLight) =>
  hasError ? '#ef4444' : isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)';

const formatBytes = (b) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

export default function Contact() {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState(() => localStorage.getItem('watch_theme') || 'dark');
  const isLight = theme === 'light';

  useEffect(() => {
    const h = () => setTheme(localStorage.getItem('watch_theme') || 'dark');
    window.addEventListener('theme_changed', h);
    return () => window.removeEventListener('theme_changed', h);
  }, []);

  /* ── form ── */
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [errors, setErrors] = useState({});
  const [images, setImages] = useState([]);
  const [imgErr, setImgErr] = useState('');
  const [dragging, setDragging] = useState(false);

  /* ── submit ── */
  const [status, setStatus] = useState('idle');
  const [apiErr, setApiErr] = useState('');

  const fileRef = useRef(null);
  const dragCount = useRef(0);
  const subjectRef = useRef(null);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const [hoveredRemove, setHoveredRemove] = useState(null);
  const [hoveredSuccessBtn, setHoveredSuccessBtn] = useState(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close subject dropdown on outside click
  useEffect(() => {
    if (!subjectOpen) return;
    const handler = (e) => {
      if (subjectRef.current && !subjectRef.current.contains(e.target)) setSubjectOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [subjectOpen]);

  /* ── prefill email + name from logged-in user ── */
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

  /* ── theme tokens ── */
  const pageBg = isLight ? 'linear-gradient(135deg,#f0f0f8 0%,#e8e8f5 50%,#f0f0f8 100%)' : '#09090b';
  const cardSt = isLight
    ? { background: '#ffffff', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }
    : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' };
  const labelSt = { display: 'block', fontSize: 12, fontWeight: 700, color: isLight ? '#6b7280' : '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px' };
  const errSt = { color: '#ef4444', fontSize: 12, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 };

  const inputBase = (hasErr) => ({
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 16px',
    borderRadius: 10,
    border: `1px solid ${getBorderColor(hasErr, isLight)}`,
    background: isLight ? '#f9f9ff' : 'rgba(255,255,255,0.04)',
    color: isLight ? '#111' : '#fff',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  });

  const selectBase = (hasErr) => ({
    ...inputBase(hasErr),
    background: isLight ? '#f9f9ff' : '#18181b',
  });
  const optionSt = { background: isLight ? '#f9f9ff' : '#18181b', color: isLight ? '#111' : '#fff' };
  const optionPlaceholderSt = { background: isLight ? '#f9f9ff' : '#18181b', color: isLight ? '#9ca3af' : '#6b7280' };

  /* ── validate ── */
  const validate = () => {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = t('contactNameError', 'Please enter your name (min 2 characters)');
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = t('contactEmailError', 'Please enter a valid email address');
    if (!form.subject) e.subject = t('contactSubjectError', 'Please select a subject');
    if (!form.message.trim() || form.message.trim().length < 10) e.message = t('contactMessageError', 'Message must be at least 10 characters');
    return e;
  };

  /* ── image processing ── */
  const processFiles = useCallback((files) => {
    setImgErr('');
    const slots = MAX_IMAGES - images.length;
    if (slots <= 0) { setImgErr(t('contactImagesMax', 'Max {{max}} images allowed.', { max: MAX_IMAGES })); return; }
    const toAdd = [];
    let errMsg = '';
    for (const f of Array.from(files).slice(0, slots)) {
      if (!ALLOWED.includes(f.type)) { errMsg = t('contactImagesTypeError', 'Only JPG, PNG, GIF, WEBP allowed.'); continue; }
      if (f.size > MAX_BYTES) { errMsg = t('contactImagesSizeError', '"{{name}}" exceeds 5 MB limit.', { name: f.name }); continue; }
      toAdd.push({ file: f, preview: URL.createObjectURL(f), name: f.name, type: f.type, size: f.size });
    }
    if (errMsg) setImgErr(errMsg);
    if (toAdd.length) setImages(p => [...p, ...toAdd]);
  }, [images.length, t]);

  const removeImg = (i) => {
    setImages(p => { URL.revokeObjectURL(p[i].preview); return p.filter((_, j) => j !== i); });
    setImgErr('');
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
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStatus('loading');
    setApiErr('');

    try {
      const imagePayload = await Promise.all(images.map(async (img) => ({
        data: await toB64(img.file),
        type: img.type,
        name: img.name,
      })));

      const res = await fetch(`${API}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          subject: form.subject,
          message: form.message.trim(),
          images: imagePayload,
          lang: i18n.language,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || t('contactErrorFallback', 'Something went wrong.'));
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setApiErr(err.message);
    }
  };

  const resetForm = () => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setForm({ name: '', email: '', subject: '', message: '' });
    setImages([]);
    setErrors({});
    setImgErr('');
    setApiErr('');
    setStatus('idle');
  };

  /* ══════════════════════════════════════════════════════
     SUCCESS STATE
  ══════════════════════════════════════════════════════ */
  if (status === 'success') {
    return (
      <div className="page-enter" style={{ minHeight: '100vh', background: pageBg, display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '40px 12px' : '60px 24px' }}>
          <div style={{ ...cardSt, borderRadius: 20, padding: isMobile ? '40px 24px' : '60px 48px', textAlign: 'center', maxWidth: 520, width: '100%', animation: 'fadeInUp 0.4s ease' }}>

            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', border: '2px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', animation: 'popIn 0.4s ease' }}>
              <CheckCircle size={40} color="#10b981" />
            </div>

            <h2 style={{ fontSize: isMobile ? 24 : 30, fontWeight: 900, color: isLight ? '#111' : '#fff', margin: '0 0 12px', letterSpacing: '-0.5px' }}>
              {t('contactSuccessTitle', 'Message Sent! 🎉')}
            </h2>

            <p style={{ fontSize: 16, color: isLight ? '#4a5568' : '#9ca3af', lineHeight: 1.8, margin: '0 0 8px' }}>
              {t('contactSuccessThanks', 'Thanks {{name}}!', { name: form.name })}
            </p>

            <p style={{ fontSize: 15, color: isLight ? '#6b7280' : '#9ca3af', lineHeight: 1.8, margin: '0 0 32px' }}>
              {t('contactSuccessBody', 'We received your message about "{{subject}}" and will reply to {{email}} within', { subject: form.subject, email: form.email })}{' '}
              <strong style={{ color: isLight ? '#111' : '#fff' }}>{t('contactSuccessHours', '48 hours')}</strong>.
            </p>

            <div style={{ background: isLight ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 32, textAlign: 'left' }}>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#818cf8', margin: '0 0 12px' }}>
                {t('contactSuccessNextTitle', 'What happens next')}
              </p>
              {[
                t('contactSuccessStep1', 'Check your inbox for a confirmation email'),
                t('contactSuccessStep2', "We'll review your message within 48 hours"),
                t('contactSuccessStep3', "We'll reply directly to your email"),
              ].map((item, i) => (
                <div key={i} style={{ fontSize: 14, color: isLight ? '#374151' : '#9ca3af', marginBottom: i < 2 ? 8 : 0, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  {item}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
              <button
                onClick={resetForm}
                onMouseEnter={() => setHoveredSuccessBtn('secondary')}
                onMouseLeave={() => setHoveredSuccessBtn(null)}
                style={{
                  flex: 1, padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${hoveredSuccessBtn === 'secondary' ? 'rgba(99,102,241,0.45)' : (isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)')}`,
                  background: hoveredSuccessBtn === 'secondary' ? 'rgba(99,102,241,0.08)' : 'transparent',
                  color: hoveredSuccessBtn === 'secondary' ? '#818cf8' : (isLight ? '#374151' : '#9ca3af'),
                  transform: hoveredSuccessBtn === 'secondary' ? 'translateY(-2px)' : 'translateY(0)',
                  transition: 'all 0.18s ease',
                }}
              >
                {t('contactSendAnother', 'Send Another Message')}
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                onMouseEnter={() => setHoveredSuccessBtn('primary')}
                onMouseLeave={() => setHoveredSuccessBtn(null)}
                style={{
                  flex: 1, padding: '12px 20px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  color: '#fff',
                  WebkitTextFillColor: '#fff',
                  transform: hoveredSuccessBtn === 'primary' ? 'translateY(-2px)' : 'translateY(0)',
                  boxShadow: hoveredSuccessBtn === 'primary' ? '0 8px 20px rgba(99,102,241,0.4)' : '0 0px 0px transparent',
                  opacity: hoveredSuccessBtn === 'primary' ? 0.9 : 1,
                  transition: 'all 0.18s ease',
                }}
              >
                {t('contactBackHome', 'Back to Home →')}
              </button>
            </div>
          </div>
        </main>
        <Footer />
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes popIn {
            0%   { transform: scale(0);   opacity: 0; }
            70%  { transform: scale(1.1); }
            100% { transform: scale(1);   opacity: 1; }
          }
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
        <div className="contact-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: isLight ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.12)', border: `1px solid rgba(99,102,241,${isLight ? '0.3' : '0.25'})`, color: isLight ? '#4f46e5' : '#818cf8', padding: '6px 18px', borderRadius: 100, fontSize: 13, fontWeight: 700, letterSpacing: '0.3px', marginBottom: 28 }}>
          <MessageCircle size={14} style={{ flexShrink: 0 }} /> {t('contactBadge', 'Get in Touch')}
        </div>

        {/* ── Title ── */}
        <h1 style={{ fontSize: 'clamp(28px,5vw,48px)', fontWeight: 900, textAlign: 'center', margin: '0 0 16px', color: isLight ? '#111' : '#fff', letterSpacing: '-1px', lineHeight: 1.1 }}>
          {t('contactTitle', "We'd Love to Hear From You")}
        </h1>
        <p style={{ textAlign: 'center', fontSize: 16, lineHeight: 1.8, color: isLight ? '#4a5568' : '#9ca3af', maxWidth: 500, margin: '0 0 48px' }}>
          {t('contactSubtitle', "Have a question, found a bug, or just want to say hi? Send us a message and we'll get back to you within 48 hours.")}
        </p>

        {/* ══════════ FORM CARD ══════════ */}
        <div style={{ ...cardSt, borderRadius: 20, padding: isMobile ? '24px 16px' : '40px', width: '100%', maxWidth: 680 }}>

          {/* Error banner */}
          {status === 'error' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 20px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, marginBottom: 24 }}>
              <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ color: '#ef4444', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                  {t('contactErrorTitle', 'Failed to send message')}
                </div>
                <div style={{ color: isLight ? '#7f1d1d' : '#fca5a5', fontSize: 13, lineHeight: 1.6 }}>
                  {apiErr || t('contactErrorFallback', 'Something went wrong.')}{' '}
                  {t('contactErrorEmailFallback', 'Or email us directly at')}{' '}
                  <a href="mailto:sahaaplay@gmail.com" style={{ color: '#818cf8', textDecoration: 'none' }}>
                    sahaaplay@gmail.com
                  </a>
                </div>
                <button
                  onClick={() => { setStatus('idle'); setApiErr(''); }}
                  style={{ marginTop: 10, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {t('contactTryAgain', 'Try Again')}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            {/* ── Row: Name + Email ── */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>

              {/* Name */}
              <div>
                <label style={labelSt}>{t('contactNameLabel', 'Your Name')}<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span></label>
                <input
                  type="text"
                  placeholder={t('contactNamePlaceholder', 'Enter your name')}
                  value={form.name}
                  disabled={status === 'loading'}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); if (errors.name) setErrors(r => ({ ...r, name: '' })); }}
                  style={inputBase(!!errors.name)}
                />
                {errors.name && <div style={errSt}><AlertCircle size={11} />{errors.name}</div>}
              </div>

              {/* Email */}
              <div>
                <label style={labelSt}>{t('contactEmailLabel', 'Your Email')}<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span></label>
                <input
                  type="email"
                  placeholder={t('contactEmailPlaceholder', 'your@email.com')}
                  value={form.email}
                  disabled={status === 'loading'}
                  onChange={e => { setForm(f => ({ ...f, email: e.target.value })); if (errors.email) setErrors(r => ({ ...r, email: '' })); }}
                  style={inputBase(!!errors.email)}
                />
                {errors.email
                  ? <div style={errSt}><AlertCircle size={11} />{errors.email}</div>
                  : <div style={{ fontSize: 11, color: '#6b7280', marginTop: 5 }}>
                    {localStorage.getItem('watch_token') && form.email
                      ? t('contactEmailPrefilled', '✓ Pre-filled from your account')
                      : t('contactEmailHint', "We'll reply to this email")}
                  </div>}
              </div>
            </div>

            {/* ── Subject ── */}
            <div style={{ marginBottom: 20 }} ref={subjectRef}>
              <label style={labelSt}>{t('contactSubjectLabel', "What's this about?")}<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span></label>
              <div style={{ position: 'relative' }}>
                {/* Trigger button */}
                <button
                  type="button"
                  disabled={status === 'loading'}
                  onClick={() => setSubjectOpen(o => !o)}
                  style={{
                    ...selectBase(!!errors.subject),
                    display: 'flex', alignItems: 'center', gap: 10,
                    cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                    textAlign: 'left', paddingRight: 38, width: '100%',
                  }}
                >
                  {form.subject ? (
                    <span style={{ fontSize: 14, color: isLight ? '#111' : '#fff' }}>
                      {t(SUBJECTS.find(s => s.value === form.subject)?.labelKey || '', form.subject)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 14, color: isLight ? '#9ca3af' : '#6b7280' }}>
                      {t('contactSubjectPlaceholder', 'Select a topic…')}
                    </span>
                  )}
                  <ChevronDown size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: `translateY(-50%) rotate(${subjectOpen ? 180 : 0}deg)`, transition: 'transform 0.2s', color: isLight ? '#6b7280' : '#9ca3af' }} />
                </button>

                {/* Dropdown list */}
                {subjectOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
                    background: isLight ? '#fff' : '#1c1c1f',
                    border: `1px solid ${isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                    maxHeight: 280, overflowY: 'auto', padding: 6,
                  }}>
                    {SUBJECTS.map(({ value, labelKey }) => {
                      const selected = form.subject === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setForm(f => ({ ...f, subject: value }));
                            if (errors.subject) setErrors(r => ({ ...r, subject: '' }));
                            setSubjectOpen(false);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                            padding: '10px 12px', borderRadius: 8, border: 'none',
                            background: selected ? (isLight ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.12)') : 'transparent',
                            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.12s',
                          }}
                          onMouseEnter={e => { if (!selected) e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'; }}
                          onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span style={{ fontSize: 14, fontWeight: selected ? 600 : 400, color: selected ? (isLight ? '#4f46e5' : '#818cf8') : (isLight ? '#374151' : '#d1d5db'), flex: 1 }}>
                            {t(labelKey, value)}
                          </span>
                          {selected && <CheckCircle size={14} color="#818cf8" style={{ flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {errors.subject && <div style={errSt}><AlertCircle size={11} />{errors.subject}</div>}
            </div>

            {/* ── Message ── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ ...labelSt, margin: 0 }}>{t('contactMessageLabel', 'Your Message')}<span style={{ color: '#ef4444', marginLeft: 4 }}>*</span></label>
                <span style={{ fontSize: 12, fontWeight: 600, transition: 'color 0.2s', color: form.message.length >= MAX_CHARS ? '#ef4444' : form.message.length >= 900 ? '#f59e0b' : '#6b7280' }}>
                  {form.message.length} / {MAX_CHARS}
                </span>
              </div>
              <textarea
                placeholder={t('contactMessagePlaceholder', 'Write your message here…')}
                value={form.message}
                disabled={status === 'loading'}
                onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') handleSubmit(e); }}
                onChange={e => {
                  if (e.target.value.length <= MAX_CHARS) {
                    setForm(f => ({ ...f, message: e.target.value }));
                    if (errors.message) setErrors(r => ({ ...r, message: '' }));
                    const ta = e.target;
                    ta.style.height = 'auto';
                    ta.style.height = Math.min(ta.scrollHeight, 400) + 'px';
                  }
                }}
                style={{ ...inputBase(!!errors.message), resize: 'none', minHeight: 150, maxHeight: 400, overflowY: 'auto', lineHeight: 1.65 }}
              />
              {errors.message && <div style={errSt}><AlertCircle size={11} />{errors.message}</div>}
            </div>

            {/* ── Image Upload ── */}
            <div style={{ marginBottom: 32 }}>
              <label style={labelSt}>
                {t('contactImagesLabel', 'Attach Images')}{' '}
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#6b7280' }}>
                  {t('contactImagesOptional', '(optional, up to {{max}})', { max: MAX_IMAGES })}
                </span>
              </label>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                {t('contactImagesHint', 'Screenshots help us understand bugs better. Max 5 MB per image.')}
              </div>

              {images.length < MAX_IMAGES && (
                <div
                  onDragEnter={onDragEnter}
                  onDragLeave={onDragLeave}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onClick={() => status !== 'loading' && fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragging ? '#6366f1' : isLight ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 12,
                    padding: '28px 20px',
                    textAlign: 'center',
                    cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    background: dragging ? (isLight ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.07)') : 'transparent',
                  }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: isLight ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Upload size={18} color="#818cf8" />
                  </div>
                  <div style={{ fontSize: 14, color: isLight ? '#374151' : '#9ca3af', marginBottom: 4 }}>
                    <span style={{ color: '#818cf8', fontWeight: 600 }}>{t('contactImagesClick', 'Click to attach')}</span>{' '}
                    {t('contactImagesDrop', 'or drag and drop')}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{t('contactImagesTypes', 'JPG, PNG, GIF, WEBP — up to 5 MB each')}</div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    style={{ display: 'none' }}
                    onChange={e => { processFiles(e.target.files); e.target.value = ''; }}
                    disabled={status === 'loading'}
                  />
                </div>
              )}

              {imgErr && <div style={{ ...errSt, marginTop: 8 }}><AlertCircle size={11} />{imgErr}</div>}

              {images.length > 0 && (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                    {images.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}` }}>
                        <img src={img.preview} alt={img.name} className="contact-thumb" style={{ width: 80, height: 80, objectFit: 'cover', display: 'block' }} />
                        <button
                          type="button"
                          onClick={() => removeImg(idx)}
                          onMouseEnter={() => setHoveredRemove(idx)}
                          onMouseLeave={() => setHoveredRemove(null)}
                          className="stay-white"
                          style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: hoveredRemove === idx ? '#ef4444' : 'rgba(0,0,0,0.6)', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'background 0.15s' }}
                        >
                          <X size={12} />
                        </button>
                        <div style={{ padding: '4px 6px', background: isLight ? '#f3f4f6' : '#111' }}>
                          <div style={{ fontSize: 10, color: isLight ? '#374151' : '#9ca3af', maxWidth: 68, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.name}</div>
                          <div style={{ fontSize: 10, color: '#6b7280' }}>{formatBytes(img.size)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                    {t('contactImagesSelected', '{{count}} / {{max}} images selected', { count: images.length, max: MAX_IMAGES })}
                  </div>
                </>
              )}
            </div>

            {/* ── Submit ── */}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="stay-white contact-submit"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 12,
                border: 'none',
                background: status === 'loading' ? 'rgba(99,102,241,0.55)' : 'linear-gradient(135deg,#6366f1,#a855f7)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
              onMouseEnter={e => { if (status !== 'loading') e.currentTarget.style.opacity = '0.88'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              {status === 'loading' ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'contact-spin 0.9s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  {t('contactSending', 'Sending…')}
                </>
              ) : (
                <>{t('contactSendButton', 'Send Message')} <Send size={16} /></>
              )}
            </button>
          </form>
        </div>
      </main>

      <Footer />

      <style>{`
        @keyframes contact-spin { to { transform: rotate(360deg); } }
        @media (max-width: 480px) {
          .contact-thumb { width: 68px !important; height: 68px !important; }
          .contact-badge { font-size: 12px !important; padding: 5px 14px !important; }
          .contact-submit { font-size: 14px !important; padding: 13px !important; }
        }
        @media (max-width: 360px) {
          .contact-thumb { width: 60px !important; height: 60px !important; }
        }
      `}</style>
    </div>
  );
}
