import React, { useState, useEffect, useRef } from 'react';
import {
  Heart, HeartCrack, Volume2, VolumeX, Flame, BookOpen, Sparkles,
  Send, RefreshCw, X, Check, Shield, Feather, Music, CloudRain,
  MessageCircle, CornerDownRight, Quote
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
// UNSENT LETTERS & BROKEN HEART STORIES
// ============================================================================

const UNSENT_LETTERS = [
  {
    id: 1,
    title: "To the person I thought I'd grow old with",
    author: "Written at 3:14 AM",
    time: "Rainy Midnight",
    preview: "I still instinctively reach for my phone every time something good happens...",
    content: `I still reach for my phone whenever something funny happens on the street, or when our favorite song comes on in a crowded store. For a second, my thumb hovers over your name before the silence hits me all over again.

We had a whole universe built in our whispers, inside jokes, and plans for years we will never see. How do two people go from knowing every secret scar on each other's souls to becoming complete strangers who pretend not to look when they cross paths?

I don't hate you. I think that's the hardest part. If I hated you, this ache would have an edge. But it's just quiet grief. I hope you find whatever you felt was missing in my love.`,
    tags: ["Silence", "Longing", "Memory"]
  },
  {
    id: 2,
    title: "The day you unpacked your things",
    author: "Sleepless Night",
    time: "Autumn Evening",
    preview: "The closet looks too big now. The apartment has echoes I never noticed before...",
    content: `The closet looks twice as big now that your jackets aren't crowding mine. There is an echo in this apartment I never noticed when you were here.

You took your books, your mugs, your laundry hamper. But you left behind the ghost of your laugh in the kitchen, the way you leaned against the counter waiting for the kettle to boil, and every promise that started with "someday".

I spent three days sleeping only on my side of the bed because rolling over to the empty cold sheets felt like breaking my own ribs again. I am slowly learning how to breathe without checking if you're breathing beside me.`,
    tags: ["Empty Spaces", "Echoes", "Unpacking"]
  },
  {
    id: 3,
    title: "Why couldn't love be enough?",
    author: "Torn Page from a Journal",
    time: "Dawn",
    preview: "They say if love is strong, it survives. But love didn't save us from growing apart...",
    content: `They always say love conquers all. But love didn't conquer the timing, the unspoken fears, the quiet resentments that grew like weeds while we both smiled and pretended everything was fine.

I loved you until my hands shook with it. I loved you through your hardest days, and I wanted to be the safe harbor you ran to. But you can't save someone who is already looking for the exit door.

I'm starting to accept that someone can be the love of a chapter without being the love of the whole book. Thank you for the chapter. It was the sweetest one I'll ever read.`,
    tags: ["Acceptance", "Grief", "Letting Go"]
  },
  {
    id: 4,
    title: "Forgiving what was never apologized for",
    author: "Quiet Solitude",
    time: "Late Night",
    preview: "Waiting for an apology was like keeping the wound open with my own fingernails...",
    content: `I waited months for you to text me and say you realized what you threw away. I replayed our last conversation a thousand times in the shower, searching for the sentence that could have fixed it.

Then one evening, watching the rain run down the windowpane, I realized: you weren't thinking about it at all. You were moving forward, while I was building a museum out of our wreckage.

So tonight, I forgive you. Not because you asked for it, but because I deserve peace in the rooms of my own mind. I release you from my future.`,
    tags: ["Healing", "Peace", "Moving On"]
  }
];

const HEALING_AFFIRMATIONS = [
  "Crying is not weakness; it is your heart washing away the dust of what could not be.",
  "You did not lose your capacity to love. You only proved how deeply and fearlessly you can give it.",
  "Healing is not linear. Some days you will feel completely free, and some days the scent of rain will bring tears. Both days are progress.",
  "One day, you will tell the story of how you survived this, and it will be someone else's survival guide.",
  "You are not empty. You are simply making room for a love that doesn't require you to beg to be chosen.",
];

// ============================================================================
// MAIN BREAKUP ROOM VIEWER EXPORT
// ============================================================================

export default function BreakupRoomViewer({ onClose }) {
  const [activeTab, setActiveTab] = useState('letters'); // 'letters' | 'rain' | 'burn' | 'healing'
  const [selectedLetter, setSelectedLetter] = useState(UNSENT_LETTERS[0]);
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
          padding: '16px 24px',
          borderBottom: `1px solid ${innerCardBorder}`,
          background: isLight ? 'rgba(241,245,249,0.6)' : 'rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
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
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
              The Breakup Room &amp; Solitude Sanctuary
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
                HEALING &bull; EMOTIONAL RELEASE
              </span>
            </div>
            <div style={{ fontSize: 12, color: textSub }}>
              A safe, quiet place to grieve, read unspoken words, listen to the rain, and let go.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            <span>{isRaining ? 'Mute Window Rain' : 'Play Soothing Rain'}</span>
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
          gap: 8,
          padding: '12px 24px',
          borderBottom: `1px solid ${innerCardBorder}`,
          background: isLight ? 'rgba(241,245,249,0.4)' : 'rgba(0,0,0,0.15)',
        }}
      >
        {[
          { id: 'letters', label: 'Unsent Letters', icon: <Feather size={15} /> },
          { id: 'burn', label: 'Burn & Release Journal', icon: <Flame size={15} /> },
          { id: 'healing', label: 'Comfort & Healing Words', icon: <Sparkles size={15} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 12,
              border: activeTab === tab.id ? '1px solid rgba(99,102,241,0.5)' : `1px solid ${innerCardBorder}`,
              background: activeTab === tab.id ? 'rgba(99,102,241,0.18)' : innerCardBg,
              color: activeTab === tab.id ? '#a5b4fc' : textSub,
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {/* TAB 1: UNSENT LETTERS */}
        {activeTab === 'letters' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 20, height: '100%' }}>
            {/* Left: Letters Index */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: textSub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Letters Left in the Night Drawer ({UNSENT_LETTERS.length})
              </div>
              {UNSENT_LETTERS.map(letter => {
                const isSelected = selectedLetter.id === letter.id;
                return (
                  <div
                    key={letter.id}
                    onClick={() => setSelectedLetter(letter)}
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
                    fontStyle: 'italic',
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
                  <span>Strum Sad Chord</span>
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
                <span>The Burn &amp; Release Ritual</span>
              </div>
              <div style={{ fontSize: 13, color: textSub, lineHeight: 1.6 }}>
                Write the words you never got to say, the hurt you carry, or the memories you need to release.
                When you are ready, burn this digital letter into ashes and let the night take it.
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
                  placeholder="Type your sorrow, your angry thoughts, or your goodbye here... Nobody will ever read this but the night."
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
                    {burnText.length} characters &bull; Private &amp; Untracked
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
                    <span>{isBurning ? 'BURNING TO ASHES...' : 'BURN LETTER & RELEASE'}</span>
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
                  Your Words Have Turned to Dust &amp; Stars
                </div>

                <div style={{ fontSize: 13, color: textSub, maxWidth: 500, lineHeight: 1.7 }}>
                  "You loved deeply, bravely, and with your whole heart. That is something to be proud of, not ashamed of.
                  Take a slow, deep breath. The weight you set down tonight does not need to be picked back up tomorrow."
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
                  <span>Write Another Release</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: COMFORT & HEALING WORDS */}
        {activeTab === 'healing' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {HEALING_AFFIRMATIONS.map((aff, i) => (
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
                <div style={{ fontSize: 14, fontWeight: 700, color: textTitle, lineHeight: 1.7, fontStyle: 'italic' }}>
                  "{aff}"
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16 }}>
                  <Heart size={14} color="#f43f5e" />
                  <span style={{ fontSize: 11, color: textSub, fontWeight: 800 }}>Gentle Reminder #{i + 1}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
