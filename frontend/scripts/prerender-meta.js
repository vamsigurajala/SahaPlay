// Bakes per-route <title>/meta description/Open Graph/JSON-LD tags directly into a
// static copy of dist/index.html for each public marketing route. This app is a plain
// client-rendered SPA (no SSR) — react-helmet-async (see src/components/SeoHead.jsx)
// only rewrites <head> after React mounts, so a crawler or "view-source" request that
// doesn't execute JS would otherwise always see the generic static <title>SahaPlay</title>
// with no description, regardless of which page it requested. Since these marketing
// pages' metadata is static (not per-user/per-param), a full SSR framework isn't needed —
// writing one pre-baked index.html per route and letting Vercel's static file serving
// pick it up (ahead of the SPA catch-all rewrite in vercel.json) is enough.
//
// Run automatically after `vite build` (see package.json's "build" script).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_META, SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '../src/lib/seoMeta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const templatePath = path.join(distDir, 'index.html');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHead(template, route, meta) {
  const url = `${SITE_URL}${route === '/' ? '' : route}`;
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const image = meta.ogImage || DEFAULT_OG_IMAGE;

  const tags = [
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    meta.jsonLd ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>` : '',
  ].filter(Boolean).join('\n    ');

  return template
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace('</head>', `    ${tags}\n  </head>`);
}

function main() {
  if (!fs.existsSync(templatePath)) {
    console.error('[prerender-meta] dist/index.html not found — run `vite build` first.');
    process.exit(1);
  }
  const template = fs.readFileSync(templatePath, 'utf-8');

  for (const [route, meta] of Object.entries(PAGE_META)) {
    const html = buildHead(template, route, meta);
    if (route === '/') {
      fs.writeFileSync(templatePath, html);
    } else {
      const outDir = path.join(distDir, route.replace(/^\//, ''));
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'index.html'), html);
    }
    console.log(`[prerender-meta] wrote metadata for ${route}`);
  }
}

main();
