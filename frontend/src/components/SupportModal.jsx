import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Copy, Mail, Check, MessageSquare, Shield, Bug, User } from 'lucide-react';
import toast from 'react-hot-toast';

const SupportModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [copiedKey, setCopiedKey] = useState(null);
  const [isLight, setIsLight] = useState(document.documentElement.getAttribute('data-theme') === 'light');

  // Detect theme updates dynamically
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = (email, key) => {
    navigator.clipboard.writeText(email);
    setCopiedKey(key);
    toast.success(t('supportModalCopiedToast', 'Email copied to clipboard!'));
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const contactOptions = [
    {
      key: 'general',
      title: t('supportModalGeneralTitle', 'General Questions'),
      email: 'contact@sahaplay.com',
      Icon: MessageSquare,
      color: '#6366f1',
      useFor: [
        t('supportModalGeneralUse1', 'Account questions'),
        t('supportModalGeneralUse2', 'Room issues'),
        t('supportModalGeneralUse3', 'General support'),
        t('supportModalGeneralUse4', 'App usage questions')
      ],
      note: t('supportModalGeneralNote', 'We usually respond within 48 hours.')
    },
    {
      key: 'safety',
      title: t('supportModalSafetyTitle', 'Safety Concerns'),
      email: 'safety@sahaplay.com',
      Icon: Shield,
      color: '#ef4444',
      useFor: [
        t('supportModalSafetyUse1', 'Abuse'),
        t('supportModalSafetyUse2', 'Harassment'),
        t('supportModalSafetyUse3', 'Harmful content'),
        t('supportModalSafetyUse4', 'Privacy or safety concerns')
      ],
      note: t('supportModalSafetyNote', 'Safety-related reports are reviewed with priority.')
    },
    {
      key: 'technical',
      title: t('supportModalTechTitle', 'Bug Reports / Technical Issues'),
      email: 'report@sahaplay.com',
      Icon: Bug,
      color: '#10b981',
      useFor: [
        t('supportModalTechUse1', 'Bugs'),
        t('supportModalTechUse2', 'Broken features'),
        t('supportModalTechUse3', 'Login issues'),
        t('supportModalTechUse4', 'Upload issues'),
        t('supportModalTechUse5', 'Room or chat problems')
      ],
      note: t('supportModalTechNote', 'Technical issues may take longer depending on complexity, but we will review them as soon as possible.')
    },
    {
      key: 'founders',
      title: t('supportModalFoundersTitle', 'Founders / Admin Contact'),
      email: 'founders@sahaplay.com',
      Icon: User,
      color: '#a855f7',
      useFor: [
        t('supportModalFoundersUse1', 'Founder/admin contact'),
        t('supportModalFoundersUse2', 'Business inquiries'),
        t('supportModalFoundersUse3', 'Serious account or platform concerns')
      ],
      note: t('supportModalFoundersNote', 'For admin/founder-level concerns only.')
    }
  ];

  return (
    <div
      onClick={onClose}
      className="support-modal-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="support-modal-card"
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 24px 16px',
            borderBottom: isLight ? '1px solid rgba(0, 0, 0, 0.05)' : '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
            {t('supportModalTitle', 'Contact SahaPlay Support')}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isLight ? '#64748b' : '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              borderRadius: '50%',
              backgroundColor: isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.04)',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.04)'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="support-modal-content no-scrollbar" style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ fontSize: '14px', color: isLight ? '#475569' : '#9ca3af', lineHeight: 1.6, margin: 0 }}>
            {t('supportModalSubtitle', 'Need help with SahaPlay? Choose the right contact below and our team will review your request.')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {contactOptions.map((opt) => {
              const Icon = opt.Icon;
              return (
                <div
                  key={opt.key}
                  style={{
                    backgroundColor: isLight ? 'rgba(248, 250, 252, 0.45)' : 'rgba(255, 255, 255, 0.02)',
                    border: isLight ? '1px solid rgba(226, 232, 240, 0.7)' : '1px solid rgba(255, 255, 255, 0.04)',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: `${opt.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Icon size={18} color={opt.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 750, color: isLight ? '#0f172a' : '#ffffff', margin: '0 0 4px' }}>
                        {opt.title}
                      </h4>
                      <p style={{ fontSize: '13px', color: isLight ? '#334155' : '#e2e8f0', margin: '0 0 6px', fontWeight: 500 }}>
                        {opt.email}
                      </p>
                      
                      {/* Bullet list of uses */}
                      <ul style={{ margin: '6px 0', paddingLeft: '18px', color: isLight ? '#64748b' : '#9ca3af', fontSize: '12px', lineHeight: 1.5 }}>
                        {opt.useFor.map((use, idx) => (
                          <li key={idx} style={{ marginBottom: '2px' }}>{use}</li>
                        ))}
                      </ul>

                      <p style={{ fontSize: '11px', color: isLight ? '#94a3b8' : '#6b7280', margin: '4px 0 0', fontStyle: 'italic' }}>
                        {opt.note}
                      </p>
                    </div>
                  </div>

                  {/* Copy & Email buttons */}
                  <div style={{ display: 'flex', gap: '10px', borderTop: isLight ? '1px solid rgba(0, 0, 0, 0.05)' : '1px solid rgba(255, 255, 255, 0.03)', paddingTop: '12px', marginTop: '4px' }}>
                    <button
                      onClick={() => handleCopy(opt.email, opt.key)}
                      disabled={copiedKey !== null}
                      style={{
                        flex: 1,
                        padding: '8px 16px',
                        borderRadius: '10px',
                        border: isLight ? '1px solid rgba(0, 0, 0, 0.15)' : '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: 'transparent',
                        color: isLight ? '#334155' : '#ffffff',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: copiedKey !== null ? 'not-allowed' : 'pointer',
                        opacity: copiedKey !== null ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => { if (copiedKey === null) e.currentTarget.style.backgroundColor = isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.04)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      {copiedKey === opt.key ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      {copiedKey === opt.key ? t('supportModalCopied', 'Copied') : t('supportModalCopy', 'Copy')}
                    </button>
                    <a
                      href={`mailto:${opt.email}`}
                      className="stay-white"
                      style={{
                        flex: 1,
                        padding: '8px 16px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                    >
                      <Mail size={14} className="stay-white" color="#ffffff" />
                      <span className="stay-white" style={{ color: '#ffffff' }}>{t('supportModalEmail', 'Email')}</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="support-note">
            <strong style={{ color: 'inherit' }}>{t('supportModalNoteLabel', 'Note:')}</strong>{t('supportModalNoteText', ' Please include your username, room ID, ticket ID, screenshots, or error details when possible. This helps us resolve issues faster.')}
          </div>
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: isLight ? '1px solid rgba(0, 0, 0, 0.05)' : '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            justifyContent: 'flex-end',
            flexShrink: 0
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: isLight ? '1px solid rgba(0, 0, 0, 0.15)' : '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'transparent',
              color: isLight ? '#475569' : '#9ca3af',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.04)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            {t('supportModalClose', 'Close')}
          </button>
        </div>
      </div>

      <style>{`
        .support-modal-overlay {
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 11000;
          padding: 16px;
          animation: fadeIn 0.2s ease-out;
        }
        html[data-theme='light'] .support-modal-overlay {
          background-color: rgba(15, 23, 42, 0.4) !important;
        }
        .support-modal-card {
          background-color: #141418;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          width: 100%;
          max-width: 560px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
          position: relative;
        }
        html[data-theme='light'] .support-modal-card {
          background-color: rgba(255, 255, 255, 0.85) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(226, 232, 240, 0.8) !important;
          box-shadow: 0 24px 64px rgba(15, 23, 42, 0.15) !important;
        }
        .support-note {
          background-color: rgba(99, 102, 241, 0.05) !important;
          border: 1px solid rgba(99, 102, 241, 0.15) !important;
          border-radius: 14px;
          padding: 12px 16px;
          font-size: 12px;
          color: #a5b4fc !important;
          -webkit-text-fill-color: #a5b4fc !important;
          line-height: 1.5;
        }
        html[data-theme='light'] .support-note {
          background-color: rgba(99, 102, 241, 0.08) !important;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          border: 1px solid rgba(99, 102, 241, 0.22) !important;
          color: #1e1b4b !important;
          -webkit-text-fill-color: #1e1b4b !important;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
        .no-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
        /* Override toaster container z-index globally to stay on top of support modal overlay */
        .go2072408551, div[style*="z-index: 9999"], div[style*="z-index:9999"], div[style*="z-index: 10000"], div[style*="z-index:10000"] {
          z-index: 999999 !important;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        /* Mobile responsive adjustments */
        @media (max-width: 576px) {
          .nav-dropdown {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
};

export default SupportModal;
