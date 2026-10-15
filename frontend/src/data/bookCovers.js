import { useEffect, useState } from 'react';
import { BOOK_COVERS } from './gamifyManifest';

// Curated self-hosted book covers stored under public/images/gamify/books/,
// with Open Library (https://openlibrary.org) live search kept as fallback.
// If the lookup fails, is offline, or the title is a short poem with no
// meaningful cover, callers fall back to a generated cover.

const KEY = 'sahaplay-book-covers-v1';
const NO_COVER = new Set(['sonnet18', 'ozymandias', 'daffodils', 'if']);
const QUERY = {
  gitanjali: { title: 'Gitanjali', author: 'Rabindranath Tagore' },
  gitanjali1: { title: 'Gitanjali', author: 'Rabindranath Tagore' },
  panchatantra: { title: 'Panchatantra', author: 'Vishnu Sharma' },
  tenali: { title: 'Tenali Rama', author: '' },
  birbal: { title: 'Akbar and Birbal', author: '' },
};

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

function pump() {
  while (running < 4 && waiters.length) {
    const job = waiters.shift();
    running++;
    job().finally(() => { running--; pump(); });
  }
}

function lookup(book) {
  if (!book?.id) return Promise.resolve(0);
  const s = load();
  if (book.id in s) return Promise.resolve(s[book.id]);
  if (pending.has(book.id)) return pending.get(book.id);
  const q = QUERY[book.id] || { title: (book.title || '').replace(/\(.*?\)/g, '').trim(), author: book.author };
  const url = `https://openlibrary.org/search.json?limit=1&fields=cover_i&title=${encodeURIComponent(q.title)}${q.author ? `&author=${encodeURIComponent(q.author)}` : ''}`;
  const p = new Promise((resolve) => {
    waiters.push(async () => {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 8000);
        const r = await fetch(url, { signal: ctl.signal });
        clearTimeout(t);
        const j = await r.json();
        const id = j?.docs?.[0]?.cover_i || 0;
        store[book.id] = id;
        save();
        resolve(id);
      } catch {
        resolve(0); // not cached, so a later visit retries
      }
      pending.delete(book.id);
    });
    pump();
  });
  pending.set(book.id, p);
  return p;
}

// Returns a cover image URL (or null while loading / when none exists).
// Checks the curated self-hosted manifest first, then falls back to Open Library.
export function useBookCover(book, size = 'M') {
  const localCover = book?.id ? BOOK_COVERS?.[book.id] : null;
  const none = !book?.id || (NO_COVER.has(book.id) && !localCover);
  const [url, setUrl] = useState(() => (localCover || (none ? null : (load()[book.id] ? `https://covers.openlibrary.org/b/id/${load()[book.id]}-${size}.jpg` : null))));

  useEffect(() => {
    if (localCover) {
      setUrl(localCover);
      return undefined;
    }
    if (none) {
      setUrl(null);
      return undefined;
    }
    let live = true;
    lookup(book).then((v) => {
      if (live) setUrl(v ? `https://covers.openlibrary.org/b/id/${v}-${size}.jpg` : null);
    });
    return () => { live = false; };
  }, [book, localCover, none, size]);

  return url;
}

const keep = [];
const preloaded = new Set();
export function preloadImage(url) {
  if (!url || preloaded.has(url)) return;
  preloaded.add(url);
  const im = new Image();
  im.decoding = 'async';
  im.src = url;
  keep.push(im);
}
export const coverUrl = (id, size = 'M') => `https://covers.openlibrary.org/b/id/${id}-${size}.jpg`;

// Warm everything in the background (curated local covers first, then Open Library covers),
// so the shelves open with covers already there. Called once when a room is entered.
let warmed = false;
export async function prefetchBookCovers() {
  if (warmed) return;
  warmed = true;
  try {
    if (navigator.connection?.saveData) return;
    const { BOOKS } = await import('./gamifyBooks');
    BOOKS.forEach((b) => {
      const local = BOOK_COVERS?.[b.id];
      if (local) {
        preloadImage(local);
      } else if (!NO_COVER.has(b.id)) {
        lookup(b).then((id) => { if (id) preloadImage(coverUrl(id, 'M')); });
      }
    });
  } catch { /* offline etc: the shelves load covers on demand instead */ }
}
