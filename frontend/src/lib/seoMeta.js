// Single source of truth for per-route SEO metadata — imported both by <SeoHead>
// (client-side title/meta swaps via react-helmet-async during SPA navigation) and by
// scripts/prerender-meta.js (bakes the same tags into the raw HTML at build time, so
// crawlers that don't execute JS still see them). Keep these in sync by construction
// rather than duplicating the copy in two places.

export const SITE_URL = 'https://sahaplay.com';
export const SITE_NAME = 'SahaPlay';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/logos/trans_webl.png`;

const HOME_DESCRIPTION = 'Watch YouTube, Twitch, movies and more together with friends in perfect sync — free watch parties with live chat, screen sharing, and encrypted messaging.';
const HOME_TITLE = 'SahaPlay — Watch Together Online, Free Video Chat Rooms';

// Referenced by @id from the WebPage entry below so it reads as "SahaPlay
// (the organization) publishes this WebPage", per schema.org convention.
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: SITE_NAME,
  url: SITE_URL,
  logo: DEFAULT_OG_IMAGE,
};

export const PAGE_META = {
  '/': {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    // A single <script type="application/ld+json"> tag may contain a top-level
    // JSON array of schema objects (no @graph wrapper needed) — Google and Bing
    // both parse each entry independently.
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: SITE_NAME,
        url: SITE_URL,
        description: HOME_DESCRIPTION,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Web, Windows',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        url: SITE_URL,
        name: HOME_TITLE,
        description: HOME_DESCRIPTION,
        publisher: { '@id': ORGANIZATION_ID },
      },
      ORGANIZATION_SCHEMA,
    ],
  },
  '/login': {
    title: 'Log In — SahaPlay',
    description: 'Log in to SahaPlay to get back to your watch parties, encrypted chats, and synced streaming rooms.',
  },
  '/signup': {
    title: 'Sign Up Free — SahaPlay',
    description: 'Create a free SahaPlay account and start watching movies, shows, and streams together with friends in perfect sync.',
  },
  '/features': {
    title: 'Features — SahaPlay',
    description: "Explore SahaPlay's features: synced playback, live group chat, screen sharing, and end-to-end encrypted messaging for watch parties.",
  },
  '/how-it-works': {
    title: 'How It Works — SahaPlay',
    description: 'See how SahaPlay lets you create a room, invite friends, and watch YouTube, Twitch, and more together in real time.',
  },
  '/pricing': {
    title: 'Pricing — SahaPlay',
    description: "SahaPlay is free to use, with an optional Pro plan for power watchers. See what's included in each plan.",
  },
  '/contact': {
    title: 'Contact Us — SahaPlay',
    description: 'Get in touch with the SahaPlay team for support, feedback, or partnership inquiries.',
  },
  '/safety': {
    title: 'Safety — SahaPlay',
    description: 'Learn how SahaPlay keeps your watch parties and conversations safe and secure.',
  },
  '/cookies': {
    title: 'Cookie Policy — SahaPlay',
    description: "Read SahaPlay's cookie policy to understand how we use cookies on our platform.",
  },
  '/terms': {
    title: 'Terms of Service — SahaPlay',
    description: "Read SahaPlay's terms of service governing use of our watch party platform.",
  },
};

export function getPageMeta(pathname) {
  return PAGE_META[pathname] || null;
}
