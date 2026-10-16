import { useSyncExternalStore } from 'react';

// "Game of the day": one arcade game is picked for everyone each day (UTC), and the people
// in the room compete for the best score of the day. The list and the day maths are
// copied in backend/server.js, which a test keeps in step.

export const DAILY_GAMES = ['snake', 'breakout', 'tetris', 'invaders', 'flappy', 'g2048', 'whack'];

export const dayNumber = (d = new Date()) => Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000);
export const dateKey = (d = new Date()) => new Date(dayNumber(d) * 86400000).toISOString().slice(0, 10);
export const gameOfTheDay = (d = new Date()) => DAILY_GAMES[dayNumber(d) % DAILY_GAMES.length];

const bestKey = (id) => `sp_gamify_daily_${dateKey()}_${id}`;
export function dayBest(id = gameOfTheDay()) {
  try { return Number(localStorage.getItem(bestKey(id))) || 0; } catch { return 0; }
}

// ---- live state: the room's board for today, and how to send a score to the room
let state = { date: dateKey(), game: gameOfTheDay(), board: [], rev: 0 };
let sender = null;
const listeners = new Set();
const emit = () => listeners.forEach(l => l());

export const getDaily = () => state;
export const useDaily = () => useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, getDaily, getDaily);
export function setDailyBoard(payload) {
  if (!payload || typeof payload.game !== 'string' || !Array.isArray(payload.board)) return;
  const board = payload.board
    .filter(r => r && typeof r.name === 'string' && Number.isFinite(r.score))
    .slice(0, 10)
    .map(r => ({ name: r.name.slice(0, 40), score: r.score }));
  state = { date: String(payload.date || state.date), game: payload.game, board, rev: state.rev + 1 };
  emit();
}
// Room.jsx registers how scores and board requests go out over the socket.
export function registerDailySender(fn) { sender = fn; }

// Games call this whenever a run ends (see useBest in games/shared.jsx).
export function reportScore(id, score) {
  if (id !== gameOfTheDay() || !Number.isFinite(score) || score <= 0) return;
  if (score <= dayBest(id)) return;
  try { localStorage.setItem(bestKey(id), String(Math.floor(score))); } catch { /* ignore */ }
  if (sender) sender({ type: 'score', game: id, score: Math.floor(score) });
  state = { ...state, rev: state.rev + 1 }; // so panels showing your best refresh
  emit();
}
export const requestBoard = () => { if (sender) sender({ type: 'board' }); };
