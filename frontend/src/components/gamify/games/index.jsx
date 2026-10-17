import { Component, lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Bird, Blocks, Bomb, Car, Circle, Disc, Disc3, Gamepad2, Goal, Grab, Grid3x3, Hammer, Hash, Layers, Martini, Rocket, Shield, Snail, Trophy, X, Zap,
} from 'lucide-react';
import { getBest, ui } from './shared';

// Every playable thing in the Game Room. `kind === 'game'` in the prop viewer opens
// one of these by id (see GamifyScene / PropViewers). 'hub' and 'console' open menus.

const fmtTime = (n) => `${Math.floor(n / 600)}:${((n % 600) / 10).toFixed(1).padStart(4, '0')}`;

export const GAMES = {
  pool: { title: '8-Ball Pool', desc: 'Play the computer on a full table', Icon: Circle, color: '#1f9a4a', group: 'table', load: () => import('./PoolGame') },
  pingpong: { title: 'Ping Pong', desc: 'First to 7 against the computer', Icon: Zap, color: '#2a7fd0', group: 'table', load: () => import('./PingPongGame') },
  foosball: { title: 'Foosball', desc: 'Rods, kicks and goals', Icon: Goal, color: '#ff7a3c', group: 'table', load: () => import('./FoosballGame') },
  claw: { title: 'Claw Machine', desc: 'Win a toy in six tries', Icon: Grab, color: '#ff4fd8', group: 'table', load: () => import('./ClawGame') },
  snake: { title: 'Snake', desc: 'Eat, grow, do not crash', Icon: Snail, color: '#2f9e5a', group: 'arcade', load: () => import('./SnakeGame') },
  breakout: { title: 'Brick Breaker', desc: 'Smash every brick', Icon: Blocks, color: '#b04fff', group: 'arcade', load: () => import('./BreakoutGame') },
  tetris: { title: 'Block Stack', desc: 'Clear rows, climb levels', Icon: Layers, color: '#4f7bff', group: 'arcade', load: () => import('./TetrisGame') },
  invaders: { title: 'Star Invaders', desc: 'Defend against the alien waves', Icon: Rocket, color: '#3ee8ff', group: 'arcade', load: () => import('./InvadersGame') },
  flappy: { title: 'Flappy Bird', desc: 'Tap to flap through the pipes', Icon: Bird, color: '#ffb03c', group: 'arcade', load: () => import('./FlappyGame') },
  g2048: { title: '2048', desc: 'Slide and merge to 2048', Icon: Hash, color: '#edc22e', group: 'arcade', load: () => import('./Game2048') },
  whack: { title: 'Whack-a-Mole', desc: '30 seconds, quick fingers', Icon: Hammer, color: '#c0763a', group: 'arcade', load: () => import('./WhackGame') },
  mines: { title: 'Minesweeper', desc: 'Find the mines, fast', Icon: Bomb, color: '#4f7bff', group: 'arcade', load: () => import('./MinesGame'), fmt: (n) => `${n}s` },
  connect4: { title: 'Connect Four', desc: 'Outsmart the computer', Icon: Grid3x3, color: '#e0529f', group: 'arcade', load: () => import('./ConnectFourGame') },
  xoxo: { title: 'XOXO', desc: 'Noughts and crosses against the computer', Icon: X, color: '#ff6fb5', group: 'arcade', load: () => import('./XoxoGame') },
  racing: { title: 'Turbo Racing', desc: '3 laps against 3 drivers', Icon: Car, color: '#ff4f6e', group: 'console', load: () => import('./RacingGame'), fmt: fmtTime },
  penalty: { title: 'Penalty Shootout', desc: 'Shoot, then save, vs the computer', Icon: Shield, color: '#2f9a4a', group: 'console', load: () => import('./PenaltyGame') },
  airhockey: { title: 'Air Hockey', desc: 'Smash the puck past the computer', Icon: Disc, color: '#2a7fd0', group: 'console', load: () => import('./AirHockeyGame') },
  cricket: { title: 'Hand Cricket', desc: 'Show fingers, same number is out', Icon: Trophy, color: '#3fa24a', group: 'outdoor', load: () => import('./CricketGame') },
  dj: { title: 'DJ Booth', desc: 'Pads and a 16-step beat maker', Icon: Disc3, color: '#e0529f', group: 'party', load: () => import('./DjBooth'), noScore: true },
  mixbar: { title: 'Mocktail Bar', desc: 'Stack the layers to match the recipe', Icon: Martini, color: '#ff6fb5', group: 'party', load: () => import('./MixBar') },
};

