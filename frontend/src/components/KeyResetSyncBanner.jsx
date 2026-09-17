import { KeyRound, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Same visual pattern as ExpiryReminderBanner (that one's already proven
// legible in both themes) — a distinct blue/brand tint so it doesn't read as
// an error (amber/red), just a heads-up.
export default function KeyResetSyncBanner({ isLight, onGotIt }) {
  const { t } = useTranslation();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      margin: '8px 12px', padding: '10px 12px', borderRadius: 12,
      background: isLight ? 'rgba(var(--brand-1-rgb),0.08)' : 'rgba(var(--brand-1-rgb),0.14)',
      border: '1px solid rgba(var(--brand-1-rgb),0.35)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <KeyRound size={16} style={{ flexShrink: 0, marginTop: 1, color: 'var(--brand-1-light)' }} />
        <span style={{ flex: 1, minWidth: 120, fontSize: 12.5, color: isLight ? '#1e3a5f' : '#cfe3ff', lineHeight: 1.4 }}>
          {t(
            'keyResetSyncBanner',
            "You just reset your encryption key. Messages from others may briefly show as \"Encrypted message\" while their apps catch up — give it a few minutes, then reload if it hasn't cleared up."
          )}
        </span>
        <button
          onClick={onGotIt}
          title={t('dismiss', 'Dismiss')}
          style={{ background: 'none', border: 'none', color: 'var(--brand-1-light)', cursor: 'pointer', display: 'flex', padding: 2, flexShrink: 0 }}
        >
          <X size={14} />
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onGotIt}
          style={{ background: 'var(--brand-1)', border: 'none', color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          {t('gotIt', 'Got it')}
        </button>
      </div>
    </div>
  );
}
