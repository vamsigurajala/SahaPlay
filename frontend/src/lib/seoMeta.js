// Single source of truth for per-route SEO metadata — imported both by <SeoHead>
// (client-side title/meta swaps via react-helmet-async during SPA navigation) and by
// scripts/prerender-meta.js (bakes the same tags into the raw HTML at build time, so
// crawlers that don't execute JS still see them). Keep these in sync by construction
// rather than duplicating the copy in two places.

export const SITE_URL = 'https://sahaplay.com';
export const SITE_NAME = 'SahaPlay';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/logos/trans_webl.png`;

const HOME_DESCRIPTION = 'Watch YouTube, Twitch, movies and more together with friends in perfect sync — free watch parties with live chat, screen sharing, and encrypted messaging.';
const HOME_TITLE = 'SahaPlay — Watch Together From Anywhere, Free Video Chat Rooms';

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

// Question/answer text here must match the visible homepage FAQ copy in Home.jsx exactly.
const HOME_FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is SahaPlay free?',
      acceptedAnswer: { '@type': 'Answer', text: "Yes — SahaPlay is completely free to use, with no download required. There's also an optional Pro plan for extras like larger file uploads, but every core watch-together feature is free." },
    },
    {
      '@type': 'Question',
      name: 'Do I need to download anything to use SahaPlay?',
      acceptedAnswer: { '@type': 'Answer', text: "No, you don't need to download anything — SahaPlay runs entirely in your browser, so there's nothing to install for you or the friends you invite. Just open a room link and start watching." },
    },
    {
      '@type': 'Question',
      name: 'How does watch-together video sync work?',
      acceptedAnswer: { '@type': 'Answer', text: "SahaPlay uses real-time WebSocket connections to keep everyone's play, pause, and seek actions in sync within milliseconds, so the whole room sees the same moment at the same time." },
    },
    {
      '@type': 'Question',
      name: 'Is SahaPlay chat encrypted?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes. Private and group chats in SahaPlay are end-to-end encrypted, including supported messages, images, files, and voice notes. Content is encrypted before it leaves your device, so only the intended recipients can decrypt it.' },
    },
    {
      '@type': 'Question',
      name: 'What can I watch together on SahaPlay?',
      acceptedAnswer: { '@type': 'Answer', text: 'You can watch almost anything together: Twitch and YouTube streams directly in the room, Netflix or Prime Video via screenshare, or your own uploaded video files — all perfectly synced for everyone.' },
    },
    {
      '@type': 'Question',
      name: 'How many languages does SahaPlay support?',
      acceptedAnswer: { '@type': 'Answer', text: 'SahaPlay currently supports 20 languages: English, Spanish, French, German, Japanese, Korean, Chinese, Hindi, Portuguese, Arabic, Russian, Italian, Telugu, Tamil, Bengali, Marathi, Gujarati, Malayalam, Kannada, and Punjabi. You can change your language anytime from the Settings menu.' },
    },
    {
      '@type': 'Question',
      name: "Can I hide other people's videos when streaming in a room?",
      acceptedAnswer: { '@type': 'Answer', text: 'Yes — you can hide or unhide anyone\'s camera video at any time. Just click their video feed and select "Hide Video"; this only affects your own view, not what others in the room see.' },
    },
    {
      '@type': 'Question',
      name: 'Can I watch Netflix or Prime Video with friends?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes — using the Screenshare feature. The host shares their Netflix or Prime Video browser tab and everyone in the room sees it in real time. Only the host needs a subscription to those services. Screenshare works best in Chrome browser.' },
    },
    {
      '@type': 'Question',
      name: 'What happens if my internet drops during a watch party?',
      acceptedAnswer: { '@type': 'Answer', text: 'SahaPlay automatically tries to reconnect you to the room. Once you are back online, it jumps you to exactly where the video is currently playing — so you never miss anything. Your chat history also reloads automatically.' },
    },
  ],
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
      HOME_FAQ_SCHEMA,
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
  '/legal/law-enforcement': {
    title: 'Law Enforcement Guidelines — SahaPlay',
    description: "What SahaPlay can and cannot provide under legal process, and how to submit a legitimate government or law enforcement request.",
  },
};

export function getPageMeta(pathname) {
  return PAGE_META[pathname] || null;
}
