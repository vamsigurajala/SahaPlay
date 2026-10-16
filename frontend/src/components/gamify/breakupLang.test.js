import { describe, it, expect } from 'vitest';
import { CONTENT, BREAKUP_LANGS, SPOTIFY_PLAYLISTS } from './breakupLang';
import { INDIAN_PAINTINGS, ROOM_PAINTING, localizedPainting } from '../../data/gamifyIndianPaintings';
import { SONGS, youTubeQueue, setAppLinked, getCalmMusic } from './calmMusic';

describe('Breakup Room languages', () => {
  it('has its own letters, comfort words and songs notes in every language', () => {
    for (const { code } of BREAKUP_LANGS) {
      const c = CONTENT[code];
      expect(c.letters).toHaveLength(4);
      expect(c.healing).toHaveLength(5);
      expect(Object.keys(c.ui.tabs)).toEqual(['music', 'letters', 'burn', 'healing', 'art']);
      expect(SPOTIFY_PLAYLISTS[code].length).toBeGreaterThan(0);
    }
  });

  it('is written separately, not copied between languages', () => {
    const titles = BREAKUP_LANGS.map(l => CONTENT[l.code].letters[0].title);
    expect(new Set(titles).size).toBe(3);
    expect(CONTENT.hi.letters[0].content).not.toBe(CONTENT.en.letters[0].content);
    expect(CONTENT.te.healing[0]).not.toBe(CONTENT.hi.healing[0]);
  });

  it('hangs a different Indian painting for each language and translates its story', () => {
    expect(new Set(Object.values(ROOM_PAINTING)).size).toBe(3);
    for (const id of Object.values(ROOM_PAINTING)) {
      const art = INDIAN_PAINTINGS[id];
      expect(art.img).toMatch(/^\/images\/gamify\/art\//);
      expect(art.credit).toBeTruthy();
      for (const code of ['hi', 'te']) {
        const p = localizedPainting(art, code);
        expect(p.story).not.toBe(art.story);
        expect(p.look).toHaveLength(3);
      }
    }
  });

  it('has a song note in the right language for every suggested song', () => {
    const key = { en: 'english', hi: 'hindi', te: 'telugu' };
    for (const { code } of BREAKUP_LANGS) for (const s of SONGS[key[code]].songs) expect(CONTENT[code].songNotes[s.yt]).toBeTruthy();
  });
});

describe('music apps', () => {
  it('builds a YouTube queue from valid ids only', () => {
    expect(youTubeQueue(['hLQl3WQQoQ0', 'k4V3Mo61fJM', 'bad'])).toBe('https://www.youtube-nocookie.com/embed/hLQl3WQQoQ0?autoplay=1&rel=0&playsinline=1&playlist=k4V3Mo61fJM');
    expect(youTubeQueue(['bad'])).toBe(null);
  });

  it('remembers which apps are linked and ignores unknown ones', () => {
    setAppLinked('spotify', true);
    setAppLinked('nope', true);
    expect(getCalmMusic().linked.spotify).toBe(true);
    expect(getCalmMusic().linked.nope).toBeUndefined();
    setAppLinked('spotify', false);
    expect(getCalmMusic().linked.spotify).toBe(false);
  });
});