const LAZY = {};
const lazyFor = (id) => { if (!LAZY[id]) LAZY[id] = lazy(GAMES[id].load); return LAZY[id]; };

// Warm the code for one game (used when the pointer hovers a card).
export const prefetchGame = (id) => { try { GAMES[id]?.load(); } catch { /* offline */ } };

const SECTIONS = {
  hub: [['table', 'Game table'], ['arcade', 'Arcade'], ['console', 'Console'], ['outdoor', 'Outdoor'], ['party', 'Party corner']],
  console: [['console', 'Console games']],
};

class GameBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e) { console.warn('[GAMIFY] game failed:', e?.message); }
  render() { return this.state.failed ? <div style={{ marginTop: 100, fontWeight: 700, textAlign: 'center' }}>This game could not start on this device. Close it and try another.</div> : this.props.children; }
}

function Menu({ id, onPick }) {
  const { t } = useTranslation();
  const isConsole = id === 'console';
  return (
    <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 26, fontWeight: 900 }}><Gamepad2 size={28} color="#8b5cff" />{isConsole ? t('gamify.games.consoleTitle', 'Game Console') : t('gamify.games.hubTitle', 'Game Hub')}</div>
        <div style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>{isConsole ? t('gamify.games.consoleSub', 'Pick up a controller and play against the computer') : t('gamify.games.hubSub', 'Everything in the Game Room, one tap away')}</div>
      </div>
      {SECTIONS[id].map(([group, label]) => (
        <div key={group} style={{ width: '100%' }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.6, margin: '0 4px 8px' }}>{t(`gamify.games.group_${group}`, label)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 270px))', justifyContent: 'center', gap: 10 }}>
            {Object.entries(GAMES).filter(([, g]) => g.group === group).map(([gid, gm]) => {
              const best = getBest(gid);
              return (
                <button key={gid} onClick={() => onPick(gid)} onPointerEnter={() => prefetchGame(gid)} style={{ ...ui.panel, cursor: 'pointer', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center', padding: 12, color: '#fff', transition: 'transform .15s, border-color .15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = gm.color; }} onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; }}>
                  <span style={{ width: 46, height: 46, borderRadius: 14, background: gm.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><gm.Icon size={24} color="#fff" /></span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: 14.5 }}>{t(`gamify.games.${gid}`, gm.title)}</span>
                    <span style={{ display: 'block', fontSize: 12, opacity: 0.7, lineHeight: 1.3 }}>{t(`gamify.games.${gid}Desc`, gm.desc)}</span>
                    {!gm.noScore && best > 0 && <span style={{ display: 'block', fontSize: 11.5, color: '#ffd36b', marginTop: 3, fontWeight: 700 }}>{t('gamify.games.best', 'Best')}: {gm.fmt ? gm.fmt(best) : best}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function GameViewer({ id }) {
  const { t } = useTranslation();
  const menu = id === 'hub' || id === 'console';
  const [picked, setPicked] = useState(null);
  const current = menu ? picked : id;
  const Game = current && GAMES[current] ? lazyFor(current) : null;
  return (
    <div data-no-pull="true" onClick={(e) => e.stopPropagation()} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {menu && picked && (
        <button style={{ ...ui.btn, alignSelf: 'flex-start', marginLeft: 'max(0px, calc(50% - 440px))' }} onClick={() => setPicked(null)}><ArrowLeft size={15} />{id === 'console' ? t('gamify.games.backConsole', 'All console games') : t('gamify.games.backHub', 'All games')}</button>
      )}
      <GameBoundary key={current || 'menu'}>
        {Game ? (
          <Suspense fallback={<div style={{ marginTop: 120, fontWeight: 700 }}>{t('gamify.games.loading', 'Loading game...')}</div>}><Game /></Suspense>
        ) : menu ? <Menu id={id} onPick={setPicked} /> : <div style={{ marginTop: 100, fontWeight: 700 }}>{t('gamify.games.unknown', 'Unknown game')}</div>}
      </GameBoundary>
    </div>
  );
}
