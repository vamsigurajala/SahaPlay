import React, { useState, useEffect, useRef } from 'react';
import { Fish, Waves, Sparkles, Droplets, Info, X, Award, Utensils } from 'lucide-react';

const SPECIES_LIST = [
  {
    id: 'kohaku',
    name: 'Kohaku Koi',
    japanese: '紅白',
    scientific: 'Cyprinus rubrofuscus',
    tier: 'Legendary',
    tierColor: '#f97316',
    primaryColor: '#ffffff',
    patternColor: '#ef4444',
    tailColor: '#ffffff',
    desc: 'The timeless monarch of Japanese ornamental ponds. Features a flawless snow-white body draped in bold, vivid crimson markings.',
    symbolism: 'Success, career prosperity, and unwavering courage against the current.',
    lifespan: '25 - 35+ years',
    length: '55 - 75 cm',
  },
  {
    id: 'sanke',
    name: 'Taisho Sanke',
    japanese: '大正三色',
    scientific: 'Cyprinus carpio',
    tier: 'Emperor',
    tierColor: '#8b5cf6',
    primaryColor: '#ffffff',
    patternColor: '#dc2626',
    accentColor: '#18181b',
    tailColor: '#ffffff',
    desc: 'The celebrated tricolor koi developed in the Taisho era. Balanced with striking scarlet clouds and deep sumi inky black lacquer spots.',
    symbolism: 'Tripartite balance, resilience, and boundless familial wealth.',
    lifespan: '30 - 40+ years',
    length: '60 - 80 cm',
  },
  {
    id: 'ogon',
    name: 'Yamabuki Ogon',
    japanese: '山吹黄金',
    scientific: 'Cyprinus carpio v. ogon',
    tier: 'Radiant Gold',
    tierColor: '#eab308',
    primaryColor: '#f59e0b',
    patternColor: '#fbbf24',
    tailColor: '#fef08a',
    desc: 'A magnificent solid metallic golden koi that shimmers brilliantly under sunlight, glistening like liquid amber across the pond.',
    symbolism: 'Golden fortune, material prosperity, and sunlit blessings.',
    lifespan: '25 - 30+ years',
    length: '50 - 70 cm',
  },
  {
    id: 'butterfly',
    name: 'Celestial Butterfly Koi',
    japanese: 'ヒレナガゴイ',
    scientific: 'Cyprinus carpio v. longfin',
    tier: 'Celestial',
    tierColor: '#06b6d4',
    primaryColor: '#f8fafc',
    patternColor: '#38bdf8',
    tailColor: '#e0f2fe',
    desc: 'Known poetically as the Dragon Carp. Boasts elongated, diaphanous ribbon fins and a billowing gossamer tail that flutters like silk.',
    symbolism: 'Grace, freedom of spirit, and celestial transformation.',
    lifespan: '20 - 30 years',
    length: '45 - 65 cm',
  },
  {
    id: 'comet',
    name: 'Golden Comet Fish',
    japanese: 'コメット',
    scientific: 'Carassius auratus',
    tier: 'Energetic',
    tierColor: '#ec4899',
    primaryColor: '#ea580c',
    patternColor: '#f97316',
    tailColor: '#fdba74',
    desc: 'A sleek, agile pond fish with a deep blazing orange-red body and an iconic, deeply indented silver-tipped comet tail.',
    symbolism: 'Swift vitality, playfulness, and perpetual energy.',
    lifespan: '15 - 20 years',
    length: '25 - 35 cm',
  },
  {
    id: 'betta',
    name: 'Sapphire Crown Betta',
    japanese: 'ベタ',
    scientific: 'Betta splendens',
    tier: 'Exotic Jewel',
    tierColor: '#3b82f6',
    primaryColor: '#1d4ed8',
    patternColor: '#60a5fa',
    tailColor: '#93c5fd',
    desc: 'An exotic jewel with iridescent royal sapphire and violet plumage, boasting delicate crown frills and radiant fin flares.',
    symbolism: 'Individuality, royal elegance, and peaceful solitude.',
    lifespan: '4 - 6 years',
    length: '8 - 12 cm',
  },
];

