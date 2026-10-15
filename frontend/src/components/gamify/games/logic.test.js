import { describe, it, expect } from 'vitest';
import {
  newBoard, collides, merge, clearLines, rotateCells, PIECES,
  slideRow, move2048, addTile, canMove2048,
  makeMines, openCell, minesWon,
  c4Empty, c4Drop, c4Winner, c4Best,
} from './logic';
import { rackBalls, stepPool, shoot, allStopped, cpuChoose, legalTargets, TABLE, groupOf } from './poolPhysics';

// deterministic rng
const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

describe('tetris rules', () => {
  it('detects walls, floor and stacked blocks', () => {
    const b = newBoard();
    const cells = PIECES.O.cells;
    expect(collides(b, cells, 0, 0)).toBe(false);
    expect(collides(b, cells, -2, 0)).toBe(true);
    expect(collides(b, cells, 9, 0)).toBe(true);
    expect(collides(b, cells, 4, 19)).toBe(true);
    const filled = merge(b, cells, 4, 18, '#fff');
    expect(collides(filled, cells, 4, 17)).toBe(true);
  });

  it('clears full lines and keeps the board height', () => {
    let b = newBoard();
    b[19] = Array(10).fill('#fff');
    b[18] = Array(10).fill('#fff');
    b[17][0] = '#fff';
    const r = clearLines(b);
    expect(r.cleared).toBe(2);
    expect(r.board).toHaveLength(20);
    expect(r.board[19][0]).toBe('#fff');
    expect(r.board[19][1]).toBeNull();
  });

  it('rotating four times returns the piece to where it started', () => {
    for (const key of ['I', 'T', 'S', 'Z', 'J', 'L']) {
      let c = PIECES[key].cells;
      for (let i = 0; i < 4; i++) c = rotateCells(c);
      expect(c.map(String).sort()).toEqual(PIECES[key].cells.map(String).sort());
    }
  });
});

describe('2048 rules', () => {
  it('merges equal neighbours once per move', () => {
    expect(slideRow([2, 2, 2, 2])).toEqual({ row: [4, 4, 0, 0], score: 8 });
    expect(slideRow([0, 2, 0, 2])).toEqual({ row: [4, 0, 0, 0], score: 4 });
    expect(slideRow([2, 4, 2, 4]).row).toEqual([2, 4, 2, 4]);
  });

  it('moves in all four directions', () => {
    const b = [[2, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    expect(move2048(b, 'left').board[0]).toEqual([4, 0, 0, 0]);
    expect(move2048(b, 'right').board[0]).toEqual([0, 0, 0, 4]);
    expect(move2048(b, 'down').board[3]).toEqual([2, 0, 0, 2]);
    expect(move2048(b, 'up').moved).toBe(false);
  });

  it('adds a tile into an empty cell and knows when the game is stuck', () => {
    const b = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 0]];
    expect(addTile(b, seeded())[3][3]).not.toBe(0);
    const stuck = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 8]];
    expect(canMove2048(stuck)).toBe(false);
    expect(canMove2048(b)).toBe(true);
  });
});

describe('minesweeper rules', () => {
  it('never puts a mine next to the first click and counts neighbours', () => {
    const cells = makeMines(9, 9, 10, 4, 4, seeded(7));
    expect(cells.flat().filter(c => c.mine)).toHaveLength(10);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) expect(cells[4 + dy][4 + dx].mine).toBe(false);
    const a = cells.flat().find(c => !c.mine);
    expect(a.n).toBeGreaterThanOrEqual(0);
  });

  it('flood-fills blanks, loses on a mine and wins when every safe cell is open', () => {
    const cells = makeMines(5, 5, 1, 0, 0, seeded(3));
    const r = openCell(cells, 0, 0);
    expect(r.hitMine).toBe(false);
    expect(r.cells.flat().filter(c => c.open).length).toBeGreaterThan(1);
    const mine = cells.flat().findIndex(c => c.mine);
    expect(openCell(cells, mine % 5, Math.floor(mine / 5)).hitMine).toBe(true);
    const all = cells.map(row => row.map(c => ({ ...c, open: !c.mine })));
    expect(minesWon(all)).toBe(true);
    expect(minesWon(cells)).toBe(false);
  });
});

