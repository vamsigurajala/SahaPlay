import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { FaWhatsapp, FaTelegramPlane } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { isTauriApp } from '../lib/platform';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.sahaplay.app&pcampaignid=web_share';

const Footer = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [hoveredSocial, setHoveredSocial] = useState(null);

  // The desktop app has no use for the marketing/legal footer (Product links,
  // social handles, language picker for a marketing site) — it's already an
  // installed app, not a page someone's deciding whether to sign up from.
  if (isTauriApp()) return null;

  const languageNames = {
    en: 'English (International)',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    ja: '日本語',
    ko: '한국어',
    zh: '简体中文',
    hi: 'हिन्दी',
    pt: 'Português',
    ar: 'العربية',
    ru: 'Русский',
    it: 'Italiano',
    te: 'తెలుగు',
    ta: 'தமிழ்',
    bn: 'বাংলা',
    mr: 'मराठी',
    gu: 'ગુજરાતી',
    ml: 'മലയാളം',
    kn: 'ಕನ್ನಡ',
    pa: 'ਪੰਜਾਬੀ'
  };
  const currentLang = i18n.language || 'en';
  const langKey = currentLang.split('-')[0];
  const langDisplayName = languageNames[langKey] || languageNames['en'];


  return (
    <footer className="home-footer">
      <div style={{ maxWidth: 1200, marginLeft: 'auto', marginRight: 'auto' }} className="footer-grid">
        {/* Brand Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/logos/trans_webl.png" alt="SahaPlay" style={{ width: 32, height: 32 }} />
            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>SahaPlay</h3>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 300, color: '#6b7280', margin: 0, cursor: 'text' }}>
            {t('footerDesc', 'Stream, share, and celebrate together — no matter where you are.')}
          </p>

          {/* Get the app — official Google Play badge, above the social share
              row per explicit request: banner first, then "Share this
              application" label, then the X/Telegram/WhatsApp icons below. */}
          <div>
            <h4 style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', margin: '0 0 10px' }}>
              {t('getTheApp', 'Get the App')}
            </h4>
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', lineHeight: 0 }}
              title={t('getItOnGooglePlay', 'Get it on Google Play')}
            >
              <img
                src="/images/google-play-badge.png"
                alt={t('getItOnGooglePlay', 'Get it on Google Play')}
                style={{ height: 50, width: 'auto', display: 'block' }}
              />
            </a>
          </div>

          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: '0 0 10px' }}>
              {t('shareThisApp', 'Share this application:')}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                {
                  Icon: FaXTwitter,
                  label: 'X (Twitter)',
                  brandBg: '#000000',
                  href: `https://twitter.com/intent/tweet?text=${encodeURIComponent('Watch together with friends in sync! 🎬')}&url=${encodeURIComponent(window.location.origin)}`
                },
                {
                  Icon: FaTelegramPlane,
                  label: 'Telegram',
                  brandBg: '#0088cc',
                  href: `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent('Watch together with friends in sync! 🎬')}`
                },
                {
                  Icon: FaWhatsapp,
                  label: 'WhatsApp',
                  brandBg: '#25d366',
                  href: `https://wa.me/?text=${encodeURIComponent('Watch together with friends in sync! 🎬 ' + window.location.origin)}`
                }
              ].map(({ Icon, label, href, brandBg }, idx) => (
                <button
                  key={idx}
                  className="footer-social-btn"
                  title={`Share on ${label}`}
                  onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
                  onMouseEnter={() => setHoveredSocial(idx)}
                  onMouseLeave={() => setHoveredSocial(null)}
                  style={hoveredSocial === idx ? {
                    background: brandBg,
                    borderColor: brandBg,
                    color: '#ffffff',
                    transform: 'translateY(-2px)',
                  } : {}}
                >
                  <Icon size={18}/>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Column */}
        <div>
          <h4 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 24 }}>{t('product', 'Product')}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button className="footer-link-btn" onClick={() => navigate('/')}>{t('home', 'Home')}</button>
            <button className="footer-link-btn" onClick={() => navigate('/features')}>{t('features', 'Features')}</button>
            <button className="footer-link-btn" onClick={() => navigate('/how-it-works')}>{t('howItWorks', 'Guide')}</button>
            <button className="footer-link-btn" onClick={() => navigate('/public')}>{t('explore', 'Explore')}</button>
            <button className="footer-link-btn" onClick={() => navigate('/pricing')}>{t('pricing', 'Pricing')}</button>
          </div>
        </div>

        {/* Support Column */}
        <div>
          <h4 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 24 }}>{t('support', 'Support')}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button className="footer-link-btn" onClick={() => navigate('/contact')}>{t('contactUs', 'Contact Us')}</button>
            <button className="footer-link-btn" onClick={() => navigate('/report-bug')}>{t('reportBug', 'Report Bug')}</button>
            <button className="footer-link-btn" onClick={() => navigate('/safety')}>{t('safety', 'Safety')}</button>
          </div>
        </div>

        {/* Legal Column */}
        <div>
          <h4 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 24 }}>{t('legal', 'Legal')}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button className="footer-link-btn" onClick={() => window.open('https://www.iubenda.com/privacy-policy/25516226', '_blank', 'noopener,noreferrer')}>
              {t('privacyPolicy', 'Privacy Policy')}
            </button>
            <button className="footer-link-btn" onClick={() => navigate('/terms')}>{t('termsOfService', 'Terms of Service')}</button>
            <button className="footer-link-btn" onClick={() => navigate('/cookies')}>{t('cookiePolicy', 'Cookie Policy')}</button>
            <button className="footer-link-btn" onClick={() => navigate('/legal/law-enforcement')}>{t('lawEnforcementGuidelines', 'Law Enforcement Guidelines')}</button>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="home-footer-bottom footer-bottom-bar" style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div>&copy; 2026 SahaPlay. {t('allRightsReserved', 'All rights reserved.')}</div>
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={14}/> {langDisplayName}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
