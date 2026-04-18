/**
 * RecoveryPhraseModal.jsx
 *
 * Shown once after signup. Displays the 24-word BIP39 recovery phrase.
 * User must acknowledge before continuing. The phrase is NEVER sent to the server.
 */
import React, { useState } from 'react';
import { Shield, Copy, Check, AlertTriangle, Eye, EyeOff } from 'lucide-react';

export default function RecoveryPhraseModal({ phrase, onConfirmed }) {
  const [acknowledged, setAcknowledged]  = useState(false);
  const [copied, setCopied]              = useState(false);
  const [revealed, setRevealed]          = useState(false);
  const words = phrase ? phrase.split(' ') : [];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(phrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch { }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, backdropFilter: 'blur(12px)'
    }}>
      <div style={{
        maxWidth: 520, width: '100%',
        background: 'linear-gradient(145deg, #0f0a23, #1a0f35)',
        border: '1px solid rgba(168,85,247,0.35)',
        borderRadius: 24, padding: '36px 32px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(168,85,247,0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
        animation: 'slideInUp 0.4s cubic-bezier(0.21,1.02,0.73,1)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 0 8px rgba(99,102,241,0.15), 0 8px 24px rgba(99,102,241,0.4)'
          }}>
            <Shield size={28} color="#fff" />
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: "'Outfit', sans-serif" }}>
            Your Recovery Phrase
          </h2>
          <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.5 }}>
            This 24-word phrase is the <strong style={{ color: '#a78bfa' }}>only way</strong> to recover your encrypted messages if you forget your password. Store it somewhere safe — it will never be shown again.
          </p>
        </div>

        {/* Warning Banner */}
        <div style={{
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'flex-start', gap: 10
        }}>
          <AlertTriangle size={16} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, color: '#f87171', fontSize: 13, lineHeight: 1.5 }}>
            Write these words down or store them in a password manager. Screenshots can be accessed by others. <strong>Never share this phrase.</strong>
          </p>
        </div>

        {/* Phrase Grid */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
            filter: revealed ? 'none' : 'blur(8px)',
            transition: 'filter 0.3s',
            userSelect: revealed ? 'auto' : 'none',
            pointerEvents: revealed ? 'auto' : 'none'
          }}>
            {words.map((word, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '7px 10px',
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', minWidth: 16 }}>{i + 1}.</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>{word}</span>
              </div>
            ))}
          </div>

          {/* Reveal overlay */}
          {!revealed && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(10,5,25,0.5)', borderRadius: 8, cursor: 'pointer'
            }} onClick={() => setRevealed(true)}>
              <div style={{ textAlign: 'center' }}>
                <Eye size={24} color="#a78bfa" style={{ marginBottom: 6 }} />
                <p style={{ margin: 0, color: '#a78bfa', fontSize: 13, fontWeight: 600 }}>Click to reveal phrase</p>
                <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Make sure no one is watching your screen</p>
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
              borderRadius: 10, border: '1px solid rgba(99,102,241,0.4)',
              background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.12)',
              color: copied ? '#34d399' : '#a5b4fc',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.25s'
            }}
          >
            {copied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy all 24 words</>}
          </button>
        )}

        {/* Acknowledge Checkbox */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 20 }}>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={e => setAcknowledged(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 2, accentColor: '#6366f1', flexShrink: 0 }}
          />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
            I have written down or securely stored my 24-word recovery phrase. I understand this is the only way to recover my encrypted messages.
          </span>
        </label>

        {/* Continue Button */}
        <button
          disabled={!acknowledged || !revealed}
          onClick={onConfirmed}
          style={{
            width: '100%', padding: '14px',
            borderRadius: 12, border: 'none',
            background: acknowledged && revealed
              ? 'linear-gradient(135deg, #6366f1, #a855f7)'
              : 'rgba(255,255,255,0.07)',
            color: acknowledged && revealed ? '#fff' : 'rgba(255,255,255,0.3)',
            fontSize: 15, fontWeight: 700, cursor: acknowledged && revealed ? 'pointer' : 'not-allowed',
            transition: 'all 0.25s',
            boxShadow: acknowledged && revealed ? '0 4px 20px rgba(99,102,241,0.4)' : 'none'
          }}
        >
          {!revealed ? 'Reveal phrase first' : !acknowledged ? 'Please acknowledge above' : "I've saved it — Continue →"}
        </button>
      </div>

      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(40px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
