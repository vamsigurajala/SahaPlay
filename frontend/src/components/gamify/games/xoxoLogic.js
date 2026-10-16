// Noughts and crosses (XOXO). The board is 9 cells: null, 'X' (you) or 'O' (computer).

export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

export const emptyBoard = () => Array(9).fill(null);

export function winner(b) {
  for (const line of LINES) {
    const [x, y, z] = line;
    if (b[x] && b[x] === b[y] && b[x] === b[z]) return { who: b[x], line };
  }
  return null;
}

export const isFull = (b) => b.every(Boolean);

// Score from O's point of view: positive when O wins, negative when X wins, 0 for a
// draw (faster wins score higher).
function minimax(b, turn, depth) {
  const w = winner(b);
  if (w) return w.who === 'O' ? 10 - depth : depth - 10;
  if (isFull(b)) return 0;
  let best = turn === 'O' ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = turn;
    const s = minimax(b, turn === 'O' ? 'X' : 'O', depth + 1);
    b[i] = null;
    best = turn === 'O' ? Math.max(best, s) : Math.min(best, s);
  }
  return best;
}

// The computer's move as O. It plays perfectly except now and then (`slip`, default
// 20%) it picks any free cell, so a careful player can win.
export function computerMove(b, rand = Math.random, slip = 0.2) {
  const free = b.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
  if (!free.length) return -1;
  if (rand() < slip) return free[Math.floor(rand() * free.length)];
  let bestScore = -Infinity;
  let moves = [];
  for (const i of free) {
    const c = b.slice();
    c[i] = 'O';
    const s = minimax(c, 'X', 1);
    if (s > bestScore) { bestScore = s; moves = [i]; } else if (s === bestScore) moves.push(i);
  }
  return moves[Math.floor(rand() * moves.length)];
}
