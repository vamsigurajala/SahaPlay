import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { GAMES } from './index';
import GameViewer from './index';

// jsdom has no canvas: a no-op 2D context that tolerates every call the games make.
const gradient = { addColorStop: () => {} };
const ctx = new Proxy({}, {
  get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => gradient : (k in t ? t[k] : () => {})),
  set: (t, k, v) => { t[k] = v; return true; },
});

beforeEach(() => {
  vi.useFakeTimers();
  HTMLCanvasElement.prototype.getContext = () => ctx;
  vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(() => cb(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', (id) => clearTimeout(id));
  try { localStorage.clear(); } catch { /* ignore */ }
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const run = (ms) => act(() => { vi.advanceTimersByTime(ms); });

const FILES = {
  pool: () => import('./PoolGame'), pingpong: () => import('./PingPongGame'), foosball: () => import('./FoosballGame'), claw: () => import('./ClawGame'),
  snake: () => import('./SnakeGame'), breakout: () => import('./BreakoutGame'), tetris: () => import('./TetrisGame'), invaders: () => import('./InvadersGame'),
  flappy: () => import('./FlappyGame'), g2048: () => import('./Game2048'), whack: () => import('./WhackGame'), mines: () => import('./MinesGame'),
  connect4: () => import('./ConnectFourGame'), racing: () => import('./RacingGame'), penalty: () => import('./PenaltyGame'), airhockey: () => import('./AirHockeyGame'),
  dj: () => import('./DjBooth'), mixbar: () => import('./MixBar'), cricket: () => import('./CricketGame'), xoxo: () => import('./XoxoGame'),
};

describe('Game Room games', () => {
  it('lists every game and each one has an implementation file', () => {
    expect(Object.keys(GAMES).sort()).toEqual(Object.keys(FILES).sort());
  });

  for (const id of Object.keys(FILES)) {
    it(`${id} starts, runs for a few seconds and unmounts cleanly`, async () => {
      vi.useRealTimers();
      const Game = (await FILES[id]()).default;
      vi.useFakeTimers();
      const { unmount, container } = render(<Game />);
      expect(container.firstChild).toBeTruthy();
      // keyboard and pointer input must not throw whatever the game is
      for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ']) fireEvent.keyDown(window, { key });
      const canvas = container.querySelector('canvas');
      if (canvas) { fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20 }); fireEvent.pointerMove(canvas, { clientX: 40, clientY: 30 }); fireEvent.pointerUp(canvas); }
      run(3000);
      unmount();
      run(500);
    });
  }

  it('hub lists the games and opens one', async () => {
    vi.useRealTimers();
    render(<GameViewer id="hub" />);
    expect(screen.getByText('Game Hub')).toBeInTheDocument();
    for (const g of Object.values(GAMES)) expect(screen.getByText(g.title)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Connect Four'));
    expect(await screen.findByText(/Your turn/i, {}, { timeout: 4000 })).toBeInTheDocument();
    fireEvent.click(screen.getByText('All games'));
    expect(screen.getByText('Game Hub')).toBeInTheDocument();
  });

  it('console menu only shows console games', () => {
    vi.useRealTimers();
    render(<GameViewer id="console" />);
    expect(screen.getByText('Turbo Racing')).toBeInTheDocument();
    expect(screen.getByText('Penalty Shootout')).toBeInTheDocument();
    expect(screen.getByText('Air Hockey')).toBeInTheDocument();
    expect(screen.queryByText('Snake')).not.toBeInTheDocument();
  });

  it('connect four: the computer answers after you drop a disc', async () => {
    vi.useRealTimers();
    const Game = (await FILES.connect4()).default;
    vi.useFakeTimers();
    render(<Game />);
    fireEvent.click(screen.getAllByLabelText('column 4')[0]);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
    run(900);
    expect(screen.getByText(/Your turn/i)).toBeInTheDocument();
  });

  it('mocktail bar scores a perfect drink', async () => {
    vi.useRealTimers();
    const Game = (await FILES.mixbar()).default;
    vi.useFakeTimers();
    render(<Game />);
    for (const name of ['Grenadine', 'Orange juice', 'Soda water']) fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));
    fireEvent.click(screen.getByRole('button', { name: /Serve/ }));
    expect(screen.getByText(/Perfect/)).toBeInTheDocument();
  });

  it('minesweeper: the first click is always safe and starts the clock', async () => {
    vi.useRealTimers();
    const Game = (await FILES.mines()).default;
    vi.useFakeTimers();
    const { container } = render(<Game />);
    const cells = container.querySelectorAll('button[style*="aspect-ratio"]');
    expect(cells.length).toBe(81);
    fireEvent.click(cells[40]);
    run(1200);
    expect(screen.queryByText(/Boom/)).not.toBeInTheDocument();
  });

  it('claw machine: a drop uses a try and the claw comes back', async () => {
    vi.useRealTimers();
    const Game = (await FILES.claw()).default;
    vi.useFakeTimers();
    render(<Game />);
    fireEvent.click(screen.getByRole('button', { name: /Drop \(6\)/ }));
    run(15000);
    expect(screen.getByRole('button', { name: /Drop \(5\)/ })).toBeInTheDocument();
  });

  it('hand cricket: you bat, a ball is played, and the score or an out shows', async () => {
    vi.useRealTimers();
    const Game = (await FILES.cricket()).default;
    vi.useFakeTimers();
    render(<Game />);
    expect(screen.getAllByText(/You bat first/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '6' }));
    run(900);
    expect(screen.getAllByText(/\+6|OUT/i, { selector: 'div' }).length).toBeGreaterThan(0);
  });

  it('xoxo: the computer answers after you place an X', async () => {
    vi.useRealTimers();
    const Game = (await FILES.xoxo()).default;
    vi.useFakeTimers();
    render(<Game />);
    fireEvent.click(screen.getByRole('button', { name: 'cell 5' }));
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
    run(600);
    expect(screen.getByText(/Your turn/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /cell \d O/ }).length).toBe(1);
  });

  it('racing: the countdown ends and the race clock runs', async () => {
    vi.useRealTimers();
    const Game = (await FILES.racing()).default;
    vi.useFakeTimers();
    render(<Game />);
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    run(9000);
    expect(screen.getByText(/Lap 1\/3/)).toBeInTheDocument();
  });

  it('pool: a shot is taken, the table settles and the computer shoots back', async () => {
    vi.useRealTimers();
    const Game = (await FILES.pool()).default;
    vi.useFakeTimers();
    const { container } = render(<Game />);
    const canvas = container.querySelector('canvas');
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: -200, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    run(20000);
    expect(screen.getByText(/to shoot|shoot again|your shot|Foul|Nice pot|potted|missed|No pot/i)).toBeInTheDocument();
  });

  it('tetris: renders board and all side options (next preview, stats, keypad buttons)', async () => {
    vi.useRealTimers();
    const Game = (await FILES.tetris()).default;
    vi.useFakeTimers();
    const { container } = render(<Game />);
    expect(screen.getByText(/Block Stack/i)).toBeInTheDocument();
    expect(screen.getByText(/Next/i)).toBeInTheDocument();
    expect(screen.getByText(/Level:/i)).toBeInTheDocument();
    expect(screen.getByText(/Lines:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'left' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'rotate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'right' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'down' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'drop' })).toBeInTheDocument();
    const canvases = container.querySelectorAll('canvas');
    expect(canvases.length).toBe(2);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'left' }));
    run(300);
    fireEvent.pointerUp(screen.getByRole('button', { name: 'left' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'rotate' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'drop' }));
  });
});

