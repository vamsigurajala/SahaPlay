import { useSyncExternalStore } from 'react';
import { GAMES } from './games';
import { SHOPS } from '../../data/gamifyShops';
import { PAINTINGS } from '../../data/gamifyPaintings';

// Pinned things (a game, the radio, a shop...) shown as quick buttons in the house.
// Each is just what the house needs to open it again: a kind and an optional arg.

const KEY = 'sp_gamify_favs';
const MAX = 6;
const KIND_LABELS = {
  fridge: 'Fridge', stove: 'Stove', oven: 'Oven', books: 'Bookshelf', radio: 'Radio', breakup: 'Breakup Room',
  telescope: 'Telescope', garden: 'Garden', clock: 'Clock', monitor: 'Computer', puzzles: 'Puzzles', cupboard: 'Cupboard',
  wardrobe: 'Wardrobe', cosmetics: 'Dressing table', dog: 'Dog', pond: 'Pond', supercar: 'Supercar', garage: 'Garage',
  monalisa: 'Mona Lisa', roti: 'Roti maker', painting: 'Painting', shop: 'Shop', game: 'Game',
};

export function favLabel({ kind, arg }) {
  if (kind === 'game') {
    if (arg === 'hub') return 'Game Hub';
    if (arg === 'console') return 'Game Console';
    return GAMES[arg]?.title || 'Game';
  }
  if (kind === 'shop') return SHOPS[arg]?.name || 'Shop';
  if (kind === 'painting') return PAINTINGS[arg]?.title || 'Painting';
  if (kind === 'stove' || kind === 'fridge' || kind === 'oven') return `${KIND_LABELS[kind]}${arg === 'up' ? ' (upstairs)' : ''}`;
  return KIND_LABELS[kind] || kind;
}

const same = (a, b) => a.kind === b.kind && (a.arg || '') === (b.arg || '');

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter(x => x && typeof x.kind === 'string').slice(0, MAX).map(x => ({ kind: x.kind, arg: typeof x.arg === 'string' ? x.arg : undefined })) : [];
  } catch { return []; }
}

let favs = read();
const listeners = new Set();
const commit = (next) => {
  favs = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach(l => l());
};

export const getFavs = () => favs;
export const isFav = (item) => favs.some(f => same(f, item));
export const FAV_MAX = MAX;
// Pins or unpins. Returns false when the strip is full and the item was not added.
export function toggleFav(item) {
  if (isFav(item)) { commit(favs.filter(f => !same(f, item))); return true; }
  if (favs.length >= MAX) return false;
  commit([...favs, { kind: item.kind, arg: item.arg }]);
  return true;
}
export const useFavs = () => useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, getFavs, getFavs);
