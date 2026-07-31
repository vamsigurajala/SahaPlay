import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SeoHead from './components/SeoHead';
import { Mail, Check } from 'lucide-react';

const Pricing = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem('watch_theme') || 'dark');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const handler = () => setTheme(localStorage.getItem('watch_theme') || 'dark');
    window.addEventListener('theme_changed', handler);
    return () => window.removeEventListener('theme_changed', handler);
  }, []);

  const isLight = theme === 'light';

  const handleNotify = (e) => {
    e.preventDefault();
    if (email.trim()) setSubmitted(true);
  };

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: '/month',
      desc: 'Perfect for getting started',
      features: ['2 active rooms', '5 watchers per room', 'Basic group chat', 'Standard quality'],
      highlight: false,
    },
    {
      name: 'Pro',
      price: '$?.??',
      period: '/month',
      desc: 'For power watchers',
      features: ['Unlimited rooms', '20 watchers per room', 'HD quality', 'Priority support'],
      highlight: true,
    },
    {
      name: 'Team',
      price: '$?.??',
      period: '/month',
      desc: 'For groups & communities',
      features: ['Unlimited everything', 'Custom branding', 'Admin controls', 'Analytics'],
      highlight: false,
    },
  ];

  const cardBase = {
    borderRadius: 16,
    padding: '32px 28px',
    pointerEvents: 'none',
    userSelect: 'none',
  };

  return (
    <div className="page-enter" style={{
      minHeight: '100vh',
      background: isLight
        ? 'linear-gradient(135deg, #f0f0f8 0%, #e8e8f5 50%, #f0f0f8 100%)'
        : '#09090b',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <SeoHead path="/pricing" />
      <Navbar />
      <Toaster position="top-center" />

      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '80px 24px 100px',
      }}>

        {/* ── Coming Soon Badge ── */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: isLight ? 'rgba(251,191,36,0.18)' : 'rgba(251,191,36,0.12)',
          border: `1px solid rgba(251,191,36,${isLight ? '0.4' : '0.28'})`,
          color: isLight ? '#b45309' : '#fbbf24',
          padding: '6px 18px',
          borderRadius: 100,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.3px',
          marginBottom: 32,
        }}>
          🚧 Coming Soon
        </div>

        {/* ── Main Title ── */}
        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 56px)',
          fontWeight: 900,
          textAlign: 'center',
          margin: '0 0 20px',
          color: isLight ? '#111827' : '#fff',
          letterSpacing: '-1.5px',
          lineHeight: 1.1,
        }}>
          Pricing Is on Its Way
        </h1>

        {/* ── Subtitle ── */}
        <p style={{
          textAlign: 'center',
          fontSize: 18,
          lineHeight: 1.75,
          color: isLight ? '#4a5568' : '#9ca3af',
          maxWidth: 460,
          margin: '0 0 56px',
        }}>
          We're still working on our plans.{' '}
          Right now, everything is completely
          free — no limits, no credit card.
        </p>

        {/* ── Free Banner ── */}
        <div
          className="stay-white"
          style={{
            width: '100%',
            maxWidth: 600,
            background: 'linear-gradient(135deg, var(--brand-1) 0%, var(--brand-2) 100%)',
            borderRadius: 20,
            padding: '40px 48px',
            marginBottom: 72,
            boxShadow: '0 24px 60px rgba(var(--brand-1-rgb),0.38)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative blobs */}
          <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, background: 'rgba(255,255,255,0.07)', borderRadius: '50%', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -40, left: -50, width: 160, height: 160, background: 'rgba(255,255,255,0.05)', borderRadius: '50%', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 14, lineHeight: 1.3 }}>
              ✨ 100% Free Right Now
            </div>
            <p style={{ color: 'rgba(255,255,255,0.87)', fontSize: 16, lineHeight: 1.75, margin: 0 }}>
              Create rooms, invite friends, chat privately, and watch together —
              all features are free while we're getting started.
            </p>
          </div>
        </div>

        {/* ── Plan Cards Preview (blurred) ── */}
        <div style={{ width: '100%', maxWidth: 960, marginBottom: 72 }}>
          <p style={{
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 800,
            color: isLight ? 'var(--brand-1)' : 'var(--brand-1-light)',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            marginBottom: 32,
          }}>
            Preview — Plans Coming Soon
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 24,
          }}>
            {plans.map((plan, idx) => (
              <div key={idx} style={{ position: 'relative' }}>

                {/* Blurred card content */}
                <div
                  className="gcw-force-dark"
                  style={{
                    ...cardBase,
                    filter: 'blur(4px)',
                    opacity: 0.5,
                    background: plan.highlight
                      ? 'linear-gradient(135deg, var(--brand-1), var(--brand-2))'
                      : isLight ? '#fff' : '#111',
                    border: plan.highlight
                      ? 'none'
                      : `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'}`,
                    boxShadow: plan.highlight
                      ? '0 20px 60px rgba(var(--brand-1-rgb),0.35)'
                      : isLight
                        ? '0 4px 20px rgba(0,0,0,0.06)'
                        : '0 4px 20px rgba(0,0,0,0.3)',
                  }}
                >
                  {/* Popular badge on Pro */}
                  {plan.highlight && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.18)', borderRadius: 100, padding: '3px 10px', fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '0.5px', marginBottom: 14 }}>
                      ✦ POPULAR
                    </div>
                  )}

                  {/* Plan name */}
                  <div style={{ fontSize: 12, fontWeight: 800, color: plan.highlight ? 'rgba(255,255,255,0.7)' : isLight ? 'var(--brand-1)' : 'var(--brand-1-light)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 14 }}>
                    {plan.name}
                  </div>

                  {/* Price */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                    <span style={{ fontSize: 42, fontWeight: 900, color: plan.highlight ? '#fff' : isLight ? '#111' : '#fff', letterSpacing: '-1px' }}>
                      {plan.price}
                    </span>
                    <span style={{ fontSize: 14, color: plan.highlight ? 'rgba(255,255,255,0.6)' : isLight ? '#9ca3af' : '#555' }}>
                      {plan.period}
                    </span>
                  </div>

                  {/* Desc */}
                  <p style={{ fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.7)' : isLight ? '#6b7280' : '#888', margin: '0 0 24px' }}>
                    {plan.desc}
                  </p>

                  {/* Features */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                    {plan.features.map((f, fi) => (
                      <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.85)' : isLight ? '#374151' : '#ccc' }}>
                        <div style={{ width: 17, height: 17, borderRadius: '50%', background: plan.highlight ? 'rgba(255,255,255,0.18)' : 'rgba(var(--brand-1-rgb),0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={9} color={plan.highlight ? '#fff' : 'var(--brand-1-light)'} />
                        </div>
                        {f}
                      </div>
                    ))}
                  </div>

                  {/* CTA button (static) */}
                  <button style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: plan.highlight ? 'rgba(255,255,255,0.2)' : isLight ? 'rgba(var(--brand-1-rgb),0.08)' : 'rgba(var(--brand-1-rgb),0.1)', color: plan.highlight ? '#fff' : isLight ? 'var(--brand-1)' : 'var(--brand-1-light)', fontWeight: 700, fontSize: 13, cursor: 'default' }}>
                    {plan.name === 'Free' ? 'Current Plan' : 'Get Started'}
                  </button>
                </div>

                {/* Floating "Coming Soon" label over the blur */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(14,14,22,0.88)',
                  backdropFilter: 'blur(6px)',
                  WebkitBackdropFilter: 'blur(6px)',
                  border: `1px solid ${isLight ? 'rgba(var(--brand-1-rgb),0.25)' : 'rgba(var(--brand-1-rgb),0.3)'}`,
                  borderRadius: 100,
                  padding: '9px 22px',
                  fontSize: 12,
                  fontWeight: 800,
                  color: isLight ? 'var(--brand-1-dark)' : 'var(--brand-1-light)',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  pointerEvents: 'none',
                }}>
                  🔒 Coming Soon
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Email Notify Section ── */}
        <div style={{
          width: '100%',
          maxWidth: 520,
          background: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: 20,
          padding: '40px',
          marginBottom: 48,
          boxShadow: isLight
            ? '0 8px 32px rgba(0,0,0,0.07)'
            : '0 8px 40px rgba(0,0,0,0.4)',
          textAlign: 'center',
        }}>
          {/* Mail icon */}
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(var(--brand-1-rgb),0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Mail size={22} color="var(--brand-1-light)" />
          </div>

          <h3 style={{ fontSize: 20, fontWeight: 800, color: isLight ? '#111827' : '#fff', margin: '0 0 8px' }}>
            Want to know when pricing launches?
          </h3>
          <p style={{ fontSize: 14, color: isLight ? '#6b7280' : '#9ca3af', margin: '0 0 28px', lineHeight: 1.65 }}>
            Be the first to know. We'll send you a single email — no spam, ever.
          </p>

          {submitted ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '14px 24px',
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: 12,
              color: '#10b981',
              fontSize: 15,
              fontWeight: 700,
            }}>
              <Check size={18} />
              ✅ We'll let you know!
            </div>
          ) : (
            <form
              onSubmit={handleNotify}
              style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}
            >
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  flex: '1 1 200px',
                  padding: '13px 16px',
                  borderRadius: 12,
                  border: `1px solid ${isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'}`,
                  background: isLight ? '#f9f9ff' : 'rgba(255,255,255,0.05)',
                  color: isLight ? '#111' : '#fff',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                className="stay-white"
                style={{
                  flex: '0 0 auto',
                  padding: '13px 24px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Notify Me
              </button>
            </form>
          )}
        </div>

        {/* ── Bottom Note ── */}
        <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 1.6 }}>
          Questions? Contact us at{' '}
          <a
            href="mailto:support@watchtogether.com"
            style={{ color: isLight ? 'var(--brand-1)' : 'var(--brand-1-light)', fontWeight: 600, textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
          >
            support@watchtogether.com
          </a>
        </p>

      </main>

      <Footer />
    </div>
  );
};

export default Pricing;
