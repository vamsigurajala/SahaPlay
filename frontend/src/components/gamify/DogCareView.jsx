import React, { useState, useEffect, useRef } from 'react';
import {
  Bath, Wind, Utensils, Heart, Sparkles, Check,
  RotateCcw, Info, ShieldCheck, Award, X, Smile, Bone
} from 'lucide-react';
import { dogState } from './dogState';

export default function DogCareView({ onClose }) {
  const [pet, setPet] = useState(() => dogState.get());
  const [activeAction, setActiveAction] = useState(null); // 'bath' | 'dry' | 'feed' | 'pet'
  const [actionMessage, setActionMessage] = useState('');
  const [speechBubble, setSpeechBubble] = useState('Woof! Tap me or care for me! ❤️');
  const [isLight, setIsLight] = useState(() => {
    return typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  });

  useEffect(() => {
    const unsub = dogState.subscribe(setPet);
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
  const speechTimerRef = useRef(null);

  const showSpeech = (text) => {
    setSpeechBubble(text);
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    speechTimerRef.current = setTimeout(() => {
      setSpeechBubble('');
    }, 3200);
  };

  const triggerAction = (type) => {
    if (activeAction) return;
    setActiveAction(type);

    if (type === 'bath') {
      setActionMessage('Lathering Buddy with gentle lavender shampoo & warm water...');
      showSpeech('Splash! Warm bubbly bath feels so good! 🫧');
      timerRef.current = setTimeout(() => {
        dogState.bath();
        setActiveAction(null);
        setActionMessage('All washed! Buddy is clean but damp — give him a warm dry!');
        showSpeech('Shake shake! I am clean but still damp! 🐶');
      }, 2500);
    } else if (type === 'dry') {
      setActionMessage('Blow-drying Buddy with warm gentle air and a fluffy towel...');
      showSpeech('Whoosh! Warm breeze making my coat super fluffy! ✨');
      timerRef.current = setTimeout(() => {
        dogState.dry();
        setActiveAction(null);
        setActionMessage('Buddy is completely dry, fluffy, and sparkling clean!');
        showSpeech('Ta-da! Super fluffy and smelling wonderful! 🌟');
      }, 2500);
    } else if (type === 'feed') {
      setActionMessage('Serving a bowl of wholesome dog treats and crunchy kibble...');
      showSpeech('Crunch crunch! Nom nom! Delicious biscuits! 🦴');
      timerRef.current = setTimeout(() => {
        dogState.feed();
        setActiveAction(null);
        setActionMessage('Yum! Buddy chomped down every bite and wagged his tail!');
        showSpeech('Burp! My tummy is full and happy! ❤️');
      }, 2300);
    } else if (type === 'pet') {
      setActionMessage('Giving Buddy warm belly rubs and gentle ear scratches...');
      showSpeech('Hehe! Oh yes, right behind the ears! Love you! 🥰');
      timerRef.current = setTimeout(() => {
        dogState.pet();
        setActiveAction(null);
        setActionMessage('Buddy loved the affection! Heart full of pure joy!');
        showSpeech('Tail wagging at maximum speed! Let\'s play! 🎾');
      }, 2100);
    }
  };

  const handleDogClick = () => {
    const barks = [
      'Arf arf! Belly rubs please! 🥰',
      'Woof! You are my best friend! ❤️',
      'Pant pant! Having so much fun in the courtyard! 🌸',
      'Boop! My nose is cold and wet! 🐾',
      'Yip! Did somebody say treats? 🦴',
    ];
    const randomBark = barks[Math.floor(Math.random() * barks.length)];
    showSpeech(randomBark);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
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
        @keyframes cute-breathe {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.025, 0.98) translateY(-2px); }
        }
        @keyframes cute-head-tilt {
          0%, 100% { transform: rotate(0deg); }
          30% { transform: rotate(-3deg); }
          70% { transform: rotate(3.5deg); }
        }
        @keyframes cute-ear-l {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(8deg); }
        }
        @keyframes cute-ear-r {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-8deg); }
        }
        @keyframes cute-tail-super-wag {
          0%, 100% { transform: rotate(-26deg); }
          50% { transform: rotate(28deg); }
        }
        @keyframes cute-eye-blink {
          0%, 93%, 100% { transform: scaleY(1); }
          96% { transform: scaleY(0.08); }
        }
        @keyframes cute-tongue-pant {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.22) translateY(1.5px); }
        }
        @keyframes cute-shake-dry {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-8deg) scaleX(0.95); }
          40% { transform: rotate(8deg) scaleX(1.05); }
          60% { transform: rotate(-6deg) scaleX(0.97); }
          80% { transform: rotate(6deg) scaleX(1.03); }
        }
        @keyframes cute-chew-munch {
          0%, 100% { transform: translateY(0); }
          25% { transform: translateY(3px) scaleY(0.96); }
          75% { transform: translateY(-1px) scaleY(1.02); }
        }
        @keyframes soap-bubble-rise-1 {
          0% { transform: translate(0, 30px) scale(0.3); opacity: 0; }
          30% { opacity: 0.95; }
          100% { transform: translate(-28px, -85px) scale(1.25); opacity: 0; }
        }
        @keyframes soap-bubble-rise-2 {
          0% { transform: translate(0, 20px) scale(0.4); opacity: 0; }
          30% { opacity: 0.95; }
          100% { transform: translate(32px, -95px) scale(1.15); opacity: 0; }
        }
        @keyframes warm-wind-stream {
          0% { transform: translateX(-60px); opacity: 0; }
          40% { opacity: 0.85; }
          100% { transform: translateX(70px); opacity: 0; }
        }
        @keyframes heart-float-pop {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          30% { opacity: 1; transform: translateY(-18px) scale(1.15); }
          100% { transform: translateY(-60px) scale(1.3); opacity: 0; }
        }
        @keyframes golden-sparkle-spin {
          0%, 100% { transform: scale(0.8) rotate(0deg); opacity: 0.35; }
          50% { transform: scale(1.3) rotate(45deg); opacity: 1; }
        }
        @keyframes collar-charm-swing {
          0%, 100% { transform: rotate(-10deg); }
          50% { transform: rotate(10deg); }
        }
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
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(245,158,11,0.45)',
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
              Buddy — Courtyard Companion
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 99,
                  background: isDirty
                    ? 'rgba(234, 88, 12, 0.15)'
                    : isWet
                    ? 'rgba(6, 182, 212, 0.15)'
                    : 'rgba(16, 185, 129, 0.15)',
                  color: isDirty ? '#ea580c' : isWet ? '#06b6d4' : '#10b981',
                  border: isDirty
                    ? '1px solid rgba(234, 88, 12, 0.3)'
                    : isWet
                    ? '1px solid rgba(6, 182, 212, 0.3)'
                    : '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                {isDirty ? 'Needs Warm Bath' : isWet ? 'Needs Blow Dry' : 'Sparkling Clean & Fluffy'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: textSub }}>
              {isDirty
                ? 'Coat is muddy from garden play — give him a warm sudsy bath!'
                : isWet
                ? 'Squeaky clean! Blow dry his damp coat to make him warm and fluffy.'
                : 'Pristine, happy and ready to romp around the pond & bridge!'}
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
          padding: '20px 20px 14px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: isLight
            ? 'radial-gradient(circle at 50% 45%, rgba(254, 243, 199, 0.45), rgba(241, 245, 249, 0.2) 70%)'
            : 'radial-gradient(circle at 50% 45%, rgba(245, 158, 11, 0.14), rgba(139, 92, 255, 0.08) 70%)',
        }}
      >
        {/* Animated Speech Bubble */}
        {speechBubble && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              padding: '6px 14px',
              borderRadius: 16,
              background: isLight ? 'rgba(255,255,255,0.96)' : 'rgba(30, 20, 50, 0.92)',
              border: isLight ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(245,158,11,0.4)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
              fontSize: 12,
              fontWeight: 800,
              color: isLight ? '#92400e' : '#fef08a',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              animation: 'gp-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            <span>{speechBubble}</span>
          </div>
        )}

        {/* Cute Illustrated SVG Dog with high-polish Pixar / Anime aesthetic */}
        <div
          onClick={handleDogClick}
          title="Click to interact with Buddy!"
          style={{
            width: 260,
            height: 230,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            animation: activeAction === 'dry'
              ? 'cute-shake-dry 0.45s infinite'
              : activeAction === 'feed'
              ? 'cute-chew-munch 0.45s infinite'
              : 'cute-breathe 3.6s ease-in-out infinite',
            transformOrigin: '50% 90%',
          }}
        >
          <svg viewBox="0 0 280 240" width="260" height="230" style={{ overflow: 'visible' }}>
            <defs>
              {/* Soft Drop Shadow for Grounding */}
              <radialGradient id="groundShadow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(0,0,0,0.22)" />
                <stop offset="60%" stopColor="rgba(0,0,0,0.1)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>

              {/* Head & Fur Main Gradient: Warm Honey Golden */}
              <radialGradient id="pupHead" cx="46%" cy="36%" r="56%">
                <stop offset="0%" stopColor={isDirty ? '#e8a559' : '#fed7aa'} />
                <stop offset="45%" stopColor={isDirty ? '#cf863a' : '#fba749'} />
                <stop offset="85%" stopColor={isDirty ? '#b0651e' : '#e67c22'} />
                <stop offset="100%" stopColor={isDirty ? '#8f4a0b' : '#c9610f'} />
              </radialGradient>

              {/* Body Torso Gradient */}
              <linearGradient id="pupBody" x1="25%" y1="0%" x2="75%" y2="100%">
                <stop offset="0%" stopColor={isDirty ? '#e29a4a' : '#fdb863'} />
                <stop offset="70%" stopColor={isDirty ? '#bd6e23' : '#e67c22'} />
                <stop offset="100%" stopColor={isDirty ? '#964f0f' : '#b85810'} />
              </linearGradient>

              {/* Fluffy Cream Chest & Snout Bib */}
              <radialGradient id="pupWhite" cx="50%" cy="25%" r="70%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="60%" stopColor={isDirty ? '#f2e8dc' : '#fff7ed'} />
                <stop offset="100%" stopColor={isDirty ? '#d9c5ae' : '#ffedd5'} />
              </radialGradient>

              {/* Floppy Left Ear Gradient */}
              <linearGradient id="pupEarL" x1="10%" y1="0%" x2="85%" y2="100%">
                <stop offset="0%" stopColor={isDirty ? '#b86c22' : '#e67c22'} />
                <stop offset="60%" stopColor={isDirty ? '#964d0d' : '#b85810'} />
                <stop offset="100%" stopColor={isDirty ? '#753400' : '#8f3c02'} />
              </linearGradient>

              {/* Floppy Right Ear Gradient */}
              <linearGradient id="pupEarR" x1="90%" y1="0%" x2="15%" y2="100%">
                <stop offset="0%" stopColor={isDirty ? '#b86c22' : '#e67c22'} />
                <stop offset="60%" stopColor={isDirty ? '#964d0d' : '#b85810'} />
                <stop offset="100%" stopColor={isDirty ? '#753400' : '#8f3c02'} />
              </linearGradient>

              {/* Soft Inner Ear Warmth */}
              <radialGradient id="pupEarInner" cx="40%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#ffd8df" />
                <stop offset="80%" stopColor="#fca5a5" />
                <stop offset="100%" stopColor="#e67c22" />
              </radialGradient>

              {/* Sparkling Puppy Iris */}
              <radialGradient id="pupIris" cx="42%" cy="32%" r="62%">
                <stop offset="0%" stopColor="#451a03" />
                <stop offset="55%" stopColor="#220e03" />
                <stop offset="85%" stopColor="#0c0500" />
                <stop offset="100%" stopColor="#d97706" />
              </radialGradient>

              {/* Glossy Black Button Nose */}
              <radialGradient id="pupNose" cx="35%" cy="25%" r="65%">
                <stop offset="0%" stopColor="#64748b" />
                <stop offset="35%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#09090b" />
              </radialGradient>

              {/* Pink Paw Pad Bean */}
              <radialGradient id="pupBean" cx="40%" cy="35%" r="60%">
                <stop offset="0%" stopColor="#fecdd3" />
                <stop offset="70%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#e11d48" />
              </radialGradient>

              {/* Shiny Red Collar */}
              <linearGradient id="pupCollar" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="50%" stopColor="#f87171" />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>

              {/* Golden Bone Pendant */}
              <linearGradient id="pupGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#a16207" />
              </linearGradient>
            </defs>

            {/* Ground Shadow */}
            <ellipse cx="140" cy="214" rx="78" ry="15" fill="url(#groundShadow)" />

            {/* Wagging Fluffy Tail (sweeps back and forth) */}
            <g style={{ transformOrigin: '80px 165px', animation: activeAction === 'pet' ? 'cute-tail-super-wag 0.35s infinite' : 'cute-tail-super-wag 0.9s ease-in-out infinite' }}>
              <path
                d="M 80 165 C 50 155, 34 118, 38 82 C 48 85, 58 100, 68 116 C 76 130, 84 148, 80 165 Z"
                fill="url(#pupBody)"
              />
              {/* Fluffy white tail tip */}
              <path
                d="M 38 82 C 40 70, 52 68, 56 78 C 58 88, 54 94, 46 94 Z"
                fill="#ffffff"
              />
            </g>

            {/* Chubby Round Body */}
            <ellipse cx="140" cy="158" rx="64" ry="48" fill="url(#pupBody)" />

            {/* Rear Paws (resting cutely at sides) */}
            <ellipse cx="78" cy="198" rx="22" ry="14" fill={isDirty ? '#a86524' : '#e67c22'} />
            <ellipse cx="202" cy="198" rx="22" ry="14" fill={isDirty ? '#a86524' : '#e67c22'} />
            {/* Rear Paw White Pads */}
            <ellipse cx="76" cy="199" rx="14" ry="9" fill={isDirty ? '#cfbeaa' : '#fff7ed'} />
            <ellipse cx="204" cy="199" rx="14" ry="9" fill={isDirty ? '#cfbeaa' : '#fff7ed'} />
            {/* Cute Pink Toe Beans on rear paws */}
            <circle cx="76" cy="200" r="5" fill="url(#pupBean)" opacity="0.85" />
            <circle cx="68" cy="196" r="2.5" fill="url(#pupBean)" opacity="0.85" />
            <circle cx="76" cy="193" r="2.5" fill="url(#pupBean)" opacity="0.85" />
            <circle cx="84" cy="196" r="2.5" fill="url(#pupBean)" opacity="0.85" />

            <circle cx="204" cy="200" r="5" fill="url(#pupBean)" opacity="0.85" />
            <circle cx="196" cy="196" r="2.5" fill="url(#pupBean)" opacity="0.85" />
            <circle cx="204" cy="193" r="2.5" fill="url(#pupBean)" opacity="0.85" />
            <circle cx="212" cy="196" r="2.5" fill="url(#pupBean)" opacity="0.85" />

            {/* Fluffy White Chest Bib with Scalloped Cloud Trim */}
            <path
              d="M 112 124 C 122 142, 130 148, 140 148 C 150 148, 158 142, 168 124 C 178 152, 172 188, 140 192 C 108 188, 102 152, 112 124 Z"
              fill="url(#pupWhite)"
            />

            {/* Mud patches on body if dirty */}
            {isDirty && (
              <g opacity={Math.min(1, (100 - pet.cleanliness) / 55)}>
                <ellipse cx="106" cy="162" rx="9" ry="6" fill="#4d290c" opacity="0.85" />
                <ellipse cx="168" cy="154" rx="8" ry="5.5" fill="#4d290c" opacity="0.8" />
                <circle cx="134" cy="174" r="5" fill="#3f210a" opacity="0.85" />
                <circle cx="120" cy="178" r="3.5" fill="#4d290c" opacity="0.75" />
              </g>
            )}

            {/* Two Chubby Front Paws with White Socks */}
            <g>
              {/* Left Front Leg & Paw */}
              <path
                d="M 110 162 L 106 198 C 106 205, 126 205, 126 198 L 122 162 Z"
                fill="url(#pupWhite)"
              />
              <ellipse cx="116" cy="202" rx="13" ry="8" fill={isDirty ? '#cfbeaa' : '#ffffff'} />
              {/* Toe separations */}
              <line x1="112" y1="198" x2="112" y2="204" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="120" y1="198" x2="120" y2="204" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />

              {/* Right Front Leg & Paw */}
              <path
                d="M 158 162 L 154 198 C 154 205, 174 205, 174 198 L 170 162 Z"
                fill="url(#pupWhite)"
              />
              <ellipse cx="164" cy="202" rx="13" ry="8" fill={isDirty ? '#cfbeaa' : '#ffffff'} />
              {/* Toe separations */}
              <line x1="160" y1="198" x2="160" y2="204" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="168" y1="198" x2="168" y2="204" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />
            </g>

            {/* Shiny Red Collar with Golden Bone Charm */}
            <path
              d="M 104 116 Q 140 134 176 116 Q 170 126 140 138 Q 110 126 104 116 Z"
              fill="url(#pupCollar)"
            />
            {/* Golden Bone Pendant with Swinging Physics */}
            <g style={{ transformOrigin: '140px 132px', animation: 'collar-charm-swing 2.2s ease-in-out infinite' }}>
              <circle cx="140" cy="133" r="3" fill="#ca8a04" />
              {/* Mini Golden Bone */}
              <rect x="133" y="137" width="14" height="5" rx="2.5" fill="url(#pupGold)" />
              <circle cx="132" cy="138" r="3" fill="url(#pupGold)" />
              <circle cx="132" cy="141" r="3" fill="url(#pupGold)" />
              <circle cx="148" cy="138" r="3" fill="url(#pupGold)" />
              <circle cx="148" cy="141" r="3" fill="url(#pupGold)" />
              <circle cx="140" cy="139" r="1.2" fill="#ffffff" />
            </g>

            {/* PUPPY HEAD GROUP with Animated Head Tilt */}
            <g style={{ transformOrigin: '140px 90px', animation: 'cute-head-tilt 4.8s ease-in-out infinite' }}>
              {/* Left Floppy Ear (bounces with spring animation) */}
              <g style={{ transformOrigin: '98px 64px', animation: 'cute-ear-l 2.8s ease-in-out infinite' }}>
                <path
                  d="M 98 64 C 62 58, 48 108, 68 132 C 80 144, 98 126, 102 96 Z"
                  fill="url(#pupEarL)"
                />
                {/* Peek of soft pink inner ear */}
                <path
                  d="M 84 80 C 66 84, 60 114, 74 126 C 82 132, 92 118, 92 98 Z"
                  fill="url(#pupEarInner)"
                  opacity="0.8"
                />
              </g>

              {/* Right Floppy Ear (bounces with spring animation) */}
              <g style={{ transformOrigin: '182px 64px', animation: 'cute-ear-r 2.8s ease-in-out infinite' }}>
                <path
                  d="M 182 64 C 218 58, 232 108, 212 132 C 200 144, 182 126, 178 96 Z"
                  fill="url(#pupEarR)"
                />
                {/* Peek of soft pink inner ear */}
                <path
                  d="M 196 80 C 214 84, 220 114, 206 126 C 198 132, 188 118, 188 98 Z"
                  fill="url(#pupEarInner)"
                  opacity="0.8"
                />
              </g>

              {/* Main Puppy Head Skull (Squishy Round Shape) */}
              <ellipse cx="140" cy="80" rx="52" ry="46" fill="url(#pupHead)" />

              {/* Cute Forehead Hair Tuft */}
              <path
                d="M 132 40 C 136 28, 144 26, 146 36 C 148 29, 154 32, 152 42 Z"
                fill={isDirty ? '#cf863a' : '#fba749'}
              />

              {/* Chubby Fluffy Cheeks */}
              <ellipse cx="98" cy="92" rx="22" ry="18" fill="url(#pupHead)" />
              <ellipse cx="182" cy="92" rx="22" ry="18" fill="url(#pupHead)" />

              {/* Rosy Glowing Blushing Cheeks */}
              <ellipse
                cx="100"
                cy="96"
                rx="11"
                ry="7.5"
                fill="#fb7185"
                opacity={activeAction === 'pet' ? 0.75 : 0.45}
              />
              <ellipse
                cx="180"
                cy="96"
                rx="11"
                ry="7.5"
                fill="#fb7185"
                opacity={activeAction === 'pet' ? 0.75 : 0.45}
              />

              {/* Cute Cheek Freckle Dots */}
              <circle cx="96" cy="95" r="1.2" fill="#be123c" opacity="0.6" />
              <circle cx="102" cy="93" r="1.2" fill="#be123c" opacity="0.6" />
              <circle cx="104" cy="97" r="1.2" fill="#be123c" opacity="0.6" />

              <circle cx="184" cy="95" r="1.2" fill="#be123c" opacity="0.6" />
              <circle cx="178" cy="93" r="1.2" fill="#be123c" opacity="0.6" />
              <circle cx="176" cy="97" r="1.2" fill="#be123c" opacity="0.6" />

              {/* Soft Cream Muzzle / Snout */}
              <ellipse cx="140" cy="96" rx="25" ry="19" fill="url(#pupWhite)" />

              {/* Mud smudges on cheeks if dirty */}
              {isDirty && (
                <g opacity={Math.min(1, (100 - pet.cleanliness) / 50)}>
                  <ellipse cx="166" cy="80" rx="7" ry="5" fill="#4d290c" opacity="0.8" />
                  <circle cx="114" cy="74" r="4.5" fill="#4d290c" opacity="0.75" />
                  <ellipse cx="140" cy="54" rx="6" ry="4" fill="#3f210a" opacity="0.7" />
                </g>
              )}

              {/* Glossy Button Nose with Specular Highlight */}
              <path
                d="M 132 87 C 136 84, 144 84, 148 87 C 147 96, 140 98, 140 98 C 140 98, 133 96, 132 87 Z"
                fill="url(#pupNose)"
              />
              {/* Nostril indentations */}
              <circle cx="136" cy="92" r="1.2" fill="#000000" />
              <circle cx="144" cy="92" r="1.2" fill="#000000" />
              {/* Crisp white gloss specular shine */}
              <circle cx="137" cy="87" r="2.2" fill="#ffffff" />
              <circle cx="142" cy="88" r="1" fill="#ffffff" />

              {/* Puppy Smiling Mouth & Panting Tongue */}
              {/* Mouth contour */}
              <path
                d="M 133 99 Q 137 104 140 101 Q 143 104 147 99"
                stroke="#18181b"
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
              />

              {/* Happy Pink Tongue (panting happily when clean or petted) */}
              {(!isDirty || activeAction === 'feed' || activeAction === 'pet') && (
                <g style={{ transformOrigin: '140px 101px', animation: 'cute-tongue-pant 1.4s ease-in-out infinite' }}>
                  <path
                    d="M 136 101 C 136 112, 144 112, 144 101 Z"
                    fill="url(#pupBean)"
                  />
                  <line x1="140" y1="102" x2="140" y2="108" stroke="#be123c" strokeWidth="1" strokeLinecap="round" />
                </g>
              )}

              {/* Sweet Puppy Eyebrows (bob gently) */}
              <path
                d="M 112 60 Q 118 56 124 59"
                stroke={isDirty ? '#8f4a0b' : '#b85810'}
                strokeWidth="2.4"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 156 59 Q 162 56 168 60"
                stroke={isDirty ? '#8f4a0b' : '#b85810'}
                strokeWidth="2.4"
                strokeLinecap="round"
                fill="none"
              />

              {/* BIG GLOSSY ANIME PUPPY EYES with Dynamic Expressions */}
              {activeAction === 'bath' || activeAction === 'pet' ? (
                // Super happy joyful squint eyes (^ ‿ ^)
                <g stroke="#18181b" strokeWidth="3.6" strokeLinecap="round" fill="none">
                  <path d="M 110 77 Q 118 67 126 77" />
                  <path d="M 154 77 Q 162 67 170 77" />
                  {/* Sweet curved blush arcs under eyes */}
                  <path d="M 112 82 Q 118 86 124 82" stroke="#fb7185" strokeWidth="2" opacity="0.8" />
                  <path d="M 156 82 Q 162 86 168 82" stroke="#fb7185" strokeWidth="2" opacity="0.8" />
                </g>
              ) : (
                // Large liquid anime eyes with natural blinking animation
                <g style={{ transformOrigin: '140px 73px', animation: 'cute-eye-blink 4.2s ease-in-out infinite' }}>
                  {/* Left Eye */}
                  <g>
                    {/* Dark socket outline & iris */}
                    <ellipse cx="118" cy="73" rx="11" ry="14" fill="url(#pupIris)" />
                    {/* Deep black pupil center */}
                    <ellipse cx="118" cy="74" rx="8" ry="10" fill="#090502" />
                    {/* Warm honey bottom ring light reflection */}
                    <path
                      d="M 112 76 C 114 83, 122 83, 124 76"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeLinecap="round"
                      fill="none"
                      opacity="0.85"
                    />
                    {/* Primary large glossy highlight */}
                    <ellipse cx="115" cy="68" rx="4.5" ry="5.5" fill="#ffffff" />
                    {/* Secondary crescent twinkle catchlight */}
                    <circle cx="122" cy="78" r="2.2" fill="#ffffff" />
                    {/* Tiny star sparkle reflection */}
                    <circle cx="114" cy="76" r="1.2" fill="#ffffff" />
                  </g>

                  {/* Right Eye */}
                  <g>
                    {/* Dark socket outline & iris */}
                    <ellipse cx="162" cy="73" rx="11" ry="14" fill="url(#pupIris)" />
                    {/* Deep black pupil center */}
                    <ellipse cx="162" cy="74" rx="8" ry="10" fill="#090502" />
                    {/* Warm honey bottom ring light reflection */}
                    <path
                      d="M 156 76 C 158 83, 166 83, 168 76"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeLinecap="round"
                      fill="none"
                      opacity="0.85"
                    />
                    {/* Primary large glossy highlight */}
                    <ellipse cx="159" cy="68" rx="4.5" ry="5.5" fill="#ffffff" />
                    {/* Secondary crescent twinkle catchlight */}
                    <circle cx="166" cy="78" r="2.2" fill="#ffffff" />
                    {/* Tiny star sparkle reflection */}
                    <circle cx="158" cy="76" r="1.2" fill="#ffffff" />
                  </g>
                </g>
              )}

              {/* Bubbly Shampoo Crown on head during bath */}
              {activeAction === 'bath' && (
                <g>
                  <circle cx="130" cy="36" r="8" fill="#ffffff" opacity="0.9" stroke="#93c5fd" strokeWidth="1" />
                  <circle cx="142" cy="30" r="10" fill="#ffffff" opacity="0.95" stroke="#bae6fd" strokeWidth="1" />
                  <circle cx="154" cy="37" r="8" fill="#ffffff" opacity="0.9" stroke="#93c5fd" strokeWidth="1" />
                  <circle cx="140" cy="38" r="6" fill="#ffffff" opacity="0.85" />
                  {/* Suds on cheeks */}
                  <circle cx="86" cy="90" r="6" fill="#ffffff" opacity="0.85" />
                  <circle cx="194" cy="90" r="6" fill="#ffffff" opacity="0.85" />
                </g>
              )}
            </g>
          </svg>

          {/* ACTIVE ACTION OVERLAYS */}
          {/* Bath: Iridescent soap bubbles floating up */}
          {activeAction === 'bath' && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 50, left: 40, width: 28, height: 28, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #ffffff, rgba(147,197,253,0.85))', border: '1px solid rgba(255,255,255,0.9)', animation: 'soap-bubble-rise-1 1.7s infinite' }} />
              <div style={{ position: 'absolute', top: 80, right: 40, width: 32, height: 32, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #ffffff, rgba(196,181,253,0.85))', border: '1px solid rgba(255,255,255,0.9)', animation: 'soap-bubble-rise-2 1.9s infinite 0.2s' }} />
              <div style={{ position: 'absolute', top: 30, left: 120, width: 20, height: 20, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #ffffff, rgba(167,243,208,0.85))', border: '1px solid rgba(255,255,255,0.9)', animation: 'soap-bubble-rise-1 2.1s infinite 0.5s' }} />
              <div style={{ position: 'absolute', bottom: 50, left: 80, width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', animation: 'soap-bubble-rise-2 1.5s infinite 0.4s' }} />
            </div>
          )}

          {/* Blow Dry: Warm air streams & water drops flying away */}
          {activeAction === 'dry' && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', top: 50, left: 10, width: 90, height: 3, background: 'linear-gradient(90deg, transparent, #38bdf8, transparent)', borderRadius: 99, animation: 'warm-wind-stream 0.9s infinite' }} />
              <div style={{ position: 'absolute', top: 85, left: 30, width: 110, height: 4, background: 'linear-gradient(90deg, transparent, #818cf8, transparent)', borderRadius: 99, animation: 'warm-wind-stream 0.9s infinite 0.25s' }} />
              <div style={{ position: 'absolute', top: 120, left: 0, width: 100, height: 3, background: 'linear-gradient(90deg, transparent, #38bdf8, transparent)', borderRadius: 99, animation: 'warm-wind-stream 0.9s infinite 0.5s' }} />
            </div>
          )}

          {/* Feed: Kibble bowl and floating crunchy heart bites */}
          {activeAction === 'feed' && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ position: 'absolute', top: 30, color: '#f43f5e', animation: 'heart-float-pop 1.5s infinite' }}><Heart size={26} fill="#f43f5e" /></div>
              <div style={{ position: 'absolute', top: 50, right: 30, color: '#fb923c', animation: 'heart-float-pop 1.5s infinite 0.4s' }}><Bone size={22} /></div>
              <div style={{ position: 'absolute', bottom: 6, background: 'linear-gradient(135deg, #f1f5f9, #cbd5e1)', borderRadius: '50%', width: 88, height: 28, border: '3px solid #94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px rgba(0,0,0,0.25)' }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#0f172a', letterSpacing: '0.05em' }}>TREATS 🦴</span>
              </div>
            </div>
          )}

          {/* Pet & Play: Radiating heart burst & golden sparkles */}
          {activeAction === 'pet' && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', top: 15, left: 40, color: '#ec4899', animation: 'heart-float-pop 1.3s infinite' }}><Heart size={28} fill="#ec4899" /></div>
              <div style={{ position: 'absolute', top: 25, right: 40, color: '#fbbf24', animation: 'golden-sparkle-spin 1.1s infinite' }}><Sparkles size={30} /></div>
              <div style={{ position: 'absolute', bottom: 60, left: 20, color: '#a855f7', animation: 'golden-sparkle-spin 1.4s infinite 0.3s' }}><Sparkles size={22} /></div>
            </div>
          )}

          {/* Sparkling clean stars when coat is 95%+ and idle */}
          {isCleanAndFluffy && !activeAction && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', top: 18, right: 26, color: '#fbbf24', animation: 'golden-sparkle-spin 2.2s infinite' }}><Sparkles size={24} /></div>
              <div style={{ position: 'absolute', top: 65, left: 16, color: '#38bdf8', animation: 'golden-sparkle-spin 2.6s infinite 0.9s' }}><Sparkles size={18} /></div>
            </div>
          )}
        </div>

        {/* Live action / status feedback toast */}
        <div
          style={{
            marginTop: 8,
            fontSize: 13,
            fontWeight: 700,
            color: activeAction ? '#8b5cf6' : textSub,
            textAlign: 'center',
            minHeight: 20,
            transition: 'color 0.2s',
          }}
        >
          {actionMessage || (isDirty ? 'Buddy looks muddy from the lawn! Tap Bath to wash him up.' : 'Buddy is happily panting and wagging his tail!')}
        </div>
      </div>

      {/* Pet Vital Statistics Dashboard */}
      <div style={{ padding: '0 20px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Cleanliness Meter */}
        <div style={{ background: innerCardBg, border: `1px solid ${innerCardBorder}`, borderRadius: 14, padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12, fontWeight: 700 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bath size={14} color="#06b6d4" />
              Coat Cleanliness
            </span>
            <span style={{ color: pet.cleanliness > 80 ? '#10b981' : pet.cleanliness > 40 ? '#f59e0b' : '#ef4444', fontWeight: 800 }}>
              {pet.cleanliness}% {pet.cleanliness < 60 ? '(Muddy)' : pet.cleanliness < 95 ? '(Damp)' : '(Sparkling)'}
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

        {/* Nutrition & Happiness in 2 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {/* Nutrition Meter */}
          <div style={{ background: innerCardBg, border: `1px solid ${innerCardBorder}`, borderRadius: 14, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12, fontWeight: 700 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Utensils size={14} color="#f97316" />
                Nutrition
              </span>
              <span style={{ color: pet.hunger > 60 ? '#10b981' : '#f97316', fontWeight: 800 }}>{pet.hunger}%</span>
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
              <span style={{ color: pet.happiness > 60 ? '#ec4899' : '#8b5cf6', fontWeight: 800 }}>{pet.happiness}%</span>
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
