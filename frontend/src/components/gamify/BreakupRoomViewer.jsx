import React, { useState, useEffect, useRef } from 'react';
import CalmMusicPanel from './CalmMusicPanel';
import { CONTENT, BREAKUP_LANGS, useBreakupLang, setBreakupLang } from './breakupLang';
import { INDIAN_PAINTINGS, ROOM_PAINTING, localizedPainting } from '../../data/gamifyIndianPaintings';
import {
  Heart, HeartCrack, Volume2, VolumeX, Flame, BookOpen, Sparkles,
  Send, RefreshCw, X, Check, Shield, Feather, Music, CloudRain,
  MessageCircle, CornerDownRight, Quote, Brush, Languages
} from 'lucide-react';

// ============================================================================
// SOOTHING RAINSTORM & MELANCHOLIC AUDIO GENERATOR (Web Audio API)
// ============================================================================

class MelancholySoundEngine {
  constructor() {
    this.ctx = null;
    this.rainGain = null;
    this.noiseNode = null;
    this.isPlaying = false;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
    } catch (e) {
      console.warn('AudioContext not supported', e);
    }
  }

  startRain() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.isPlaying) return;

    // Generate soothing pink/brown noise simulating falling rain against a window
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
      b6 = white * 0.115926;
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = noiseBuffer;
    this.noiseNode.loop = true;

    // Lowpass filter for muffled indoor rain ambience
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

    this.noiseNode.connect(filter);
    filter.connect(this.rainGain);
    this.rainGain.connect(this.ctx.destination);

    this.noiseNode.start();
    this.isPlaying = true;
  }

  playPianoChord() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Play a gentle, sad minor chord (D minor / F maj7)
    const freqs = [146.83, 174.61, 220.00, 261.63]; // D3, F3, A3, C4
    const now = this.ctx.currentTime;

    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.04, now + idx * 0.08 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 4.0);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 4.2);
    });
  }

  stopRain() {
    if (!this.isPlaying) return;
    try {
      this.noiseNode?.stop();
      this.noiseNode?.disconnect();
    } catch {}
    this.isPlaying = false;
  }
}

const soundEngine = new MelancholySoundEngine();

// ============================================================================
// MAIN BREAKUP ROOM VIEWER EXPORT
// ============================================================================

