import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import serverSrc from '../../../../backend/server.js?raw';
import { DAILY_GAMES, dayNumber, gameOfTheDay, dateKey, reportScore, registerDailySender, dayBest, setDailyBoard, getDaily } from './dailyGame';
import { toggleFav, isFav, getFavs, favLabel, FAV_MAX } from './favorites';
import { itemFromDescriptor, receiveInvite, getCalmMusic, dismissInvite, joinInvite, registerCalmShare, shareCurrentMusic, playCalm, stopCalm } from './calmMusic';
import { profileFor, profileNameFor, setAmbienceOn, setAmbienceVolume, getAmbience, stopAmbience } from './ambience';

describe('game of the day', () => {
  it('uses the same list and the same day maths as the server', () => {
    const m = serverSrc.match(/const DAILY_GAMES = \[([^\]]+)\]/);
    expect(m[1].split(',').map(x => x.trim().replace(/'/g, ''))).toEqual(DAILY_GAMES);
    expect(serverSrc).toContain('Math.floor(Date.now() / 86400000)');
    expect(dayNumber(new Date(Date.UTC(2026, 9, 16, 23, 59)))).toBe(dayNumber(new Date(Date.UTC(2026, 9, 16, 0, 1))));
    expect(DAILY_GAMES).toContain(gameOfTheDay());
    expect(dateKey(new Date(Date.UTC(2026, 9, 16)))).toBe('2026-10-16');
  });

  it("sends a score only for today's game and only when it beats your best today", () => {
    localStorage.clear();
    const sent = [];
    registerDailySender((m) => sent.push(m));
    const g = gameOfTheDay();
    const other = DAILY_GAMES.find(x => x !== g);
    reportScore(other, 500);
    reportScore(g, 40);
    reportScore(g, 30);
    reportScore(g, 90);
    expect(sent).toEqual([{ type: 'score', game: g, score: 40 }, { type: 'score', game: g, score: 90 }]);
    expect(dayBest(g)).toBe(90);
    registerDailySender(null);
  });

  it('keeps only well-formed board rows', () => {
    setDailyBoard({ date: '2026-10-16', game: 'snake', board: [{ name: 'A', score: 10 }, { name: 5, score: 3 }, { name: 'B', score: 'x' }] });
    expect(getDaily().board).toEqual([{ name: 'A', score: 10 }]);
  });
});

describe('pinned things', () => {
  beforeEach(() => { localStorage.clear(); getFavs().slice().forEach(f => toggleFav(f)); });
  it('pins, unpins and stops at the limit', () => {
    expect(toggleFav({ kind: 'radio' })).toBe(true);
    expect(isFav({ kind: 'radio' })).toBe(true);
    expect(toggleFav({ kind: 'radio' })).toBe(true);
    expect(isFav({ kind: 'radio' })).toBe(false);
    for (let i = 0; i < FAV_MAX; i++) toggleFav({ kind: 'game', arg: `g${i}` });
    expect(toggleFav({ kind: 'game', arg: 'extra' })).toBe(false);
    expect(getFavs()).toHaveLength(FAV_MAX);
  });
  it('has readable names', () => {
    expect(favLabel({ kind: 'game', arg: 'snake' })).toBe('Snake');
    expect(favLabel({ kind: 'game', arg: 'hub' })).toBe('Game Hub');
    expect(favLabel({ kind: 'radio' })).toBe('Radio');
  });
});

describe('listening together', () => {
  it('rebuilds the player from ids and refuses anything else', () => {
    expect(itemFromDescriptor({ provider: 'youtube', video: 'hLQl3WQQoQ0' }, 'Song', 'Artist').src).toBe('https://www.youtube-nocookie.com/embed/hLQl3WQQoQ0?autoplay=1&rel=0&playsinline=1');
    expect(itemFromDescriptor({ provider: 'spotify', type: 'playlist', id: '37i9dQZF1DX7qK8ma5wgG1' }).src).toContain('open.spotify.com/embed/playlist/37i9dQZF1DX7qK8ma5wgG1');
    expect(itemFromDescriptor({ provider: 'youtube', video: 'bad' })).toBe(null);
    expect(itemFromDescriptor({ provider: 'youtube', src: 'https://evil.example' })).toBe(null);
    expect(itemFromDescriptor({ provider: 'other', id: 'x' })).toBe(null);
  });
  it('asks before playing, and plays only after joining', () => {
    stopCalm();
    receiveInvite('Ravi', { provider: 'youtube', video: 'hLQl3WQQoQ0' }, 'Someone Like You', 'Adele');
    expect(getCalmMusic().invite.from).toBe('Ravi');
    expect(getCalmMusic().current).toBe(null);
    dismissInvite();
    expect(getCalmMusic().invite).toBe(null);
    receiveInvite('Ravi', { provider: 'youtube', video: 'hLQl3WQQoQ0' }, 'Someone Like You', 'Adele');
    joinInvite();
    expect(getCalmMusic().current.title).toBe('Someone Like You');
    stopCalm();
  });
  it('shares what is playing, but only a description of it', () => {
    const sent = [];
    registerCalmShare((m) => sent.push(m));
    playCalm({ provider: 'youtube', title: 'T', by: 'B', src: 'https://www.youtube-nocookie.com/embed/hLQl3WQQoQ0', desc: { provider: 'youtube', video: 'hLQl3WQQoQ0' } });
    expect(shareCurrentMusic()).toBe(true);
    expect(sent[0]).toEqual({ desc: { provider: 'youtube', video: 'hLQl3WQQoQ0' }, title: 'T', by: 'B' });
    stopCalm();
    registerCalmShare(null);
  });
  it('the server checks the ids too', () => {
    expect(serverSrc).toContain("socket.on('calm_share'");
    expect(serverSrc).toContain('cleanShareDesc(desc)');
  });
});

describe('room sounds', () => {
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), gain: { value: 0, setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, Q: { value: 0 } });
  class FakeCtx {
    constructor() { this.sampleRate = 8000; this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createGain() { return node(); }
    createBiquadFilter() { return node(); }
    createOscillator() { return node(); }
    createBufferSource() { return node(); }
    createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; }
    resume() {}
    close() {}
  }
  beforeEach(() => { localStorage.clear(); window.AudioContext = FakeCtx; });
  afterEach(() => { setAmbienceOn(false); stopAmbience(); delete window.AudioContext; });

  it('gives each kind of room its own sound', () => {
    expect(profileNameFor('lawn')).toBe('garden');
    expect(profileNameFor('terrace')).toBe('rain');
    expect(profileNameFor('market')).toBe('market');
    expect(profileNameFor('f2kitchen')).toBe('kitchen');
    expect(profileNameFor('f2breakup')).toBe('calm');
    expect(profileNameFor('study')).toBe('room');
    expect(profileFor('lawn').birds).toBe(true);
  });
  it('turns on, remembers, and turns off', () => {
    setAmbienceOn(true);
    expect(getAmbience().on).toBe(true);
    setAmbienceVolume(0.8);
    expect(JSON.parse(localStorage.getItem('sp_gamify_ambience'))).toEqual({ on: true, volume: 0.8 });
    setAmbienceOn(false);
    expect(getAmbience().on).toBe(false);
  });
  it('stays off without audio support instead of failing', () => {
    delete window.AudioContext;
    setAmbienceOn(true);
    expect(getAmbience().on).toBe(false);
  });
});
