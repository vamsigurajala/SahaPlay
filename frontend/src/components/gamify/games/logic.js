// Pure game rules (no React) for the board games in the Game Room, so they can be
// unit-tested: Tetris, 2048, Minesweeper and Connect Four (with a computer player).

// ── Tetris ──────────────────────────────────────────────────────────────────
export const TETRIS_W = 10;
export const TETRIS_H = 20;
export const PIECES = {
  I: { color: '#3ee8ff', cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { color: '#ffd24f', cells: [[1, 0], [2, 0], [1, 1], [2, 1]] },
  T: { color: '#b04fff', cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { color: '#6ee37a', cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { color: '#ff5a6e', cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { color: '#4f7bff', cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { color: '#ff9a3c', cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};
export const PIECE_KEYS = Object.keys(PIECES);

export const newBoard = (w = TETRIS_W, h = TETRIS_H) => Array.from({ length: h }, () => Array(w).fill(null));

// Rotates cells 90 degrees clockwise inside their bounding box.
export function rotateCells(cells) {
  const max = Math.max(...cells.map(c => Math.max(c[0], c[1])));
  const size = max < 2 ? 2 : max < 3 ? 3 : 4;
  return cells.map(([x, y]) => [size - 1 - y, x]);
}

export function collides(board, cells, ox, oy) {
  const h = board.length;
  const w = board[0].length;
  return cells.some(([x, y]) => {
    const bx = x + ox;
    const by = y + oy;
    return bx < 0 || bx >= w || by >= h || (by >= 0 && board[by][bx]);
  });
}

export function merge(board, cells, ox, oy, color) {
  const next = board.map(r => r.slice());
  for (const [x, y] of cells) if (y + oy >= 0) next[y + oy][x + ox] = color;
  return next;
}

export function clearLines(board) {
  const w = board[0].length;
  const kept = board.filter(row => row.some(c => !c));
  const cleared = board.length - kept.length;
  const fresh = Array.from({ length: cleared }, () => Array(w).fill(null));
  return { board: [...fresh, ...kept], cleared };
}

export const LINE_SCORES = [0, 100, 300, 500, 800];

// ── 2048 ────────────────────────────────────────────────────────────────────
export function slideRow(row) {
  const nums = row.filter(Boolean);
  const out = [];
  let score = 0;
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] === nums[i + 1]) { out.push(nums[i] * 2); score += nums[i] * 2; i++; } else out.push(nums[i]);
  }
  while (out.length < row.length) out.push(0);
  return { row: out, score };
}

const rotateGrid = (g) => g[0].map((_, i) => g.map(r => r[i]).reverse());

// dir: 'left' | 'right' | 'up' | 'down'
export function move2048(board, dir) {
  let g = board.map(r => r.slice());
  const turns = { left: 0, down: 1, right: 2, up: 3 }[dir];
  for (let i = 0; i < turns; i++) g = rotateGrid(g);
  let score = 0;
  g = g.map((row) => { const r = slideRow(row); score += r.score; return r.row; });
  for (let i = 0; i < (4 - turns) % 4; i++) g = rotateGrid(g);
  const moved = g.some((r, y) => r.some((v, x) => v !== board[y][x]));
  return { board: g, score, moved };
}

export function addTile(board, rng = Math.random) {
  const empty = [];
  board.forEach((r, y) => r.forEach((v, x) => { if (!v) empty.push([x, y]); }));
  if (!empty.length) return board;
  const [x, y] = empty[Math.floor(rng() * empty.length)];
  const next = board.map(r => r.slice());
  next[y][x] = rng() < 0.9 ? 2 : 4;
  return next;
}

export const canMove2048 = (board) => ['left', 'right', 'up', 'down'].some(d => move2048(board, d).moved);

// ── Minesweeper ─────────────────────────────────────────────────────────────
export function makeMines(w, h, mines, safeX, safeY, rng = Math.random) {
  const cells = Array.from({ length: h }, () => Array.from({ length: w }, () => ({ mine: false, open: false, flag: false, n: 0 })));
  let placed = 0;
  while (placed < mines) {
    const x = Math.floor(rng() * w);
    const y = Math.floor(rng() * h);
    if (cells[y][x].mine || (Math.abs(x - safeX) <= 1 && Math.abs(y - safeY) <= 1)) continue;
    cells[y][x].mine = true;
    placed++;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const c = cells[y + dy]?.[x + dx];
      if (c && c.mine && (dx || dy)) n++;
    }
    cells[y][x].n = n;
  }
  return cells;
}

// Opens a cell (flood-filling blanks). Returns { cells, hitMine }.
export function openCell(cells, x, y) {
  const g = cells.map(r => r.map(c => ({ ...c })));
  const start = g[y]?.[x];
  if (!start || start.open || start.flag) return { cells: g, hitMine: false };
  if (start.mine) { start.open = true; return { cells: g, hitMine: true }; }
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    const c = g[cy]?.[cx];
    if (!c || c.open || c.flag || c.mine) continue;
    c.open = true;
    if (c.n === 0) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) stack.push([cx + dx, cy + dy]);
  }
  return { cells: g, hitMine: false };
}

