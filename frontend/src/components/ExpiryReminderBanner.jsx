import { Clock, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ExpiryReminderBanner({ count, isLight, onGotIt, onRemindLater }) {
  const { t } = useTranslation();
  if (!count) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      margin: '8px 12px', padding: '10px 12px', borderRadius: 12,
      background: isLight ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.12)',
      border: '1px solid rgba(245,158,11,0.3)',
    }}>
      <Clock size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 140, fontSize: 12.5, color: isLight ? '#7c4a03' : '#fbbf24', lineHeight: 1.4 }}>
        {count === 1
          ? t('expiryBannerOne', '1 file in this chat expires within 24 hours. Download it before it\'s gone.')
          : t('expiryBannerMany', '{{count}} files in this chat expire within 24 hours. Download them before they\'re gone.', { count })}
      </span>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={onRemindLater}
          style={{ background: 'none', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          {t('remindMeLater', 'Remind me later')}
        </button>
        <button
          onClick={onGotIt}
          style={{ background: '#f59e0b', border: 'none', color: '#1a1200', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          {t('gotIt', 'Got it')}
        </button>
        <button
          onClick={onGotIt}
          title={t('dismiss', 'Dismiss')}
          style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', display: 'flex', padding: 2 }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
