import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Martini, Star, Trash2 } from 'lucide-react';
import { GameFrame, ui, useBest } from './shared';

// Mocktail bar: copy the recipe card by stacking three ingredients bottom to top.

const ING = {
  grenadine: { name: 'Grenadine', c: '#d11a3a' },
  orange: { name: 'Orange juice', c: '#ff9a2a' },
  soda: { name: 'Soda water', c: '#e4f4ff' },
  blue: { name: 'Blue syrup', c: '#1e90ff' },
  lemonade: { name: 'Lemonade', c: '#fff08a' },
  lime: { name: 'Lime juice', c: '#9be05a' },
  mint: { name: 'Mint syrup', c: '#2fbf71' },
  mango: { name: 'Mango pulp', c: '#ffb81c' },
  pineapple: { name: 'Pineapple juice', c: '#ffe066' },
  coconut: { name: 'Coconut water', c: '#f4f1e8' },
  cranberry: { name: 'Cranberry juice', c: '#a3153a' },
};
const RECIPES = [
  { name: 'Sunrise', layers: ['grenadine', 'orange', 'soda'] },
  { name: 'Blue Lagoon', layers: ['blue', 'lemonade', 'soda'] },
  { name: 'Mojito Mint', layers: ['lime', 'mint', 'soda'] },
  { name: 'Tropical Sunny', layers: ['mango', 'pineapple', 'coconut'] },
  { name: 'Berry Fizz', layers: ['cranberry', 'lime', 'soda'] },
  { name: 'Sunset Cooler', layers: ['blue', 'orange', 'grenadine'] },
  { name: 'Green Meadow', layers: ['mint', 'lemonade', 'coconut'] },
];

function Glass({ layers, size = 120, label }) {
  const h = size * 1.45;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: size, height: h, margin: '0 auto', clipPath: 'polygon(6% 0, 94% 0, 80% 100%, 20% 100%)', background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.4)' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column-reverse', height: '88%' }}>
          {layers.map((id, i) => <div key={i} style={{ flex: 1, background: ING[id].c, opacity: 0.95, borderTop: i ? '1px solid rgba(255,255,255,0.4)' : 'none', transition: 'all .2s' }} />)}
          {Array.from({ length: 3 - layers.length }).map((_, i) => <div key={`e${i}`} style={{ flex: 1 }} />)}
        </div>
      </div>
      {label && <div style={{ fontSize: 12, fontWeight: 800, marginTop: 6 }}>{label}</div>}
    </div>
  );
}

export default function MixBar() {
  const { t } = useTranslation();
  const [best, submitBest] = useBest('mixbar');
  const [round, setRound] = useState(0);
  const [mix, setMix] = useState([]);
  const [score, setScore] = useState(0);
  const [msg, setMsg] = useState('');
  const recipe = RECIPES[round % RECIPES.length];

  const serve = () => {
    if (mix.length < 3) { setMsg(t('gamify.games.mixNeed', 'Fill the glass with three ingredients first')); return; }
    const right = mix.filter((id, i) => id === recipe.layers[i]).length;
    const stars = right === 3 ? 3 : right === 2 ? 2 : right === 1 ? 1 : 0;
    const ns = score + stars;
    setScore(ns); submitBest(ns);
    setMsg(stars === 3 ? t('gamify.games.mixPerfect', 'Perfect - the customer loves it!') : stars ? `${t('gamify.games.mixPartly', 'Not bad')} - ${right}/3 ${t('gamify.games.mixRight', 'layers right')}` : t('gamify.games.mixBad', 'That one is going back to the kitchen'));
    setMix([]); setRound(r => r + 1);
  };
  const reset = () => { setRound(0); setMix([]); setScore(0); setMsg(''); };

  return (
    <GameFrame title={t('gamify.games.mixbar', 'Mocktail Bar')} Icon={Martini} accent="#ff6fb5" score={score} scoreLabel={t('gamify.games.stars', 'Stars')} best={best} onRestart={reset} maxWidth={620}
      hint={t('gamify.games.mixHint', 'Copy the recipe card: tap ingredients in order from the bottom layer to the top, then serve. Each correct layer earns a star.')}>
      <div style={{ display: 'flex', gap: 28, justifyContent: 'center', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div><div style={{ textAlign: 'center', fontWeight: 900, marginBottom: 8 }}>{recipe.name}</div><Glass layers={recipe.layers} size={96} label={recipe.layers.map(id => ING[id].name).join(' / ')} /></div>
        <div><div style={{ textAlign: 'center', fontWeight: 900, marginBottom: 8 }}>{t('gamify.games.yourDrink', 'Your drink')}</div><Glass layers={mix} size={96} label={mix.length ? mix.map(id => ING[id].name).join(' / ') : ' '} /></div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 560 }}>
        {Object.entries(ING).map(([id, ing]) => (
          <button key={id} onClick={() => mix.length < 3 && setMix(m => [...m, id])} style={{ ...ui.btn, padding: '8px 12px' }}>
            <i style={{ width: 14, height: 14, borderRadius: 4, background: ing.c, display: 'inline-block' }} />{ing.name}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={ui.btn} onClick={() => setMix([])}><Trash2 size={15} />{t('gamify.games.pourOut', 'Pour out')}</button>
        <button style={{ ...ui.btn, ...ui.btnOn }} onClick={serve}><Star size={15} />{t('gamify.games.serve', 'Serve')}</button>
      </div>
      <div style={{ ...ui.panel, fontWeight: 700, fontSize: 13.5, minHeight: 20, textAlign: 'center' }}>{msg}</div>
    </GameFrame>
  );
}
