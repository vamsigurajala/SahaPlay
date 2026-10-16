import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import serverSrc from '../../../../backend/server.js?raw';
import { EMOTE_IDS } from '../../data/gamifyEmotes';
import { EMOTES } from './emotes';
import { worldToVirtual, virtualToWorld } from '../../data/gamifyZones';
import GamifyTour, { tourSeen } from './GamifyTour';
import GamifyPeople from './GamifyPeople';
import { toggleHideLabels, getHideLabels, setHideLabels } from './labelPrefs';

describe('quick reactions', () => {
  it('every reaction has an icon, and the server accepts exactly the same ids', () => {
    for (const id of EMOTE_IDS) expect(EMOTES[id].Icon).toBeTruthy();
    const m = serverSrc.match(/const AVATAR_EMOTES = \[([^\]]+)\]/);
    expect(m).toBeTruthy();
    const ids = m[1].split(',').map(x => x.trim().replace(/'/g, ''));
    expect(ids).toEqual(EMOTE_IDS);
  });
});

describe('walking to a person', () => {
  it('virtualToWorld undoes worldToVirtual', () => {
    const v = worldToVirtual(7.5, -22.25);
    const w = virtualToWorld(v.x, v.y);
    expect(w.x).toBeCloseTo(7.5);
    expect(w.z).toBeCloseTo(-22.25);
  });

  it('lists people by room and lets you walk to everyone except yourself', () => {
    const go = [];
    render(<GamifyPeople people={[
      { socketId: 'a', username: 'Asha', zone: 'kitchen', own: true },
      { socketId: 'b', username: 'Ravi', zone: 'kitchen' },
      { socketId: 'c', username: 'Meena', zone: 'lawn' },
    ]} onGo={(p) => go.push(p.username)} onClose={() => {}} />);
    expect(screen.getByText('In the house (3)')).toBeTruthy();
    fireEvent.click(screen.getByText('Ravi'));
    fireEvent.click(screen.getByText('Asha (you)'));
    expect(go).toEqual(['Ravi']);
  });
});

describe('house tour', () => {
  it('steps through and remembers it was seen', () => {
    localStorage.removeItem('sp_gamify_tour_done');
    expect(tourSeen()).toBe(false);
    let closed = false;
    render(<GamifyTour open onClose={() => { closed = true; }} />);
    expect(screen.getByText('Look around and walk')).toBeTruthy();
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Tap the glowing dots')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Skip tour'));
    expect(closed).toBe(true);
    expect(tourSeen()).toBe(true);
  });
});

describe('hide names and dots', () => {
  it('toggles and remembers', () => {
    setHideLabels(false);
    toggleHideLabels();
    expect(getHideLabels()).toBe(true);
    expect(localStorage.getItem('sp_gamify_hide_labels')).toBe('true');
    toggleHideLabels();
    expect(getHideLabels()).toBe(false);
  });
});
