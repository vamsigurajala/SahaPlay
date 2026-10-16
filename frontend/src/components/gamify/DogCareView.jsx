import React, { useState, useEffect, useRef } from 'react';
import {
  Bath, Wind, Utensils, Heart, Sparkles, Check,
  RotateCcw, Info, ShieldCheck, Award, X
} from 'lucide-react';
import { dogState } from './dogState';

export default function DogCareView({ onClose }) {
  const [pet, setPet] = useState(() => dogState.get());
  const [activeAction, setActiveAction] = useState(null); // 'bath' | 'dry' | 'feed' | 'pet'
  const [actionMessage, setActionMessage] = useState('');
  const [isLight, setIsLight] = useState(() => {
    return typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  });

  useEffect(() => {
    const unsub = dogState.subscribe(setPet);
    // Listen for dark/light mode attribute changes dynamically
    const obs = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      unsub();
      obs.disconnect();
    };
  }, []);

  const timerRef = useRef(null);
  const triggerAction = (type) => {
    if (activeAction) return; // prevent overlapping animations
    setActiveAction(type);

    if (type === 'bath') {
      setActionMessage('Lathering Buddy with gentle lavender shampoo and warm water...');
      timerRef.current = setTimeout(() => {
        dogState.bath();
        setActiveAction(null);
        setActionMessage('All washed! Buddy is clean but damp — give him a warm dry!');
      }, 2400);
    } else if (type === 'dry') {
      setActionMessage('Blow-drying Buddy with warm gentle air and a fluffy towel...');
      timerRef.current = setTimeout(() => {
        dogState.dry();
        setActiveAction(null);
        setActionMessage('Buddy is completely dry, fluffy, and sparkling clean!');
      }, 2400);
    } else if (type === 'feed') {
      setActionMessage('Serving a delicious bowl of wholesome dog treats and kibble...');
      timerRef.current = setTimeout(() => {
        dogState.feed();
        setActiveAction(null);
        setActionMessage('Yum! Buddy chomped down every bite and wagged his tail!');
      }, 2200);
    } else if (type === 'pet') {
      setActionMessage('Giving Buddy warm belly rubs and gentle ear scratches...');
      timerRef.current = setTimeout(() => {
        dogState.pet();
        setActiveAction(null);
        setActionMessage('Buddy loved the affection! Heart full of joy!');
      }, 2000);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const isDirty = pet.cleanliness < 60;
  const isWet = pet.cleanliness >= 60 && pet.cleanliness < 95;
  const isCleanAndFluffy = pet.cleanliness >= 95;

  // Theme-adaptive styling palette
  const cardBg = isLight
    ? 'linear-gradient(165deg, rgba(255,255,255,0.98), rgba(245,247,252,0.99))'
    : 'linear-gradient(165deg, rgba(28,22,48,0.96), rgba(12,8,22,0.98))';
  const cardBorder = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.16)';
  const textTitle = isLight ? '#0f172a' : '#ffffff';
  const textSub = isLight ? '#475569' : '#b3b0c8';
  const statTrackBg = isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)';
  const innerCardBg = isLight ? 'rgba(241,245,249,0.85)' : 'rgba(255,255,255,0.04)';
  const innerCardBorder = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: 680,
        borderRadius: 24,
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: isLight
          ? '0 24px 60px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1)'
          : '0 24px 60px rgba(0,0,0,0.65), 0 0 40px rgba(139,92,255,0.18)',
        backdropFilter: 'blur(16px)',
        overflow: 'hidden',
        color: textTitle,
        display: 'flex',
        flexDirection: 'column',
        animation: 'gp-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes dog-breath { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.025); } }
        @keyframes ear-flop { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(6deg); } }
        @keyframes ear-flop-r { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-6deg); } }
        @keyframes tail-wiggle { 0%, 100% { transform: rotate(-18deg); } 50% { transform: rotate(20deg); } }
        @keyframes bubble-float-1 { 0% { transform: translate(0, 40px) scale(0.4); opacity: 0; } 50% { opacity: 0.9; } 100% { transform: translate(-20px, -70px) scale(1.2); opacity: 0; } }
        @keyframes bubble-float-2 { 0% { transform: translate(0, 30px) scale(0.3); opacity: 0; } 50% { opacity: 0.85; } 100% { transform: translate(25px, -80px) scale(1.1); opacity: 0; } }
        @keyframes wind-gust-anim { 0% { transform: translateX(-40px); opacity: 0; } 50% { opacity: 0.8; } 100% { transform: translateX(50px); opacity: 0; } }
        @keyframes dog-shake-wiggle { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-5deg) scaleX(0.96); } 75% { transform: rotate(5deg) scaleX(1.04); } }
        @keyframes food-chomp { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(4px) scaleY(0.95); } }
        @keyframes heart-rise { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 50% { opacity: 1; } 100% { transform: translateY(-45px) scale(1.2); opacity: 0; } }
        @keyframes sparkle-twinkle { 0%, 100% { transform: scale(0.8) rotate(0); opacity: 0.4; } 50% { transform: scale(1.2) rotate(45deg); opacity: 1; } }
      `}</style>

      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: `1px solid ${innerCardBorder}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(139,92,255,0.4)',
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>
              Buddy — Courtyard Companion
            </div>
            <div style={{ fontSize: 12, color: textSub }}>
              {isDirty
                ? 'Coat is muddy from lawn play — needs a warm bath!'
                : isWet
                ? 'Freshly washed! Blow dry to fluff coat.'
                : 'Pristine, happy and ready to play!'}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          title="Close"
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: `1px solid ${innerCardBorder}`,
            background: innerCardBg,
            color: textTitle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <X size={17} />
        </button>
      </div>

      {/* Main interactive Dog viewport */}
      <div
        style={{
          position: 'relative',
          padding: '24px 20px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: isLight
            ? 'radial-gradient(circle at 50% 40%, rgba(224,231,255,0.5), transparent 70%)'
            : 'radial-gradient(circle at 50% 40%, rgba(139,92,255,0.18), transparent 70%)',
        }}
      >
        {/* Floating status tag */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 800,
            background: isDirty
              ? 'rgba(234, 88, 12, 0.15)'
              : isWet
              ? 'rgba(6, 182, 212, 0.15)'
              : 'rgba(16, 185, 129, 0.15)',
            color: isDirty ? '#ea580c' : isWet ? '#06b6d4' : '#10b981',
            border: isDirty
              ? '1px solid rgba(234, 88, 12, 0.35)'
              : isWet
              ? '1px solid rgba(6, 182, 212, 0.35)'
              : '1px solid rgba(16, 185, 129, 0.35)',
          }}
        >
          {isDirty ? 'Needs Bath' : isWet ? 'Needs Drying' : 'Sparkling Clean'}
        </div>

        {/* Cute Illustrated SVG Dog with dynamic animations */}
        <div
          style={{
            width: 220,
            height: 200,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: activeAction === 'dry'
              ? 'dog-shake-wiggle 0.4s infinite'
              : activeAction === 'feed'
              ? 'food-chomp 0.5s infinite'
              : 'dog-breath 3.5s ease-in-out infinite',
          }}
        >
          <svg viewBox="0 0 240 220" width="220" height="200" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="furGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isDirty ? '#c48039' : '#f5a65b'} />
                <stop offset="100%" stopColor={isDirty ? '#a86524' : '#d97d2e'} />
              </linearGradient>
              <linearGradient id="bibGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isDirty ? '#ded0b8' : '#fff7ed'} />
                <stop offset="100%" stopColor={isDirty ? '#c8b69b' : '#ffedd5'} />
              </linearGradient>
              <linearGradient id="earGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isDirty ? '#9e5a1b' : '#c96f24'} />
                <stop offset="100%" stopColor={isDirty ? '#7d4310' : '#a85315'} />
              </linearGradient>
            </defs>

            {/* Wagging Tail */}
            <g style={{ transformOrigin: '40px 145px', animation: 'tail-wiggle 1.2s ease-in-out infinite' }}>
              <path d="M 40 145 Q 15 125 10 90 Q 25 95 44 135 Z" fill="url(#furGradient)" />
              <path d="M 10 90 Q 25 95 28 108 Q 18 102 10 90 Z" fill="#ffffff" />
            </g>

            {/* Back Paws */}
            <ellipse cx="65" cy="180" rx="16" ry="10" fill={isDirty ? '#8f4f16' : '#d97d2e'} />
            <ellipse cx="175" cy="180" rx="16" ry="10" fill={isDirty ? '#8f4f16' : '#d97d2e'} />

            {/* Torso */}
            <ellipse cx="120" cy="145" rx="55" ry="42" fill="url(#furGradient)" />

            {/* Fluffy White Chest / Bib */}
            <path d="M 98 120 Q 120 135 142 120 Q 148 165 120 175 Q 92 165 98 120 Z" fill="url(#bibGradient)" />

            {/* Mud splatters on body if dirty */}
            {isDirty && (
              <g opacity={Math.min(1, (100 - pet.cleanliness) / 70)}>
                <ellipse cx="88" cy="148" rx="8" ry="6" fill="#4d290c" opacity="0.8" />
                <ellipse cx="152" cy="138" rx="7" ry="5" fill="#4d290c" opacity="0.8" />
                <ellipse cx="128" cy="160" rx="9" ry="5" fill="#3f210a" opacity="0.85" />
                <circle cx="102" cy="166" r="4" fill="#4d290c" opacity="0.75" />
              </g>
            )}

            {/* Front Paws */}
            <ellipse cx="102" cy="182" rx="13" ry="9" fill={isDirty ? '#a86524' : '#fff7ed'} />
            <ellipse cx="138" cy="182" rx="13" ry="9" fill={isDirty ? '#a86524' : '#fff7ed'} />
            {isDirty && (
              <g>
                <ellipse cx="102" cy="183" rx="7" ry="4" fill="#4d290c" opacity="0.75" />
                <ellipse cx="138" cy="183" rx="7" ry="4" fill="#4d290c" opacity="0.75" />
              </g>
            )}

            {/* Red Collar & Gold Medallion */}
            <path d="M 92 108 Q 120 122 148 108 Q 144 116 120 128 Q 96 116 92 108 Z" fill="#ef4444" />
            <circle cx="120" cy="122" r="7" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />

            {/* Floppy Left Ear */}
            <g style={{ transformOrigin: '82px 65px', animation: 'ear-flop 2.5s ease-in-out infinite' }}>
              <path d="M 82 65 C 55 60, 48 105, 68 120 C 78 125, 88 100, 85 75 Z" fill="url(#earGradient)" />
            </g>

            {/* Floppy Right Ear */}
            <g style={{ transformOrigin: '158px 65px', animation: 'ear-flop-r 2.5s ease-in-out infinite' }}>
              <path d="M 158 65 C 185 60, 192 105, 172 120 C 162 125, 152 100, 155 75 Z" fill="url(#earGradient)" />
            </g>

            {/* Head */}
            <ellipse cx="120" cy="74" rx="44" ry="38" fill="url(#furGradient)" />

            {/* Cute White Snout */}
            <ellipse cx="120" cy="84" rx="20" ry="15" fill="url(#bibGradient)" />

            {/* Black Button Nose */}
            <path d="M 114 77 Q 120 74 126 77 Q 123 84 120 84 Q 117 84 114 77 Z" fill="#18181b" />
            <circle cx="118" cy="77" r="1.5" fill="#ffffff" />

            {/* Smiling Mouth */}
            <path d="M 115 85 Q 120 90 125 85" stroke="#18181b" strokeWidth="2" strokeLinecap="round" fill="none" />
            {/* Little Pink Tongue when happy */}
            {!isDirty && (
              <path d="M 117 88 Q 120 96 123 88 Z" fill="#f43f5e" />
            )}

            {/* Mud on cheek if dirty */}
            {isDirty && (
              <g opacity={Math.min(1, (100 - pet.cleanliness) / 60)}>
                <ellipse cx="144" cy="72" rx="7" ry="5" fill="#4d290c" opacity="0.8" />
                <circle cx="98" cy="68" r="4.5" fill="#4d290c" opacity="0.75" />
              </g>
            )}

            {/* Anime Puppy Eyes */}
            {activeAction === 'bath' ? (
              // Happy squinting closed eyes while enjoying bath
              <g stroke="#18181b" strokeWidth="3" strokeLinecap="round" fill="none">
                <path d="M 100 68 Q 106 63 112 68" />
                <path d="M 128 68 Q 134 63 140 68" />
              </g>
            ) : (
              <g>
                {/* Left Eye */}
                <ellipse cx="106" cy="66" rx="7" ry="9" fill="#18181b" />
                <circle cx="104" cy="63" r="3" fill="#ffffff" />
                <circle cx="108" cy="68" r="1.5" fill="#ffffff" />

                {/* Right Eye */}
                <ellipse cx="134" cy="66" rx="7" ry="9" fill="#18181b" />
                <circle cx="132" cy="63" r="3" fill="#ffffff" />
                <circle cx="136" cy="68" r="1.5" fill="#ffffff" />
              </g>
            )}

            {/* Rosy Cheeks */}
            <ellipse cx="94" cy="78" rx="6" ry="4" fill="#fb7185" opacity="0.45" />
            <ellipse cx="146" cy="78" rx="6" ry="4" fill="#fb7185" opacity="0.45" />
          </svg>

          {/* ACTIVE ACTION OVERLAYS */}
          {/* Bath soap bubbles & water droplets */}
          {activeAction === 'bath' && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 50, left: 60, width: 22, height: 22, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #ffffff, rgba(147,197,253,0.8))', border: '1px solid rgba(255,255,255,0.8)', animation: 'bubble-float-1 1.8s infinite' }} />
              <div style={{ position: 'absolute', top: 70, right: 60, width: 26, height: 26, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #ffffff, rgba(196,181,253,0.8))', border: '1px solid rgba(255,255,255,0.8)', animation: 'bubble-float-2 1.6s infinite 0.2s' }} />
              <div style={{ position: 'absolute', top: 30, left: 110, width: 18, height: 18, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #ffffff, rgba(167,243,208,0.8))', border: '1px solid rgba(255,255,255,0.8)', animation: 'bubble-float-1 2s infinite 0.5s' }} />
              <div style={{ position: 'absolute', bottom: 40, left: 90, width: 14, height: 14, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', animation: 'bubble-float-2 1.4s infinite 0.4s' }} />
            </div>
          )}

          {/* Blow Dry warm wind lines & water splash drops flying off */}
          {activeAction === 'dry' && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', top: 60, left: 20, width: 60, height: 3, background: 'linear-gradient(90deg, transparent, #38bdf8, transparent)', borderRadius: 99, animation: 'wind-gust-anim 1s infinite' }} />
              <div style={{ position: 'absolute', top: 90, left: 40, width: 80, height: 3, background: 'linear-gradient(90deg, transparent, #818cf8, transparent)', borderRadius: 99, animation: 'wind-gust-anim 1s infinite 0.3s' }} />
              <div style={{ position: 'absolute', top: 120, left: 10, width: 70, height: 3, background: 'linear-gradient(90deg, transparent, #38bdf8, transparent)', borderRadius: 99, animation: 'wind-gust-anim 1s infinite 0.6s' }} />
            </div>
          )}

          {/* Feeding hearts & food bowl */}
          {activeAction === 'feed' && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ position: 'absolute', top: 40, color: '#f43f5e', animation: 'heart-rise 1.5s infinite' }}><Heart size={24} fill="#f43f5e" /></div>
              <div style={{ position: 'absolute', top: 60, right: 40, color: '#fb7185', animation: 'heart-rise 1.5s infinite 0.4s' }}><Heart size={18} fill="#fb7185" /></div>
              <div style={{ position: 'absolute', bottom: 10, background: '#e2e8f0', borderRadius: '50%', width: 70, height: 24, border: '2px solid #94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 8px rgba(0,0,0,0.2)' }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#475569' }}>KIBBLE</span>
              </div>
            </div>
          )}

          {/* Petting / Affection sparkles & hearts */}
          {activeAction === 'pet' && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', top: 20, left: 50, color: '#ec4899', animation: 'heart-rise 1.4s infinite' }}><Heart size={22} fill="#ec4899" /></div>
              <div style={{ position: 'absolute', top: 30, right: 50, color: '#f59e0b', animation: 'sparkle-twinkle 1.2s infinite' }}><Sparkles size={26} /></div>
              <div style={{ position: 'absolute', bottom: 50, left: 30, color: '#8b5cf6', animation: 'sparkle-twinkle 1.4s infinite 0.3s' }}><Sparkles size={20} /></div>
            </div>
          )}

          {/* Clean sparkles around dog when fully clean */}
          {isCleanAndFluffy && !activeAction && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', top: 20, right: 30, color: '#fbbf24', animation: 'sparkle-twinkle 2s infinite' }}><Sparkles size={20} /></div>
              <div style={{ position: 'absolute', top: 60, left: 20, color: '#38bdf8', animation: 'sparkle-twinkle 2.4s infinite 0.8s' }}><Sparkles size={16} /></div>
            </div>
          )}
        </div>

        {/* Live action / status feedback toast */}
        <div
          style={{
            marginTop: 10,
            fontSize: 13,
            fontWeight: 700,
            color: activeAction ? '#8b5cf6' : textSub,
            textAlign: 'center',
            minHeight: 20,
            transition: 'color 0.2s',
          }}
        >
          {actionMessage || (isDirty ? 'Buddy looks muddy from the garden! Tap Bath to clean him up.' : 'Buddy is happily wagging his tail!')}
        </div>
      </div>

      {/* Pet Vital Statistics Dashboard */}
      <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Cleanliness Meter */}
        <div style={{ background: innerCardBg, border: `1px solid ${innerCardBorder}`, borderRadius: 14, padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12, fontWeight: 700 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bath size={14} color="#06b6d4" />
              Cleanliness
            </span>
            <span style={{ color: pet.cleanliness > 80 ? '#10b981' : pet.cleanliness > 40 ? '#f59e0b' : '#ef4444' }}>
              {pet.cleanliness}%
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: statTrackBg, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${pet.cleanliness}%`,
                borderRadius: 99,
                background: pet.cleanliness < 50
                  ? 'linear-gradient(90deg, #b45309, #d97706)'
                  : 'linear-gradient(90deg, #06b6d4, #10b981)',
                transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>
        </div>

        {/* Hunger & Happiness in 2 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {/* Hunger Meter */}
          <div style={{ background: innerCardBg, border: `1px solid ${innerCardBorder}`, borderRadius: 14, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12, fontWeight: 700 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Utensils size={14} color="#f97316" />
                Nutrition
              </span>
              <span style={{ color: pet.hunger > 60 ? '#10b981' : '#f97316' }}>{pet.hunger}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: statTrackBg, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${pet.hunger}%`,
                  borderRadius: 99,
                  background: 'linear-gradient(90deg, #ea580c, #22c55e)',
                  transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>
          </div>

          {/* Happiness Meter */}
          <div style={{ background: innerCardBg, border: `1px solid ${innerCardBorder}`, borderRadius: 14, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12, fontWeight: 700 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Heart size={14} color="#ec4899" />
                Happiness
              </span>
              <span style={{ color: pet.happiness > 60 ? '#ec4899' : '#8b5cf6' }}>{pet.happiness}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: statTrackBg, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${pet.happiness}%`,
                  borderRadius: 99,
                  background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
                  transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Action Buttons */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          padding: '12px 20px 20px',
          borderTop: `1px solid ${innerCardBorder}`,
        }}
      >
        {/* Bath Button */}
        <button
          onClick={() => triggerAction('bath')}
          disabled={activeAction !== null}
          style={{
            padding: '12px 8px',
            borderRadius: 14,
            border: 'none',
            cursor: activeAction ? 'not-allowed' : 'pointer',
            opacity: activeAction && activeAction !== 'bath' ? 0.4 : 1,
            background: activeAction === 'bath'
              ? 'linear-gradient(135deg, #0284c7, #06b6d4)'
              : isLight
              ? 'linear-gradient(135deg, #e0f2fe, #bae6fd)'
              : 'rgba(6, 182, 212, 0.18)',
            color: activeAction === 'bath' || !isLight ? '#38bdf8' : '#0369a1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            fontWeight: 800,
            fontSize: 12,
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: activeAction === 'bath' ? 'scale(0.96)' : 'scale(1)',
            boxShadow: activeAction === 'bath' ? '0 0 16px rgba(6,182,212,0.5)' : 'none',
          }}
        >
          <Bath size={20} />
          <span>Bath Dog</span>
        </button>

        {/* Dry Button */}
        <button
          onClick={() => triggerAction('dry')}
          disabled={activeAction !== null}
          style={{
            padding: '12px 8px',
            borderRadius: 14,
            border: 'none',
            cursor: activeAction ? 'not-allowed' : 'pointer',
            opacity: activeAction && activeAction !== 'dry' ? 0.4 : 1,
            background: activeAction === 'dry'
              ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
              : isLight
              ? 'linear-gradient(135deg, #ede9fe, #ddd6fe)'
              : 'rgba(139, 92, 246, 0.18)',
            color: activeAction === 'dry' || !isLight ? '#a78bfa' : '#6d28d9',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            fontWeight: 800,
            fontSize: 12,
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: activeAction === 'dry' ? 'scale(0.96)' : 'scale(1)',
            boxShadow: activeAction === 'dry' ? '0 0 16px rgba(139,92,246,0.5)' : 'none',
          }}
        >
          <Wind size={20} />
          <span>Dry Dog</span>
        </button>

        {/* Feed Button */}
        <button
          onClick={() => triggerAction('feed')}
          disabled={activeAction !== null}
          style={{
            padding: '12px 8px',
            borderRadius: 14,
            border: 'none',
            cursor: activeAction ? 'not-allowed' : 'pointer',
            opacity: activeAction && activeAction !== 'feed' ? 0.4 : 1,
            background: activeAction === 'feed'
              ? 'linear-gradient(135deg, #f97316, #fb923c)'
              : isLight
              ? 'linear-gradient(135deg, #ffedd5, #fed7aa)'
              : 'rgba(249, 115, 22, 0.18)',
            color: activeAction === 'feed' || !isLight ? '#fb923c' : '#c2410c',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            fontWeight: 800,
            fontSize: 12,
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: activeAction === 'feed' ? 'scale(0.96)' : 'scale(1)',
            boxShadow: activeAction === 'feed' ? '0 0 16px rgba(249,115,22,0.5)' : 'none',
          }}
        >
          <Utensils size={20} />
          <span>Feed Dog</span>
        </button>

        {/* Pet Button */}
        <button
          onClick={() => triggerAction('pet')}
          disabled={activeAction !== null}
          style={{
            padding: '12px 8px',
            borderRadius: 14,
            border: 'none',
            cursor: activeAction ? 'not-allowed' : 'pointer',
            opacity: activeAction && activeAction !== 'pet' ? 0.4 : 1,
            background: activeAction === 'pet'
              ? 'linear-gradient(135deg, #ec4899, #f43f5e)'
              : isLight
              ? 'linear-gradient(135deg, #fce7f3, #fbcfe8)'
              : 'rgba(236, 72, 153, 0.18)',
            color: activeAction === 'pet' || !isLight ? '#f472b6' : '#be185d',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            fontWeight: 800,
            fontSize: 12,
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: activeAction === 'pet' ? 'scale(0.96)' : 'scale(1)',
            boxShadow: activeAction === 'pet' ? '0 0 16px rgba(236,72,153,0.5)' : 'none',
          }}
        >
          <Heart size={20} />
          <span>Pet & Play</span>
        </button>
      </div>
    </div>
  );
}
