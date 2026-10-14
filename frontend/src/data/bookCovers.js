import { useEffect, useState } from 'react';

// Real cover art from Open Library (https://openlibrary.org). Each book is looked
// up once by title and author, the cover id is remembered in localStorage, and the
// image itself is a plain <img>. If the lookup fails, is offline, or the title is
// a short poem with no meaningful cover, callers fall back to a generated cover.

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
  const s = load();
  if (book.id in s) return Promise.resolve(s[book.id]);
  if (pending.has(book.id)) return pending.get(book.id);
  const q = QUERY[book.id] || { title: book.title.replace(/\(.*?\)/g, '').trim(), author: book.author };
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
export function useBookCover(book, size = 'M') {
  const none = NO_COVER.has(book.id);
  const [id, setId] = useState(() => (none ? 0 : (load()[book.id] || 0)));
  useEffect(() => {
    if (none) return undefined;
    let live = true;
    lookup(book).then(v => { if (live) setId(v || 0); });
    return () => { live = false; };
  }, [book, none]);
  return !none && id ? `https://covers.openlibrary.org/b/id/${id}-${size}.jpg` : null;
}