describe('connect four', () => {
  it('drops to the bottom and finds four in a row', () => {
    let b = c4Empty();
    for (let i = 0; i < 4; i++) b = c4Drop(b, i, 1).board;
    expect(b[5][0]).toBe(1);
    expect(c4Winner(b).winner).toBe(1);
    expect(c4Drop(Array.from({ length: 6 }, () => Array(7).fill(1)), 0, 2)).toBeNull();
  });

  it('computer takes a winning move and blocks the opponent', () => {
    let b = c4Empty();
    for (let i = 0; i < 3; i++) b = c4Drop(b, i, 2).board; // 2 can win at col 3
    expect(c4Best(b, 2, 4)).toBe(3);
    let b2 = c4Empty();
    for (let i = 0; i < 3; i++) b2 = c4Drop(b2, i, 1).board; // 1 threatens col 3
    expect(c4Best(b2, 2, 4)).toBe(3);
  });
});

describe('pool physics', () => {
  it('racks 15 balls plus the cue with the 8 in the middle of the triangle', () => {
    const balls = rackBalls(seeded(5));
    expect(balls).toHaveLength(16);
    expect(new Set(balls.map(b => b.id)).size).toBe(16);
    const eight = balls.find(b => b.id === 8);
    expect(Math.abs(eight.y - TABLE.h / 2)).toBeLessThan(0.01);
    expect(eight.x).toBeGreaterThan(580);
  });

  it('a hard shot into a pocket pockets the ball and the table comes to rest', () => {
    const balls = [
      { id: 0, x: 200, y: 200, vx: 0, vy: 0, out: false },
      { id: 1, x: 300, y: 60, vx: 0, vy: 0, out: false },
    ];
    balls[1].vy = -400; // rolling straight into the top rail near the side pocket
    balls[1].x = TABLE.w / 2;
    balls[1].y = 60;
    const ev = { pocketed: [], firstHit: null, hits: 0 };
    for (let i = 0; i < 120; i++) stepPool(balls, 1 / 60, ev);
    expect(ev.pocketed).toContain(1);
    expect(balls[1].out).toBe(true);
    for (let i = 0; i < 600 && !allStopped(balls); i++) stepPool(balls, 1 / 60, ev);
    expect(allStopped(balls)).toBe(true);
  });

  it('transfers momentum on a head-on hit and records the first ball the cue touched', () => {
    const balls = [
      { id: 0, x: 200, y: 200, vx: 0, vy: 0, out: false },
      { id: 3, x: 300, y: 200, vx: 0, vy: 0, out: false },
    ];
    shoot(balls, 0, 0.5);
    const ev = { pocketed: [], firstHit: null, hits: 0 };
    for (let i = 0; i < 40; i++) stepPool(balls, 1 / 60, ev);
    expect(ev.firstHit).toBe(3);
    expect(balls[1].x).toBeGreaterThan(300);
    expect(Math.abs(balls[0].vx)).toBeLessThan(Math.abs(balls[1].vx));
  });

  it('keeps balls on the table', () => {
    const balls = [{ id: 0, x: 100, y: 100, vx: 0, vy: 0, out: false }];
    shoot(balls, 0.7, 1);
    for (let i = 0; i < 400; i++) stepPool(balls, 1 / 60);
    const b = balls[0];
    if (!b.out) { expect(b.x).toBeGreaterThanOrEqual(TABLE.r); expect(b.x).toBeLessThanOrEqual(TABLE.w - TABLE.r); }
  });

  it('computer aims at a legal ball it can pot', () => {
    const balls = [
      { id: 0, x: 200, y: 200, vx: 0, vy: 0, out: false },
      { id: 1, x: 400, y: 150, vx: 0, vy: 0, out: false },
      { id: 9, x: 600, y: 300, vx: 0, vy: 0, out: false },
      { id: 8, x: 650, y: 100, vx: 0, vy: 0, out: false },
    ];
    expect(legalTargets(balls, 'solid').map(b => b.id)).toEqual([1]);
    expect(legalTargets(balls, null).map(b => b.id).sort()).toEqual([1, 9]);
    const shot = cpuChoose(balls, 'solid', () => 0.5, 0);
    expect(Math.abs(shot.angle)).toBeLessThan(Math.PI);
    expect(shot.power).toBeGreaterThan(0.2);
    expect(groupOf(8)).toBe('eight');
  });
});
