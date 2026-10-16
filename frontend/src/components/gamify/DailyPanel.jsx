import { useEffect } from 'react';
import { Trophy, X, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GAMES } from './games';
import { gameName } from './gamifyText';
import { useDaily, dayBest, requestBoard, gameOfTheDay } from './dailyGame';

// Today's game and how the people in the house are doing in it.
export default function DailyPanel({ me, onPlay, onClose }) {
  const { t } = useTranslation();
  const daily = useDaily();
  const id = gameOfTheDay();
  const game = GAMES[id];
  useEffect(() => { requestBoard(); }, []);
  const board = daily.game === id ? daily.board : [];
  const mine = dayBest(id);
  const fmt = (n) => (game?.fmt ? game.fmt(n) : n);
  return (
    <div className="stay-white" role="dialog" aria-label={t('gamify.daily.title', 'Game of the day')} style={{ position: 'absolute', right: 56, bottom: 12, zIndex: 66, width: 'min(300px, calc(100% - 80px))', maxHeight: 'min(70%, 440px)', overflowY: 'auto', overscrollBehavior: 'contain', padding: 12, borderRadius: 16, background: 'rgba(14,12,30,0.94)', border: '1px solid rgba(251,191,36,0.55)', boxShadow: '0 12px 36px rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 900, fontSize: 13.5 }}><Trophy size={16} color="#fbbf24" />{t('gamify.daily.title', 'Game of the day')}</span>
        <button onClick={onClose} aria-label={t('gamify.close', 'Close')} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
      </div>
      {game && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.06)' }}>
          <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, background: game.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><game.Icon size={21} color="#fff" /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{gameName(id, game.title)}</div>
            <div style={{ fontSize: 11.5, opacity: 0.75 }}>{mine > 0 ? t('gamify.daily.best', { defaultValue: 'Your best today: {{score}}', score: fmt(mine) }) : t('gamify.daily.notPlayed', 'You have not played it today')}</div>
          </div>
          <button onClick={onPlay} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#8b5cff,#4f46e5)', color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}><Play size={13} />{t('gamify.daily.play', 'Play')}</button>
        </div>
      )}
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.65, margin: '12px 4px 6px' }}>{t('gamify.daily.house', 'Today in this house')}</div>
      {board.length === 0 && <div style={{ fontSize: 12.5, opacity: 0.75, padding: '2px 4px' }}>{t('gamify.daily.none', 'No scores yet. Be the first.')}</div>}
      {board.map((r, i) => (
        <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 8px', borderRadius: 9, marginBottom: 3, background: r.name === me ? 'rgba(139,92,255,0.28)' : 'rgba(255,255,255,0.05)' }}>
          <span style={{ width: 20, fontWeight: 900, fontSize: 13, color: i === 0 ? '#fbbf24' : '#fff' }}>{i + 1}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}{r.name === me ? ` (${t('gamify.daily.you', 'you')})` : ''}</span>
          <span style={{ fontWeight: 800, fontSize: 13, color: '#ffd36b' }}>{fmt(r.score)}</span>
        </div>
      ))}
      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>{t('gamify.daily.note', 'A new game is picked every day. Scores are for the people in this house today.')}</div>
    </div>
  );
}
