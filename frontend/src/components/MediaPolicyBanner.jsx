import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

const KEY = 'media_policy_banner_v2'
const REMIND_DAYS = 1

export default function MediaPolicyBanner({ isLight }) {
  const { t } = useTranslation()
  const [state, setState] = useState(() => {
    const s = localStorage.getItem(KEY)
    if (s === 'dismissed') return 'dismissed'
    if (s) {
      const remindAt = parseInt(s, 10)
      if (!isNaN(remindAt) && Date.now() < remindAt) return 'snoozed'
    }
    return 'visible'
  })
  const [learnHover, setLearnHover] = useState(false)

  if (state !== 'visible') return null

  function dismiss() {
    localStorage.setItem(KEY, 'dismissed')
    setState('dismissed')
  }

  function remindLater() {
    const until = Date.now() + REMIND_DAYS * 24 * 60 * 60 * 1000
    localStorage.setItem(KEY, String(until))
    setState('snoozed')
  }

  const btnStyle = {
    padding: '3px 10px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    background: 'var(--brand-1)',
    color: '#ffffff',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{
      margin: '0 10px 8px',
      padding: '12px 14px',
      background: isLight ? 'rgba(var(--brand-1-rgb),0.06)' : 'rgba(20,20,40,0.7)',
      border: `1px solid ${isLight ? 'rgba(var(--brand-1-rgb),0.22)' : 'rgba(var(--brand-1-rgb),0.28)'}`,
      borderRadius: 10,
    }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: isLight ? 'var(--brand-1-dark)' : '#c4b5fd', marginBottom: 5 }}>
        {t('mediaStoragePolicy', 'Media Storage Policy')}
      </div>
      <div style={{ fontSize: 11, color: isLight ? '#6b7280' : '#9ca3af', lineHeight: 1.7, marginBottom: 10 }}>
        {t('mediaTypeImages', 'Images')}: {t('duration30Days', '30 days')} &nbsp;·&nbsp; {t('mediaTypeVideos', 'Videos')}: {t('duration7Days', '7 days')} &nbsp;·&nbsp; {t('mediaTypeFilesDocuments', 'Files & Documents')}: {t('duration7Days', '7 days')}<br />
        {t('mediaTypeVoiceNotes', 'Voice Notes')}: {t('duration14Days', '14 days')} &nbsp;·&nbsp; {t('mediaTypeTextMessages', 'Text Messages')}: {t('durationKeptForever', 'Kept forever')} &nbsp;·&nbsp;{' '}
        <a
          href="/app-settings#privacy-storage"
          onMouseEnter={() => setLearnHover(true)}
          onMouseLeave={() => setLearnHover(false)}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--brand-1)',
            textDecoration: learnHover ? 'underline' : 'none',
          }}
        >
          {t('learnMore', 'Learn more')}
        </a>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={remindLater} className="stay-white" style={btnStyle}>{t('remindLater', 'Remind later')}</button>
        <button onClick={dismiss} className="stay-white" style={btnStyle}>{t('gotIt', 'Got it')}</button>
      </div>
    </div>
  )
}
