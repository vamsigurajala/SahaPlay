import { useEffect, useState } from 'react';

// Real photographs (food, planets) from Wikipedia, looked up by article title and
// cached in localStorage. Wikipedia's summary endpoint returns a thumbnail of the
// article's lead image and allows cross-origin requests. If a lookup fails the
// callers keep drawing their illustrated fallback.

const KEY = 'sahaplay-wiki-img-v1';
let store = null;
const pending = new Map();
const waiters = [];
let running = 0;

const load = () => {
  if (store) return store;
  try { store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { store = {}; }
  return store;
};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage blocked */ } };
const norm = (t) => (Array.isArray(t) ? t : [t]);

function pump() {
  while (running < 4 && waiters.length) {
    const job = waiters.shift();
    running++;
    job().finally(() => { running--; pump(); });
  }
}

async function fetchOne(title) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { signal: ctl.signal });
    if (!r.ok) return { url: '', extract: '' };
    const j = await r.json();
    return { url: j?.thumbnail?.source || '', extract: j?.extract || '' };
  } finally { clearTimeout(t); }
}

// Resolves to an image URL ('' if none). `title` may be a list of fallbacks.
export function lookupWikiImage(title) {
  const titles = norm(title);
  const key = titles.join('|');
  const s = load();
  if (key in s) return Promise.resolve(s[key]);
  if (pending.has(key)) return pending.get(key);
  const p = new Promise((resolve) => {
    waiters.push(async () => {
      let out = '';
      let failed = false;
      for (const t of titles) {
        try { const r = await fetchOne(t); if (r.url) { out = r.url; break; } } catch { failed = true; }
      }
      if (out || !failed) { store[key] = out; save(); }
      pending.delete(key);
      resolve(out);
    });
    pump();
  });
  pending.set(key, p);
  return p;
}

export function useWikiImage(title) {
  const key = title ? norm(title).join('|') : '';
  const [url, setUrl] = useState(() => (key ? (load()[key] || '') : ''));
  useEffect(() => {
    if (!key) { return undefined; }
    let live = true;
    lookupWikiImage(title).then((u) => { if (live) setUrl(u || ''); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return key ? url || null : null;
}

export async function wikiExtract(title) {
  try { return (await fetchOne(title)).extract; } catch { return ''; }
}

let warmed = false;
// Warm the photos the kitchen viewers use, in the background.
export async function prefetchFoodImages() {
  if (warmed) return;
  warmed = true;
  try {
    if (navigator.connection?.saveData) return;
    const [{ FOOD_WIKI }, { FRIDGE_SHELVES, FRIDGE_SHELVES_UP, DISHES, DISHES_UP, OVEN_ITEMS, OVEN_ITEMS_UP }] = await Promise.all([import('./foodWiki'), import('./gamifyBooks')]);
    const names = [...FRIDGE_SHELVES.flat(), ...FRIDGE_SHELVES_UP.flat(), ...DISHES, ...DISHES_UP, ...OVEN_ITEMS, ...OVEN_ITEMS_UP].map(x => x.name);
    names.forEach((n) => { if (FOOD_WIKI[n]) lookupWikiImage(FOOD_WIKI[n]).then((u) => { if (u) { const im = new Image(); im.src = u; } }); });
  } catch { /* offline: viewers fall back to drawings */ }
}
