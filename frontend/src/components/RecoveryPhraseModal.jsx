/**
 * RecoveryPhraseModal.jsx
 *
 * Shown once after signup. Displays the 24-word BIP39 recovery phrase.
 * User must acknowledge before continuing. The phrase is NEVER sent to the server.
 */
import React, { useState } from 'react';
import { Shield, Copy, Check, AlertTriangle, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function RecoveryPhraseModal({ phrase, onConfirmed }) {
  const { t } = useTranslation();
  const [acknowledged, setAcknowledged]  = useState(false);
  const [copied, setCopied]              = useState(false);
  const [revealed, setRevealed]          = useState(false);

  const isLight = typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'light';

  // Format the 24 letters into groups of 4 for readability, e.g. "ABCD EFGH IJKL..."
  const isLetters = phrase && phrase.length === 24 && !phrase.includes(' ');
  let displayBlocks = [];
  if (isLetters) {
    for (let i = 0; i < 24; i += 4) {
      displayBlocks.push(phrase.substring(i, i + 4));
    }
  } else {
    displayBlocks = phrase ? phrase.split(' ') : [];
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(phrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch { }
  };

  const card = isLight
    ? { background: '#ffffff', border: '1px solid rgba(var(--brand-1-rgb),0.25)', boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(var(--brand-1-rgb),0.08)' }
    : { background: 'linear-gradient(145deg, #0f0a23, #1a0f35)', border: '1px solid rgba(var(--brand-2-rgb),0.35)', boxShadow: '0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(var(--brand-2-rgb),0.1), inset 0 1px 0 rgba(255,255,255,0.06)' };

  const titleColor       = isLight ? '#1a1a2e'               : '#ffffff';
  const descColor        = isLight ? 'rgba(0,0,0,0.55)'      : 'rgba(255,255,255,0.55)';
  const phraseBlockBg    = isLight ? 'rgba(var(--brand-1-rgb),0.07)' : 'rgba(255,255,255,0.06)';
  const phraseBlockBdr   = isLight ? 'rgba(var(--brand-1-rgb),0.18)' : 'rgba(255,255,255,0.1)';
  const phraseTextColor  = isLight ? '#2d1f6e'               : '#e2e8f0';
  const revealOverlayBg  = isLight ? 'rgba(230,225,255,0.88)' : 'rgba(10,5,25,0.5)';
  const revealSubColor   = isLight ? 'rgba(0,0,0,0.45)'      : 'rgba(255,255,255,0.4)';
  const ackTextColor     = isLight ? 'rgba(0,0,0,0.65)'      : 'rgba(255,255,255,0.7)';
  const btnDisabledBg    = isLight ? 'rgba(0,0,0,0.06)'      : 'rgba(255,255,255,0.07)';
  const btnDisabledColor = isLight ? 'rgba(0,0,0,0.3)'       : 'rgba(255,255,255,0.3)';

  return (
    <div className="recovery-modal-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, backdropFilter: 'blur(12px)'
    }}>
      <div className="recovery-modal-card" style={{
        maxWidth: 520, width: '100%',
        maxHeight: '100%', overflowY: 'auto',
        ...card,
        borderRadius: 24, padding: '36px 32px',
        animation: 'slideInUp 0.4s cubic-bezier(0.21,1.02,0.73,1)'
      }}>
        {/* Header */}
        <div className="recovery-header" style={{ textAlign: 'center', marginBottom: 24 }}>
          <div className="recovery-icon" style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 0 8px rgba(var(--brand-1-rgb),0.15), 0 8px 24px rgba(var(--brand-1-rgb),0.4)'
          }}>
            <Shield size={28} color="#fff" />
          </div>
          <h2 className="recovery-title" style={{ margin: 0, fontSize: 22, fontWeight: 800, color: titleColor, fontFamily: "'Outfit', sans-serif" }}>
            {t('recoveryPhraseTitle', 'Your Recovery Phrase')}
          </h2>
          <p className="recovery-desc" style={{ margin: '8px 0 0', color: descColor, fontSize: 14, lineHeight: 1.5 }}>
            {isLetters
              ? t('recoveryKeyDesc', 'This 24-letter key is the only way to recover your encrypted messages if you forget your password. Store it somewhere safe — it will never be shown again.')
              : t('recoveryPhraseDesc', 'This 24-word phrase is the only way to recover your encrypted messages if you forget your password. Store it somewhere safe — it will never be shown again.')}
          </p>
        </div>

        {/* Warning Banner */}
        <div style={{
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'flex-start', gap: 10
        }}>
          <AlertTriangle size={16} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, color: isLight ? '#c0392b' : '#f87171', fontSize: 13, lineHeight: 1.5 }}>
            {t('recoveryWarningText', 'Write these words down or store them in a password manager. Screenshots can be accessed by others. Never share this phrase.')}
          </p>
        </div>

        {/* Phrase Grid */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div className="recovery-phrase-grid" style={{
            display: 'grid', gridTemplateColumns: isLetters ? 'repeat(3, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 8,
            filter: revealed ? 'none' : 'blur(8px)',
            transition: 'filter 0.3s',
            userSelect: revealed ? 'auto' : 'none',
            pointerEvents: revealed ? 'auto' : 'none'
          }}>
            {displayBlocks.map((block, i) => (
              <div key={i} className="recovery-phrase-block" style={{
                background: phraseBlockBg,
                border: `1px solid ${phraseBlockBdr}`,
                borderRadius: 8, padding: '10px',
                minWidth: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}>
                <span className="recovery-phrase-word" style={{ fontSize: 16, letterSpacing: '2px', fontWeight: 700, color: phraseTextColor, fontFamily: 'monospace', overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}>{block}</span>
              </div>
            ))}
          </div>

          {/* Reveal overlay */}
          {!revealed && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: revealOverlayBg, borderRadius: 8, cursor: 'pointer'
            }} onClick={() => setRevealed(true)}>
              <div style={{ textAlign: 'center' }}>
                <Eye size={24} color="var(--brand-1-light)" style={{ marginBottom: 6 }} />
                <p style={{ margin: 0, color: 'var(--brand-1-light)', fontSize: 13, fontWeight: 600 }}>{t('clickToRevealPhrase', 'Click to reveal phrase')}</p>
                <p style={{ margin: '4px 0 0', color: revealSubColor, fontSize: 11 }}>{t('makeSureNoOneWatching', 'Make sure no one is watching your screen')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Copy Button */}
        {revealed && (
          <button
            onClick={handleCopy}
            style={{
              width: '100%', padding: '11px', marginBottom: 16,
              borderRadius: 10, border: '1px solid rgba(var(--brand-1-rgb),0.4)',
              background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(var(--brand-1-rgb),0.12)',
              color: copied ? '#059669' : 'var(--brand-1)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.25s'
            }}
          >
            {copied ? <><Check size={15} /> {t('copiedLabel', 'Copied!')}</> : <><Copy size={15} /> {isLetters ? t('copyRecoveryKey', 'Copy recovery key') : t('copyAll24Words', 'Copy all 24 words')}</>}
          </button>
        )}

        {/* Acknowledge Checkbox */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 20 }}>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={e => setAcknowledged(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--brand-1)', flexShrink: 0 }}
          />
          <span style={{ fontSize: 13, color: ackTextColor, lineHeight: 1.5 }}>
            {isLetters
              ? t('recoveryAcknowledgeCheckboxKey', 'I have written down or securely stored my 24-letter recovery key. I understand this is the only way to recover my encrypted messages.')
              : t('recoveryAcknowledgeCheckbox', 'I have written down or securely stored my 24-word recovery phrase. I understand this is the only way to recover my encrypted messages.')}
          </span>
        </label>

        {/* Continue Button */}
        <button
          disabled={!acknowledged || !revealed}
          onClick={onConfirmed}
          className={acknowledged && revealed ? 'stay-white' : ''}
          style={{
            width: '100%', padding: '14px',
            borderRadius: 12, border: 'none',
            background: acknowledged && revealed
              ? 'linear-gradient(135deg, var(--brand-1), var(--brand-2))'
              : btnDisabledBg,
            color: acknowledged && revealed ? '#fff' : btnDisabledColor,
            fontSize: 15, fontWeight: 700, cursor: acknowledged && revealed ? 'pointer' : 'not-allowed',
            transition: 'all 0.25s',
            boxShadow: acknowledged && revealed ? '0 4px 20px rgba(var(--brand-1-rgb),0.4)' : 'none'
          }}
        >
          {!revealed ? t('revealPhraseFirst', 'Reveal phrase first') : !acknowledged ? t('pleaseAcknowledge', 'Please acknowledge above') : t('savedContinue', "I've saved it — Continue →")}
        </button>
      </div>

      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(40px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (max-width: 480px) {
          .recovery-modal-overlay { padding: 10px !important; }
          .recovery-modal-card { padding: 22px 16px !important; border-radius: 18px !important; }
          .recovery-icon { width: 48px !important; height: 48px !important; margin-bottom: 10px !important; }
          .recovery-icon svg { width: 20px !important; height: 20px !important; }
          .recovery-title { font-size: 18px !important; }
          .recovery-desc { font-size: 12.5px !important; }
          .recovery-phrase-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 6px !important; }
          .recovery-phrase-block { padding: 8px 4px !important; }
          .recovery-phrase-word { font-size: 12.5px !important; letter-spacing: 0.5px !important; }
        }
      `}</style>
    </div>
  );
}