export default function BreakupRoomViewer({ onClose, arg }) {
  const [activeTab, setActiveTab] = useState(['music', 'letters', 'burn', 'healing', 'art'].includes(arg) ? arg : 'music'); // 'music' | 'letters' | 'burn' | 'healing'
  const lang = useBreakupLang();
  const tx = CONTENT[lang];
  const ui = tx.ui;
  const [letterId, setLetterId] = useState(1);
  const selectedLetter = tx.letters.find(l => l.id === letterId) || tx.letters[0];
  const art = localizedPainting(INDIAN_PAINTINGS[ROOM_PAINTING[lang]], lang);
  const [isRaining, setIsRaining] = useState(false);
  const [burnText, setBurnText] = useState('');
  const [isBurning, setIsBurning] = useState(false);
  const [burnBurned, setBurnBurned] = useState(false);

  const [isLight, setIsLight] = useState(() => {
    return typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  });

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      obs.disconnect();
      soundEngine.stopRain();
    };
  }, []);

  const toggleRainSound = () => {
    if (isRaining) {
      soundEngine.stopRain();
      setIsRaining(false);
    } else {
      soundEngine.startRain();
      setIsRaining(true);
    }
  };

  const handleBurn = () => {
    if (!burnText.trim() || isBurning) return;
    setIsBurning(true);
    soundEngine.playPianoChord();

    setTimeout(() => {
      setIsBurning(false);
      setBurnBurned(true);
    }, 2400);
  };

  const handleResetBurn = () => {
    setBurnBurned(false);
    setBurnText('');
  };

  // Color theme
  const cardBg = isLight
    ? 'linear-gradient(165deg, rgba(248,250,252,0.98), rgba(241,245,249,0.99))'
    : 'linear-gradient(165deg, rgba(18,20,32,0.98), rgba(10,12,20,0.99))';
  const cardBorder = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)';
  const textTitle = isLight ? '#0f172a' : '#ffffff';
  const textSub = isLight ? '#475569' : '#94a3b8';
  const innerCardBg = isLight ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.04)';
  const innerCardBorder = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: 960,
        height: '88vh',
        maxHeight: 780,
        borderRadius: 24,
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: isLight
          ? '0 24px 60px rgba(0,0,0,0.14)'
          : '0 24px 70px rgba(0,0,0,0.8), 0 0 50px rgba(99,102,241,0.15)',
        backdropFilter: 'blur(20px)',
        overflow: 'hidden',
        color: textTitle,
        display: 'flex',
        flexDirection: 'column',
        animation: 'gp-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative',
      }}
    >
      <style>{`
        @keyframes ember-burn {
          0% { filter: drop-shadow(0 0 4px #ef4444); opacity: 1; transform: scale(1); }
          50% { filter: drop-shadow(0 0 18px #f59e0b) brightness(1.6); opacity: 0.7; transform: scale(0.96) rotate(1deg); }
          100% { filter: drop-shadow(0 0 25px #fbbf24); opacity: 0; transform: scale(0.85) translateY(-20px); }
        }
        @keyframes tear-drop {
          0% { transform: translateY(-10px); opacity: 0; }
          40% { opacity: 0.8; }
          100% { transform: translateY(60px); opacity: 0; }
        }
        @keyframes heartbeat-slow {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>

      {/* ── Top Header Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          padding: '16px clamp(12px, 3vw, 24px)',
          borderBottom: `1px solid ${innerCardBorder}`,
          background: isLight ? 'rgba(241,245,249,0.6)' : 'rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 260px', minWidth: 0 }}>
          <div
            style={{
              flex: 'none',
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #4f46e5, #0f172a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 18px rgba(79,70,229,0.35)',
              animation: 'heartbeat-slow 3s ease-in-out infinite',
            }}
          >
            <HeartCrack size={22} color="#a5b4fc" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {ui.title}
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 99,
                  background: 'rgba(99,102,241,0.18)',
                  color: '#818cf8',
                  border: '1px solid rgba(99,102,241,0.3)',
                }}
              >
                {ui.badge}
              </span>
            </div>
            <div style={{ fontSize: 12, color: textSub }}>
              {ui.subtitle}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div role="group" aria-label="Language" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: 3, borderRadius: 12, border: `1px solid ${innerCardBorder}`, background: innerCardBg }}>
            <Languages size={14} color={textSub} style={{ margin: '0 4px 0 6px' }} />
            {BREAKUP_LANGS.map(l => (
              <button key={l.code} onClick={() => setBreakupLang(l.code)} aria-pressed={lang === l.code} style={{ padding: '6px 10px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 800, background: lang === l.code ? '#6366f1' : 'transparent', color: lang === l.code ? '#ffffff' : textSub }}>{l.label}</button>
            ))}
          </div>
          {/* Ambient Rain Sound Toggle */}
          <button
            onClick={toggleRainSound}
            style={{
              padding: '8px 14px',
              borderRadius: 12,
              border: `1px solid ${isRaining ? '#6366f1' : innerCardBorder}`,
              background: isRaining ? 'rgba(99,102,241,0.2)' : innerCardBg,
              color: isRaining ? '#818cf8' : textSub,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <CloudRain size={16} />
            <span>{isRaining ? ui.rainOff : ui.rainOn}</span>
          </button>

          <button
            onClick={onClose}
            title="Close"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: `1px solid ${innerCardBorder}`,
              background: innerCardBg,
              color: textTitle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          padding: '12px clamp(12px, 3vw, 24px)',
          borderBottom: `1px solid ${innerCardBorder}`,
          background: isLight ? 'rgba(241,245,249,0.4)' : 'rgba(0,0,0,0.15)',
        }}
      >
        {[
          { id: 'music', label: ui.tabs.music, icon: <Music size={15} /> },
          { id: 'letters', label: ui.tabs.letters, icon: <Feather size={15} /> },
          { id: 'burn', label: ui.tabs.burn, icon: <Flame size={15} /> },
          { id: 'healing', label: ui.tabs.healing, icon: <Sparkles size={15} /> },
          { id: 'art', label: ui.tabs.art, icon: <Brush size={15} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 12,
              border: activeTab === tab.id ? '1px solid rgba(99,102,241,0.5)' : `1px solid ${innerCardBorder}`,
              background: activeTab === tab.id ? 'rgba(99,102,241,0.18)' : innerCardBg,
              color: activeTab === tab.id ? (isLight ? '#4338ca' : '#a5b4fc') : textSub,
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease',
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Main Tab Content ── */}
      <div data-calm-scroll style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {/* TAB 0: CALM MUSIC */}
        {activeTab === 'music' && (
          <CalmMusicPanel lang={lang} ink={textTitle} muted={textSub} card={innerCardBg} border={innerCardBorder} isLight={isLight} />
        )}

        {/* TAB 1: UNSENT LETTERS */}
        {activeTab === 'letters' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 20 }}>
            {/* Left: Letters Index */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: textSub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {ui.lettersHead} ({tx.letters.length})
              </div>
              {tx.letters.map(letter => {
                const isSelected = selectedLetter.id === letter.id;
                return (
                  <div
                    key={letter.id}
                    onClick={() => setLetterId(letter.id)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 16,
                      background: isSelected ? 'rgba(99,102,241,0.16)' : innerCardBg,
                      border: isSelected ? '2px solid #6366f1' : `1px solid ${innerCardBorder}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 4px 20px rgba(99,102,241,0.2)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 800 }}>{letter.time}</span>
                      <span style={{ fontSize: 10, color: textSub }}>{letter.author}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: textTitle, marginBottom: 4 }}>
                      {letter.title}
                    </div>
                    <div style={{ fontSize: 12, color: textSub, lineHeight: 1.5 }}>
                      {letter.preview}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: Selected Letter Reading View */}
            <div
              style={{
                background: isLight ? '#ffffff' : 'rgba(15,18,30,0.85)',
                border: `1px solid ${innerCardBorder}`,
                borderRadius: 20,
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
                position: 'relative',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Quote size={20} color="#6366f1" />
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#818cf8', textTransform: 'uppercase' }}>
                    {selectedLetter.time} &bull; {selectedLetter.author}
                  </span>
                </div>

                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 18, color: textTitle }}>
                  {selectedLetter.title}
                </div>

                <div
                  style={{
                    fontSize: 14,
                    color: isLight ? '#334155' : '#cbd5e1',
                    lineHeight: 1.8,
                    whiteSpace: 'pre-line',
                    fontFamily: 'serif',
                    fontStyle: lang === 'en' ? 'italic' : 'normal',
                  }}
                >
                  {selectedLetter.content}
                </div>
              </div>

              {/* Tags and comfort footer */}
              <div style={{ borderTop: `1px solid ${innerCardBorder}`, paddingTop: 16, marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {selectedLetter.tags.map(tag => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 99,
                        background: 'rgba(255,255,255,0.06)',
                        color: textSub,
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => soundEngine.playPianoChord()}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#818cf8',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Music size={14} />
                  <span>{ui.chord}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BURN & RELEASE JOURNAL */}
        {activeTab === 'burn' && (
          <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Flame size={26} color="#f97316" />
                <span>{ui.burnTitle}</span>
              </div>
              <div style={{ fontSize: 13, color: textSub, lineHeight: 1.6 }}>
                {ui.burnIntro}
              </div>
            </div>

            {!burnBurned ? (
              <div
                style={{
                  background: isLight ? '#ffffff' : 'rgba(15,18,30,0.85)',
                  border: `1px solid ${innerCardBorder}`,
                  borderRadius: 20,
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
                  animation: isBurning ? 'ember-burn 2.4s forwards' : 'none',
                }}
              >
                <textarea
                  value={burnText}
                  onChange={e => setBurnText(e.target.value)}
                  placeholder={ui.burnHint}
                  disabled={isBurning}
                  style={{
                    width: '100%',
                    height: 180,
                    borderRadius: 14,
                    padding: '16px',
                    background: isLight ? '#f8fafc' : 'rgba(0,0,0,0.3)',
                    border: `1px solid ${innerCardBorder}`,
                    color: textTitle,
                    fontSize: 14,
                    lineHeight: 1.7,
                    resize: 'none',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: textSub }}>
                    {burnText.length} {ui.burnCount}
                  </span>

                  <button
                    onClick={handleBurn}
                    disabled={!burnText.trim() || isBurning}
                    style={{
                      padding: '12px 24px',
                      borderRadius: 14,
                      border: 'none',
                      background: burnText.trim() ? 'linear-gradient(135deg, #f97316, #dc2626)' : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 900,
                      cursor: burnText.trim() && !isBurning ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: burnText.trim() ? '0 4px 18px rgba(249,115,22,0.45)' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Flame size={18} />
                    <span>{isBurning ? ui.burnBusy : ui.burnBtn}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: 20,
                  padding: '36px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16,
                  animation: 'gp-pop 0.4s ease-out',
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'rgba(99,102,241,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#818cf8',
                  }}
                >
                  <Sparkles size={28} />
                </div>

                <div style={{ fontSize: 20, fontWeight: 900, color: textTitle }}>
                  {ui.burnDoneTitle}
                </div>

                <div style={{ fontSize: 13, color: textSub, maxWidth: 500, lineHeight: 1.7 }}>
                  {ui.burnDoneBody}
                </div>

                <button
                  onClick={handleResetBurn}
                  style={{
                    marginTop: 8,
                    padding: '10px 20px',
                    borderRadius: 12,
                    border: `1px solid ${innerCardBorder}`,
                    background: innerCardBg,
                    color: textTitle,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <RefreshCw size={14} />
                  <span>{ui.burnAgain}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: COMFORT & HEALING WORDS */}
        {activeTab === 'healing' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {tx.healing.map((aff, i) => (
              <div
                key={i}
                style={{
                  background: innerCardBg,
                  border: `1px solid ${innerCardBorder}`,
                  borderRadius: 18,
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                }}
              >
                <Quote size={24} color="#818cf8" style={{ opacity: 0.5, marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: textTitle, lineHeight: 1.7, fontStyle: lang === 'en' ? 'italic' : 'normal' }}>
                  "{aff}"
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16 }}>
                  <Heart size={14} color="#f43f5e" />
                  <span style={{ fontSize: 11, color: textSub, fontWeight: 800 }}>{ui.healingHead} {i + 1}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: THE PAINTING ON THE WALL */}
        {activeTab === 'art' && art && (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 260px', maxWidth: 380, margin: '0 auto' }}>
              <div style={{ padding: 10, borderRadius: 6, background: 'linear-gradient(135deg,#e6c36a,#9a7420 45%,#d9b455)', boxShadow: '0 18px 44px rgba(0,0,0,0.45)' }}>
                <img src={art.img} alt={`${art.title}, ${art.artist}`} draggable={false} style={{ display: 'block', width: '100%', height: 'auto', maxHeight: '58vh', objectFit: 'contain', background: '#150f0a' }} />
              </div>
              <div style={{ fontSize: 11.5, color: textSub, marginTop: 8, textAlign: 'center' }}>{art.credit}</div>
            </div>
            <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {art.mood.map(m => <span key={m} style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(99,102,241,0.16)', border: '1px solid rgba(99,102,241,0.4)', color: isLight ? '#4338ca' : '#c7d2fe', fontSize: 12, fontWeight: 700 }}>{m}</span>)}
                </div>
                <div style={{ fontSize: 'clamp(22px,4.5vw,30px)', fontWeight: 900, lineHeight: 1.2, color: textTitle }}>{art.title}</div>
                <div style={{ fontSize: 14, color: textSub, marginTop: 4 }}>{art.artist}, {art.year}</div>
                <div style={{ fontSize: 12.5, color: textSub, marginTop: 2 }}>{art.place}</div>
              </div>
              {[['why', art.why], ['story', art.story], ['behind', art.behind]].map(([k, text]) => (
                <div key={k}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: isLight ? '#4338ca' : '#a5b4fc', marginBottom: 4 }}>{ART_LABELS[lang][k]}</div>
                  <div style={{ fontSize: 14.5, lineHeight: 1.75, color: isLight ? '#334155' : '#cbd5e1' }}>{text}</div>
                </div>
              ))}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: isLight ? '#4338ca' : '#a5b4fc', marginBottom: 4 }}>{ART_LABELS[lang].look}</div>
                {art.look.map(l => <div key={l} style={{ fontSize: 14, lineHeight: 1.7, color: isLight ? '#334155' : '#cbd5e1' }}>- {l}</div>)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const ART_LABELS = {
  en: { why: 'Why it was painted', story: 'The story', behind: 'Behind the canvas', look: 'Look closer' },
  hi: { why: 'यह चित्र क्यों बना', story: 'कथा', behind: 'चित्र के पीछे', look: 'ज़रा ग़ौर से देखो' },
  te: { why: 'ఈ చిత్రం ఎందుకు గీశారు', story: 'కథ', behind: 'చిత్రం వెనుక', look: 'జాగ్రత్తగా చూడండి' },
};
