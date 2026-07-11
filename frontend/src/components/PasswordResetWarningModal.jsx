/**
 * PasswordResetWarningModal.jsx
 *
 * Shown right before a password reset is submitted. The consequence differs
 * sharply depending on whether the user supplied their E2EE recovery key:
 *   - With a valid recovery key: the same key pair is re-wrapped under the new
 *     password. Nothing is lost.
 *   - Without one: the old encrypted private key can no longer be unwrapped, so
 *     (per this app's existing, deliberate server-side behavior) ALL messages the
 *     user ever sent or received — with everyone, not just their own copy — are
 *     permanently deleted.
 * Chat Lock (PIN) settings are never touched by password reset either way.
 */
import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PasswordResetWarningModal({ hasRecoveryKey, onCancel, onConfirm }) {
  const { t } = useTranslation();

  const isLight = typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'light';

  const card = isLight
    ? { background: '#ffffff', border: '1px solid rgba(99,102,241,0.25)', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }
    : { background: 'linear-gradient(145deg, #0f0a23, #1a0f35)', border: '1px solid rgba(168,85,247,0.35)', boxShadow: '0 32px 80px rgba(0,0,0,0.9)' };

  const titleColor = isLight ? '#1a1a2e' : '#ffffff';
  const descColor  = isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, backdropFilter: 'blur(12px)'
    }}>
      <div style={{
        maxWidth: 480, width: '100%',
        ...card,
        borderRadius: 24, padding: '32px 28px',
        animation: 'prwSlideUp 0.3s cubic-bezier(0.21,1.02,0.73,1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: hasRecoveryKey ? 'linear-gradient(135deg, #10b981, #34d399)' : 'linear-gradient(135deg, #ef4444, #f87171)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
          }}>
            {hasRecoveryKey ? <ShieldCheck size={26} color="#fff" /> : <AlertTriangle size={26} color="#fff" />}
          </div>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: titleColor, fontFamily: "'Outfit', sans-serif" }}>
            {hasRecoveryKey
              ? t('resetConfirmTitleSafe', 'Confirm Password Reset')
              : t('resetConfirmTitleDanger', 'This Will Permanently Delete Your Messages')}
          </h2>
        </div>

        {hasRecoveryKey ? (
          <p style={{ margin: '0 0 24px', color: descColor, fontSize: 14, lineHeight: 1.6, textAlign: 'center' }}>
            {t('resetConfirmDescSafe', "Since you've entered your recovery key, your encryption keys will be re-wrapped with your new password — no messages will be lost. Chat Lock settings are unaffected. Your password will change immediately. This cannot be undone.")}
          </p>
        ) : (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 12, padding: '14px 16px', marginBottom: 24
          }}>
            <p style={{ margin: 0, color: isLight ? '#b91c1c' : '#fca5a5', fontSize: 14, lineHeight: 1.6 }}>
              {t('resetConfirmDescDanger', "You haven't entered a recovery key. Without it, your old encrypted private key can't be reused with your new password — so, as a safety measure, every message you've ever sent or received will be permanently deleted from the server. This affects the other people in those conversations too, not just your own copy. Chat Lock settings are unaffected either way. This cannot be undone.")}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '13px', borderRadius: 12,
              border: isLight ? '1px solid #d1d5db' : '1px solid rgba(255,255,255,0.15)',
              background: isLight ? '#ffffff' : 'rgba(255,255,255,0.06)',
              color: isLight ? '#374151' : 'rgba(255,255,255,0.8)',
              fontSize: 14, fontWeight: 700, cursor: 'pointer'
            }}
          >
            {t('cancel', 'Cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="stay-white"
            style={{
              flex: 1.4, padding: '13px', borderRadius: 12, border: 'none',
              background: hasRecoveryKey
                ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                : 'linear-gradient(135deg, #dc2626, #ef4444)',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer'
            }}
          >
            {hasRecoveryKey
              ? t('resetConfirmBtnSafe', 'Yes, reset my password')
              : t('resetConfirmBtnDanger', 'Yes, delete my messages and reset password')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes prwSlideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
