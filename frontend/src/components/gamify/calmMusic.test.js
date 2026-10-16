import { describe, it, expect } from 'vitest';
import { SONGS, parseYouTube, parseSpotify, youTubeEmbed, spotifyEmbed, playCalm, stopCalm, getCalmMusic } from './calmMusic';

describe('calm music links', () => {
  it('reads the usual YouTube link shapes', () => {
    const id = 'hLQl3WQQoQ0';
    expect(parseYouTube(`https://www.youtube.com/watch?v=${id}&t=30s`)).toEqual({ video: id, list: null });
    expect(parseYouTube(`https://youtu.be/${id}?si=abc`)).toEqual({ video: id, list: null });
    expect(parseYouTube(`music.youtube.com/watch?v=${id}`)).toEqual({ video: id, list: null });
    expect(parseYouTube(`https://www.youtube.com/shorts/${id}`)).toEqual({ video: id, list: null });
    expect(parseYouTube('https://www.youtube.com/playlist?list=PLabcdefghijklmnop')).toEqual({ video: null, list: 'PLabcdefghijklmnop' });
  });

  it('rejects anything that is not a YouTube video or playlist', () => {
    for (const bad of ['', 'hello', 'https://evil.example/watch?v=hLQl3WQQoQ0', 'https://www.youtube.com/watch?v=short', 'javascript:alert(1)']) {
      expect(parseYouTube(bad)).toBe(null);
    }
  });

  it('builds embeds only from parsed ids', () => {
    expect(youTubeEmbed({ video: 'hLQl3WQQoQ0', list: null })).toBe('https://www.youtube-nocookie.com/embed/hLQl3WQQoQ0?autoplay=1&rel=0&playsinline=1');
    expect(youTubeEmbed({ video: null, list: 'PLabcdefghijklmnop' })).toContain('/embed/videoseries?');
  });

  it('reads Spotify links and uris', () => {
    const id = '4uLU6hMCjMI75M1A2tKUQC';
    expect(parseSpotify(`https://open.spotify.com/track/${id}?si=x`)).toEqual({ type: 'track', id });
    expect(parseSpotify(`https://open.spotify.com/intl-de/playlist/${id}`)).toEqual({ type: 'playlist', id });
    expect(parseSpotify(`spotify:album:${id}`)).toEqual({ type: 'album', id });
    expect(spotifyEmbed({ type: 'track', id })).toBe(`https://open.spotify.com/embed/track/${id}?utm_source=generator&theme=0`);
    for (const bad of ['', 'https://example.com/track/' + id, 'https://open.spotify.com/user/x', 'https://open.spotify.com/track/short']) expect(parseSpotify(bad)).toBe(null);
  });

  it('suggests a few songs in English, Hindi and Telugu', () => {
    expect(Object.keys(SONGS)).toEqual(['english', 'hindi', 'telugu']);
    for (const lang of Object.values(SONGS)) {
      expect(lang.songs).toHaveLength(3);
      for (const s of lang.songs) expect(parseYouTube(`https://youtu.be/${s.yt}`)).toEqual({ video: s.yt, list: null });
    }
  });

  it('keeps what is playing until it is stopped', () => {
    playCalm({ provider: 'youtube', title: 'x', by: '', src: 'https://www.youtube-nocookie.com/embed/hLQl3WQQoQ0' });
    expect(getCalmMusic().current.title).toBe('x');
    stopCalm();
    expect(getCalmMusic().current).toBe(null);
  });
});