export default function AquariumViewer({ onClose }) {
  const [selectedSpecies, setSelectedSpecies] = useState(SPECIES_LIST[0]);
  const [ripples, setRipples] = useState([]);
  const [foodPellets, setFoodPellets] = useState([]);
  const [isFeeding, setIsFeeding] = useState(false);
  const [toastMessage, setToastMessage] = useState('Tap anywhere in the pond water to create ripples and splash!');
  const [isLight, setIsLight] = useState(() => {
    return typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  });

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // Handle water click / splash
  const handleWaterClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now() + Math.random();
    setRipples(prev => [...prev.slice(-6), { id, x, y }]);
    setToastMessage('Water splashed! Fish dart playfully through the ripples.');
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 1200);
  };

  // Drop food flakes
  const handleFeed = () => {
    if (isFeeding) return;
    setIsFeeding(true);
    setToastMessage('Sprinkling nutritious floating koi pellets into the pond...');
    const newPellets = [
      { id: Date.now() + 1, x: 70 + Math.random() * 100, y: 30 + Math.random() * 20 },
      { id: Date.now() + 2, x: 220 + Math.random() * 120, y: 35 + Math.random() * 25 },
      { id: Date.now() + 3, x: 380 + Math.random() * 100, y: 25 + Math.random() * 20 },
      { id: Date.now() + 4, x: 490 + Math.random() * 80, y: 40 + Math.random() * 20 },
    ];
    setFoodPellets(newPellets);

    setTimeout(() => {
      setToastMessage('The koi swim eagerly to the surface and nibble up every treat!');
    }, 1500);

    setTimeout(() => {
      setFoodPellets([]);
      setIsFeeding(false);
    }, 3200);
  };

  // Theme-adaptive styling palette
  const cardBg = isLight
    ? 'linear-gradient(165deg, rgba(255,255,255,0.98), rgba(240,249,255,0.99))'
    : 'linear-gradient(165deg, rgba(10,22,44,0.97), rgba(4,10,24,0.99))';
  const cardBorder = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(56,189,248,0.25)';
  const textTitle = isLight ? '#0f172a' : '#ffffff';
  const textSub = isLight ? '#475569' : '#94a3b8';
  const innerCardBg = isLight ? 'rgba(241,245,249,0.85)' : 'rgba(255,255,255,0.04)';
  const innerCardBorder = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: 780,
        borderRadius: 24,
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: isLight
          ? '0 24px 60px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1)'
          : '0 24px 60px rgba(0,0,0,0.7), 0 0 40px rgba(6,182,212,0.2)',
        backdropFilter: 'blur(16px)',
        overflow: 'hidden',
        color: textTitle,
        display: 'flex',
        flexDirection: 'column',
        animation: 'gp-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes fish-swim-1 {
          0% { transform: translate(-30px, 0) scaleX(1); }
          48% { transform: translate(520px, -25px) scaleX(1); }
          50% { transform: translate(520px, -25px) scaleX(-1); }
          98% { transform: translate(-30px, 15px) scaleX(-1); }
          100% { transform: translate(-30px, 0) scaleX(1); }
        }
        @keyframes fish-swim-2 {
          0% { transform: translate(540px, 10px) scaleX(-1); }
          48% { transform: translate(-10px, -20px) scaleX(-1); }
          50% { transform: translate(-10px, -20px) scaleX(1); }
          98% { transform: translate(540px, 20px) scaleX(1); }
          100% { transform: translate(540px, 10px) scaleX(-1); }
        }
        @keyframes fish-swim-3 {
          0% { transform: translate(80px, 40px) scaleX(1); }
          50% { transform: translate(440px, 20px) scaleX(1); }
          52% { transform: translate(440px, 20px) scaleX(-1); }
          100% { transform: translate(80px, 40px) scaleX(-1); }
        }
        @keyframes fin-flutter {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(18deg); }
        }
        @keyframes caustic-flow {
          0% { opacity: 0.15; transform: translateY(0) scaleY(1); }
          50% { opacity: 0.35; transform: translateY(8px) scaleY(1.08); }
          100% { opacity: 0.15; transform: translateY(0) scaleY(1); }
        }
        @keyframes ripple-expand {
          0% { width: 10px; height: 10px; opacity: 0.9; }
          100% { width: 140px; height: 140px; opacity: 0; }
        }
        @keyframes pellet-sink {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(65px); opacity: 0.3; }
        }
        @keyframes splash-droplet {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          50% { transform: translateY(-20px) scale(1.2); opacity: 0.9; }
          100% { transform: translateY(10px) scale(0.6); opacity: 0; }
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
              background: 'linear-gradient(135deg, #0284c7, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(2,132,199,0.4)',
            }}
          >
            <Fish size={20} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>
              Zen Koi Pond & Aquarium
            </div>
            <div style={{ fontSize: 12, color: textSub }}>
              Natural aquatic habitat — Tap to splash water, drop food, or inspect pond species
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

      {/* Interactive Aquarium Pond Tank Viewport */}
      <div
        onClick={handleWaterClick}
        style={{
          position: 'relative',
          height: 240,
          background: 'linear-gradient(180deg, #0284c7 0%, #0369a1 40%, #075985 75%, #0c4a6e 100%)',
          overflow: 'hidden',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Shimmering surface water caustics */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.4) 0%, transparent 65%)',
            pointerEvents: 'none',
            animation: 'caustic-flow 4s ease-in-out infinite',
          }}
        />

        {/* Sunlight light beams */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '20%',
            width: 80,
            height: '100%',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.18), transparent 75%)',
            transform: 'skewX(-18deg)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '60%',
            width: 110,
            height: '100%',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.14), transparent 75%)',
            transform: 'skewX(-18deg)',
            pointerEvents: 'none',
          }}
        />

        {/* Floating Water Lily Pads at the top surface */}
        <div style={{ position: 'absolute', top: -10, left: 40, width: 90, height: 26, background: '#166534', borderRadius: '50%', opacity: 0.85 }} />
        <div style={{ position: 'absolute', top: -8, right: 90, width: 110, height: 28, background: '#15803d', borderRadius: '50%', opacity: 0.85 }} />

        {/* Underwater swaying aquatic grasses / reeds at bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 15, width: 12, height: 75, background: 'linear-gradient(to top, #14532d, #22c55e)', borderRadius: '99px 99px 0 0', opacity: 0.7 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 32, width: 14, height: 95, background: 'linear-gradient(to top, #14532d, #16a34a)', borderRadius: '99px 99px 0 0', opacity: 0.8 }} />
        <div style={{ position: 'absolute', bottom: 0, right: 35, width: 15, height: 85, background: 'linear-gradient(to top, #14532d, #22c55e)', borderRadius: '99px 99px 0 0', opacity: 0.75 }} />
        <div style={{ position: 'absolute', bottom: 0, right: 55, width: 12, height: 105, background: 'linear-gradient(to top, #14532d, #16a34a)', borderRadius: '99px 99px 0 0', opacity: 0.8 }} />

        {/* Rising air bubble streams */}
        {[30, 140, 290, 470, 620].map((left, idx) => (
          <div
            key={idx}
            style={{
              position: 'absolute',
              bottom: 10,
              left,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.9)',
              animation: `caustic-flow ${2.5 + idx * 0.4}s ease-in-out infinite`,
            }}
          />
        ))}

        {/* Interactive Splash Ripples */}
        {ripples.map(r => (
          <div
            key={r.id}
            style={{
              position: 'absolute',
              left: r.x,
              top: r.y,
              transform: 'translate(-50%, -50%)',
              border: '2px solid rgba(255, 255, 255, 0.85)',
              borderRadius: '50%',
              pointerEvents: 'none',
              animation: 'ripple-expand 1.2s ease-out forwards',
            }}
          />
        ))}

        {/* Floating Food Pellets */}
        {foodPellets.map(p => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#b45309',
              border: '1px solid #fef08a',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              animation: 'pellet-sink 2.8s ease-in-out forwards',
            }}
          />
        ))}

        {/* SWIMMING FISH ANIMATIONS */}
        {/* Fish 1: Spotlighted / Selected Species */}
        <div
          style={{
            position: 'absolute',
            top: 75,
            left: 20,
            animation: 'fish-swim-1 14s linear infinite',
          }}
        >
          <svg viewBox="0 0 120 48" width="105" height="42">
            {/* Caudal fin / tail */}
            <path
              d="M 18 24 Q 0 10 2 24 Q 0 38 18 24 Z"
              fill={selectedSpecies.tailColor || '#ffffff'}
              style={{ transformOrigin: '18px 24px', animation: 'fin-flutter 0.6s infinite' }}
            />
            {/* Dorsal fin */}
            <path d="M 45 14 Q 60 4 75 16 Z" fill={selectedSpecies.patternColor || '#ef4444'} opacity="0.85" />
            {/* Pectoral side fin */}
            <path d="M 68 26 Q 52 38 60 26 Z" fill={selectedSpecies.tailColor || '#ffffff'} opacity="0.9" />
            {/* Streamlined koi body */}
            <ellipse cx="62" cy="24" rx="38" ry="14" fill={selectedSpecies.primaryColor || '#ffffff'} />
            {/* Distinctive species pattern blotches */}
            <ellipse cx="52" cy="20" rx="16" ry="8" fill={selectedSpecies.patternColor || '#ef4444'} />
            <ellipse cx="78" cy="22" rx="9" ry="6" fill={selectedSpecies.patternColor || '#ef4444'} />
            {selectedSpecies.accentColor && (
              <circle cx="64" cy="24" r="5" fill={selectedSpecies.accentColor} />
            )}
            {/* Eye */}
            <circle cx="92" cy="20" r="3" fill="#0f172a" />
            <circle cx="93" cy="19" r="1" fill="#ffffff" />
          </svg>
        </div>

        {/* Fish 2: Second species swimming oppositely */}
        <div
          style={{
            position: 'absolute',
            top: 135,
            left: 20,
            animation: 'fish-swim-2 18s linear infinite 2s',
          }}
        >
          <svg viewBox="0 0 100 40" width="85" height="34">
            <path d="M 15 20 Q 0 8 2 20 Q 0 32 15 20 Z" fill="#fbbf24" style={{ transformOrigin: '15px 20px', animation: 'fin-flutter 0.5s infinite' }} />
            <ellipse cx="50" cy="20" rx="32" ry="12" fill="#f59e0b" />
            <ellipse cx="44" cy="17" rx="14" ry="6" fill="#fef08a" />
            <circle cx="76" cy="17" r="2.5" fill="#0f172a" />
          </svg>
        </div>

        {/* Fish 3: Playful Golden Comet fish */}
        <div
          style={{
            position: 'absolute',
            top: 45,
            left: 20,
            animation: 'fish-swim-3 12s linear infinite 4s',
          }}
        >
          <svg viewBox="0 0 90 34" width="75" height="28">
            <path d="M 12 17 Q 0 4 2 17 Q 0 30 12 17 Z" fill="#fdba74" style={{ transformOrigin: '12px 17px', animation: 'fin-flutter 0.4s infinite' }} />
            <ellipse cx="44" cy="17" rx="26" ry="9" fill="#ea580c" />
            <ellipse cx="38" cy="15" rx="10" ry="5" fill="#f97316" />
            <circle cx="64" cy="15" r="2.2" fill="#0f172a" />
          </svg>
        </div>

        {/* Water overlay instruction watermark */}
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            right: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 99,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(6px)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            pointerEvents: 'none',
          }}
        >
          <Waves size={13} color="#38bdf8" />
          <span>Click water to splash</span>
        </div>
      </div>

      {/* Action Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          background: innerCardBg,
          borderBottom: `1px solid ${innerCardBorder}`,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: textSub, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={15} color="#06b6d4" />
          <span>{toastMessage}</span>
        </div>

        <button
          onClick={handleFeed}
          disabled={isFeeding}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 12,
            border: 'none',
            background: isFeeding ? 'rgba(234,88,12,0.4)' : 'linear-gradient(135deg, #f97316, #ea580c)',
            color: '#fff',
            cursor: isFeeding ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 800,
            boxShadow: isFeeding ? 'none' : '0 4px 12px rgba(249,115,22,0.4)',
            transition: 'all 0.2s',
          }}
        >
          <Utensils size={15} />
          <span>Feed Fish</span>
        </button>
      </div>

      {/* Species Selector & Educational Cards */}
      <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Award size={16} color="#0ea5e9" />
          <span>Ornamental Species in Pond</span>
        </div>

        {/* Species Horizontal Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
          }}
        >
          {SPECIES_LIST.map(sp => {
            const isSelected = selectedSpecies.id === sp.id;
            return (
              <div
                key={sp.id}
                onClick={() => setSelectedSpecies(sp)}
                style={{
                  padding: '12px',
                  borderRadius: 14,
                  background: isSelected
                    ? isLight ? '#e0f2fe' : 'rgba(2,132,199,0.22)'
                    : innerCardBg,
                  border: isSelected
                    ? '2px solid #0284c7'
                    : `1px solid ${innerCardBorder}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{sp.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: `${sp.tierColor}25`, color: sp.tierColor }}>
                    {sp.tier}
                  </span>
                </div>
                <div style={{ fontSize: 11, fontStyle: 'italic', color: textSub }}>{sp.scientific}</div>
                <div style={{ fontSize: 11, color: textSub, marginTop: 4, lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {sp.desc}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Species In-Depth Profile */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 14,
            background: innerCardBg,
            border: `1px solid ${innerCardBorder}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{selectedSpecies.name}</span>
              <span style={{ fontSize: 12, opacity: 0.6 }}>({selectedSpecies.japanese})</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: selectedSpecies.tierColor }}>
              {selectedSpecies.tier} Tier
            </div>
          </div>

          <div style={{ fontSize: 12, color: textSub, lineHeight: 1.5 }}>
            {selectedSpecies.desc}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 4, paddingTop: 8, borderTop: `1px solid ${innerCardBorder}`, fontSize: 11 }}>
            <div>
              <span style={{ fontWeight: 700, color: textTitle }}>Symbolism: </span>
              <span style={{ color: textSub }}>{selectedSpecies.symbolism}</span>
            </div>
            <div>
              <span style={{ fontWeight: 700, color: textTitle }}>Avg Lifespan: </span>
              <span style={{ color: textSub }}>{selectedSpecies.lifespan}</span>
            </div>
            <div>
              <span style={{ fontWeight: 700, color: textTitle }}>Adult Length: </span>
              <span style={{ color: textSub }}>{selectedSpecies.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
