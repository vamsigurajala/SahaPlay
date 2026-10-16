import { describe, it, expect } from 'vitest';
import { winner, isFull, computerMove, emptyBoard } from './xoxoLogic';

describe('xoxo rules', () => {
  it('finds rows, columns and diagonals', () => {
    expect(winner(['X', 'X', 'X', null, null, null, null, null, null]).line).toEqual([0, 1, 2]);
    expect(winner(['O', null, null, 'O', null, null, 'O', null, null]).who).toBe('O');
    expect(winner(['X', null, null, null, 'X', null, null, null, 'X']).line).toEqual([0, 4, 8]);
    expect(winner(emptyBoard())).toBe(null);
  });

  it('takes a win and blocks a loss when playing perfectly', () => {
    expect(computerMove(['O', 'O', null, 'X', 'X', null, null, null, null], () => 0.99, 0)).toBe(2);
    expect(computerMove(['X', 'X', null, null, 'O', null, null, null, null], () => 0.99, 0)).toBe(2);
  });

  it('never loses to any sequence of moves when it does not slip', () => {
    const play = (b, turn) => {
      const w = winner(b);
      if (w) return w.who !== 'X';
      if (isFull(b)) return true;
      if (turn === 'O') { const c = b.slice(); c[computerMove(b, () => 0.5, 0)] = 'O'; return play(c, 'X'); }
      return b.every((v, i) => { if (v) return true; const c = b.slice(); c[i] = 'X'; return play(c, 'O'); });
    };
    expect(play(emptyBoard(), 'X')).toBe(true);
  });
});
