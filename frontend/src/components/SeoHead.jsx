import { Helmet } from 'react-helmet-async';
import { getPageMeta, SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '../lib/seoMeta';

// Renders the per-route <title>/meta description/Open Graph tags client-side (so SPA
// navigation between public pages updates the tab title/social-preview data correctly).
// The same content is also baked directly into each route's raw HTML at build time by
// scripts/prerender-meta.js, using src/lib/seoMeta.js as the shared source — that's what
// crawlers that don't execute JS (and the very first paint for ones that do) actually see.
const SeoHead = ({ path }) => {
  const meta = getPageMeta(path);
  if (!meta) return null;

  const url = `${SITE_URL}${path === '/' ? '' : path}`;

  return (
    <Helmet>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={url} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:image" content={meta.ogImage || DEFAULT_OG_IMAGE} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:image" content={meta.ogImage || DEFAULT_OG_IMAGE} />

      {meta.jsonLd && (
        <script type="application/ld+json">{JSON.stringify(meta.jsonLd)}</script>
      )}
    </Helmet>
  );
};

export default SeoHead;
