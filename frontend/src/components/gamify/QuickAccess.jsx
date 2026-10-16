import { Star, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFavs, favLabel } from './favorites';
import { GAMES } from './games';
import { gameOfTheDay } from './dailyGame';

// A strip of quick buttons at the top-left: today's game, then anything you pinned with
// the star inside a window (a game, the radio, a shop...).
export default function QuickAccess({ onOpen, onDaily, dailyOpen }) {
  const { t } = useTranslation();
  const favs = useFavs();
  const game = GAMES[gameOfTheDay()];
  const chip = { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(12,10,24,0.78)', color: '#fff', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer', backdropFilter: 'blur(6px)', flex: 'none', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' };
  return (
    <div className="stay-white" style={{ position: 'absolute', top: 54, left: 8, width: 132, maxHeight: 'calc(100% - 290px)', zIndex: 58, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', pointerEvents: 'none' }}>
      <button onClick={onDaily} aria-pressed={dailyOpen} title={t('gamify.daily.tip', "Game of the day and today's scores")} style={{ ...chip, pointerEvents: 'auto', borderColor: 'rgba(251,191,36,0.7)', background: dailyOpen ? 'rgba(251,191,36,0.25)' : chip.background }}>
        <Trophy size={13} color="#fbbf24" style={{ flex: 'none' }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{game ? t('gamify.daily.today', { defaultValue: 'Today: {{game}}', game: game.title }) : t('gamify.daily.title', 'Game of the day')}</span>
      </button>
      {favs.map(f => (
        <button key={`${f.kind}:${f.arg || ''}`} onClick={() => onOpen(f.kind, f.arg)} title={t('gamify.daily.open', { defaultValue: 'Open {{name}}', name: favLabel(f) })} style={{ ...chip, pointerEvents: 'auto' }}>
          <Star size={12} color="#fbbf24" fill="#fbbf24" style={{ flex: 'none' }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{favLabel(f)}</span>
        </button>
      ))}
    </div>
  );
}
