import { describe, it, expect } from 'vitest';
import { SEATS, seatsIn } from './seats';
import { ALL_ZONES } from '../../data/gamifyZones';
import { CELL_W, CELL_D } from '../../data/gamifyZones';

const LANGS = 'ar bn de en es fr gu hi it ja kn ko ml mr pa pt ru ta te zh'.split(' ');
const files = import.meta.glob('../../../public/locales/*/translation.json', { eager: true, import: 'default' });
const locale = (c) => files[`../../../public/locales/${c}/translation.json`];
const holes = (s) => (String(s).match(/\{\{\w+\}\}/g) || []).sort().join(',');

describe('places to sit', () => {
  it('every seat is a real room, inside that room', () => {
    SEATS.forEach(s => {
      expect(ALL_ZONES[s.zone], s.id).toBeTruthy();
      expect(s.x).toBeGreaterThan(0.3); expect(s.x).toBeLessThan(CELL_W - 0.3);
      expect(s.z).toBeGreaterThan(0.3); expect(s.z).toBeLessThan(CELL_D - 0.3);
    });
    expect(seatsIn('hall').length).toBeGreaterThan(1);
    expect(seatsIn('nowhere')).toEqual([]);
  });
});

describe('house words in every language', () => {
  const en = locale('en').gamify;
  const leaves = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? leaves(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
  const need = [
    ...Object.keys(ALL_ZONES).map(z => `zones.${z}`),
    'link.goupstairs', 'link.godownstairs', 'goTo', 'tour.t6', 'tour.b6', 'daily.title', 'daily.today', 'seat.sit', 'join.joined', 'photo.take', 'games.snake', 'kinds.fridge',
  ];
  const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);

  it('English has every key', () => { need.forEach(k => expect(get(en, k), k).toBeTruthy()); });

  it.each(LANGS)('%s has all the same keys and placeholders', (c) => {
    const g = locale(c).gamify;
    leaves({ zones: en.zones, link: en.link, goTo: en.goTo, tour: en.tour, daily: en.daily, seat: en.seat, join: en.join, photo: en.photo, speaking: en.speaking, games: { snake: en.games.snake }, kinds: en.kinds }).forEach(([k, v]) => {
      const mine = get(g, k);
      expect(mine, `${c} ${k}`).toBeTruthy();
      expect(holes(mine), `${c} ${k}`).toBe(holes(v));
    });
  });
});