export const minesWon = (cells) => cells.every(r => r.every(c => c.mine || c.open));

// ── Connect Four ────────────────────────────────────────────────────────────
export const C4_W = 7;
export const C4_H = 6;
export const c4Empty = () => Array.from({ length: C4_H }, () => Array(C4_W).fill(0));

export function c4Drop(board, col, player) {
  for (let y = C4_H - 1; y >= 0; y--) {
    if (!board[y][col]) {
      const next = board.map(r => r.slice());
      next[y][col] = player;
      return { board: next, row: y };
    }
  }
  return null;
}

const LINES = [];
for (let y = 0; y < C4_H; y++) for (let x = 0; x < C4_W; x++) {
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const ex = x + dx * 3;
    const ey = y + dy * 3;
    if (ex < 0 || ex >= C4_W || ey < 0 || ey >= C4_H) continue;
    LINES.push([0, 1, 2, 3].map(i => [x + dx * i, y + dy * i]));
  }
}

// Returns { winner: 1|2, line } or null.
export function c4Winner(board) {
  for (const line of LINES) {
    const v = board[line[0][1]][line[0][0]];
    if (v && line.every(([x, y]) => board[y][x] === v)) return { winner: v, line };
  }
  return null;
}

export const c4Full = (board) => board[0].every(Boolean);

function c4Eval(board, me) {
  const opp = me === 1 ? 2 : 1;
  let s = 0;
  for (const line of LINES) {
    let a = 0; let b = 0;
    for (const [x, y] of line) { const v = board[y][x]; if (v === me) a++; else if (v === opp) b++; }
    if (a && b) continue;
    if (a === 3) s += 5; else if (a === 2) s += 2; else if (b === 3) s -= 6; else if (b === 2) s -= 2;
  }
  for (let y = 0; y < C4_H; y++) if (board[y][3] === me) s += 3;
  return s;
}

function c4Search(board, depth, alpha, beta, turn, me) {
  const w = c4Winner(board);
  if (w) return (w.winner === me ? 1 : -1) * (100000 + depth);
  if (c4Full(board)) return 0;
  if (depth === 0) return c4Eval(board, me);
  const order = [3, 2, 4, 1, 5, 0, 6];
  const next = turn === 1 ? 2 : 1;
  if (turn === me) {
    let best = -Infinity;
    for (const c of order) {
      const d = c4Drop(board, c, turn);
      if (!d) continue;
      best = Math.max(best, c4Search(d.board, depth - 1, alpha, beta, next, me));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const c of order) {
    const d = c4Drop(board, c, turn);
    if (!d) continue;
    best = Math.min(best, c4Search(d.board, depth - 1, alpha, beta, next, me));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

// Picks a column for `player` by alpha-beta search.
export function c4Best(board, player, depth = 5) {
  const order = [3, 2, 4, 1, 5, 0, 6];
  const next = player === 1 ? 2 : 1;
  let bestCol = null;
  let bestScore = -Infinity;
  for (const c of order) {
    const d = c4Drop(board, c, player);
    if (!d) continue;
    const s = c4Search(d.board, depth - 1, -Infinity, Infinity, next, player);
    if (s > bestScore) { bestScore = s; bestCol = c; }
  }
  return bestCol;
}
