import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PAINTINGS, PAINTING_IDS } from '../../data/gamifyPaintings';
import { TV_UP, TV_UP_H } from './constants';

describe('upstairs living room paintings', () => {
  it('has five paintings, each with a bundled image and a full story', () => {
    expect(PAINTING_IDS).toHaveLength(5);
    for (const id of PAINTING_IDS) {
      const p = PAINTINGS[id];
      expect(fs.existsSync(path.join(globalThis.process.cwd(), 'public', p.img))).toBe(true);
      expect(p.w).toBeGreaterThan(0);
      expect(p.h).toBeGreaterThan(0);
      for (const f of ['title', 'artist', 'year', 'why', 'story', 'behind']) expect(p[f]).toBeTruthy();
      expect(p.look.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('the TV is wide and still fits between the console and the ceiling', () => {
    expect(TV_UP.w).toBeGreaterThanOrEqual(5);
    expect(TV_UP.cy - TV_UP_H / 2).toBeGreaterThan(0);
  });
});

describe('house radio', () => {
  let radio;
  let el;
  beforeEach(async () => {
    vi.resetModules();
    el = null;
    vi.stubGlobal('Audio', class {
      constructor() { this.l = {}; this.volume = 1; el = this; }
      addEventListener(n, f) { this.l[n] = f; }
      play() { return Promise.resolve(); }
      pause() { this.l.pause && this.l.pause(); }
      load() {}
      removeAttribute() {}
    });
    radio = await import('./radioPlayer');
  });

  it('goes from tuning in to live, pauses, and stops', () => {
    expect(radio.getRadioState().status).toBe('idle');
    radio.playStation({ id: 'x', name: 'Test FM', url: 'https://example.com/stream' });
    expect(radio.getRadioState().status).toBe('loading');
    el.l.playing();
    expect(radio.getRadioState().status).toBe('playing');
    radio.toggleRadio();
    expect(radio.getRadioState().status).toBe('paused');
    radio.stopRadio();
    expect(radio.getRadioState().station).toBe(null);
    expect(radio.getRadioState().status).toBe('idle');
  });

  it('reports a station that cannot be reached', () => {
    radio.playStation({ id: 'y', name: 'Broken FM', url: 'https://example.com/none' });
    el.l.error();
    expect(radio.getRadioState().status).toBe('error');
    expect(radio.getRadioState().error).toMatch(/not available/);
  });

  it('keeps the volume between 0 and 1', () => {
    radio.setRadioVolume(3);
    expect(radio.getRadioState().volume).toBe(1);
    radio.setRadioVolume(-1);
    expect(radio.getRadioState().volume).toBe(0);
  });
});
