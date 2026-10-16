import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Backpack, Bandage, BatteryCharging, Camera, Check, Cookie, CupSoda, Droplet, Droplets, Drumstick, Gamepad2, Gem, Glasses, Hamburger, Handbag,
  Headphones, HeartPulse, IceCreamCone, Keyboard, Laptop, Leaf, Minus, Pill, Pizza, Plus, Popcorn, Sandwich, ShieldPlus, Shirt, ShoppingBag,
  Smartphone, Soup, Speaker, Stethoscope, Store, Tablet, Thermometer, Tv, Utensils, Watch, Footprints, Crown, X,
} from 'lucide-react';
import { SHOPS } from '../../data/gamifyShops';

// A shop in the Market. Tap an item to see it, add it to the basket, and "check out"
// (a demo: nothing is sold or charged).

const ICONS = {
  Backpack, Bandage, BatteryCharging, Camera, Cookie, CupSoda, Droplet, Droplets, Drumstick, Gamepad2, Gem, Glasses, Hamburger, Handbag,
  Headphones, HeartPulse, IceCreamCone, Keyboard, Laptop, Leaf, Pill, Pizza, Popcorn, Sandwich, ShieldPlus, Shirt, ShoppingBag,
  Smartphone, Soup, Speaker, Stethoscope, Tablet, Thermometer, Tv, Utensils, Watch, Footprints, Crown,
};

const rupees = (n) => `₹${n.toLocaleString('en-IN')}`;

const CSS = `
@keyframes shop-float { 0%,100% { transform: translateY(0) rotate(-2deg) } 50% { transform: translateY(-5px) rotate(2deg) } }
@keyframes shop-in { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
@keyframes shop-glow { 0%,100% { opacity: .5 } 50% { opacity: 1 } }
.shop-card { transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease; }
.shop-card:hover { transform: translateY(-3px); }
`;

export default function ShopViewer({ id, onClose }) {
  const { t } = useTranslation();
  const shop = SHOPS[id] || SHOPS.fastfood;
  const [cart, setCart] = useState({});
  const [picked, setPicked] = useState(null);
  const [done, setDone] = useState(false);

  const lines = useMemo(() => shop.items.filter(i => cart[i.id]).map(i => ({ ...i, qty: cart[i.id] })), [shop, cart]);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const change = (itemId, d) => { setDone(false); setCart(c => { const q = Math.max(0, (c[itemId] || 0) + d); const n = { ...c }; if (q) n[itemId] = q; else delete n[itemId]; return n; }); };
  const sel = picked ? shop.items.find(i => i.id === picked) : null;
  const SelIcon = sel ? ICONS[sel.icon] : null;
  const verb = shop.verb === 'Order' ? t('gamify.shop.order', 'Order') : t('gamify.shop.add', 'Add');

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 980, color: '#fff', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 90, animation: 'shop-in .25s ease-out' }}>
      <style>{CSS}</style>

      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, padding: '20px 22px', background: `linear-gradient(120deg, ${shop.color}, ${shop.color}99 60%, rgba(12,10,24,0.9))`, border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 62, height: 62, borderRadius: 18, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'shop-float 3.2s ease-in-out infinite', flex: 'none' }}><Store size={32} color="#fff" /></div>
        <div style={{ minWidth: 0, flex: '1 1 220px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.85 }}>{shop.kind}</div>
          <div style={{ fontSize: 'clamp(22px, 5vw, 30px)', fontWeight: 900, lineHeight: 1.1 }}>{shop.name}</div>
          <div style={{ fontSize: 13.5, opacity: 0.92, marginTop: 3 }}>{shop.tagline}</div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 99, background: 'rgba(0,0,0,0.3)', fontWeight: 800, fontSize: 12 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#4ade80', animation: 'shop-glow 1.6s infinite' }} />{t('gamify.shop.open', 'Open now')}
        </div>
      </div>

      {sel && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', padding: 16, borderRadius: 20, background: 'rgba(255,255,255,0.07)', border: `1px solid ${sel.tint}`, boxShadow: `0 0 30px ${sel.tint}40`, animation: 'shop-in .2s ease-out' }}>
          <div style={{ width: 96, height: 96, borderRadius: 24, background: `linear-gradient(145deg, ${sel.tint}, ${sel.tint}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'shop-float 2.6s ease-in-out infinite', flex: 'none' }}><SelIcon size={52} color="#fff" strokeWidth={1.7} /></div>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{sel.name}</div>
            <div style={{ opacity: 0.8, fontSize: 13.5, margin: '3px 0 8px' }}>{sel.desc}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#ffe27a' }}>{rupees(sel.price)}</div>
          </div>
          <button onClick={() => change(sel.id, 1)} style={{ border: 'none', borderRadius: 14, padding: '12px 22px', fontWeight: 900, fontSize: 14, cursor: 'pointer', background: shop.color, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={16} />{verb}</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 156px), 1fr))', gap: 12 }}>
        {shop.items.map((it, n) => {
          const Icon = ICONS[it.icon] || ShoppingBag;
          const q = cart[it.id] || 0;
          return (
            <div key={it.id} className="shop-card" style={{ borderRadius: 18, padding: 12, background: 'rgba(255,255,255,0.06)', border: `1px solid ${picked === it.id ? it.tint : 'rgba(255,255,255,0.14)'}`, display: 'flex', flexDirection: 'column', gap: 8, animation: `shop-in .3s ease-out ${n * 0.03}s both` }}>
              <button onClick={() => setPicked(it.id)} aria-label={it.name} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', color: '#fff', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ height: 84, borderRadius: 14, background: `linear-gradient(145deg, ${it.tint}, ${it.tint}77)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ display: 'inline-flex', animation: `shop-float ${2.4 + (n % 4) * 0.4}s ease-in-out infinite` }}><Icon size={40} color="#fff" strokeWidth={1.7} /></span>
                </span>
                <span style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>{it.name}</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 'auto' }}>
                <span style={{ fontWeight: 900, color: '#ffe27a' }}>{rupees(it.price)}</span>
                {q ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.35)', borderRadius: 99, padding: 2 }}>
                    <button onClick={() => change(it.id, -1)} aria-label={`remove ${it.name}`} style={qtyBtn}><Minus size={14} /></button>
                    <span style={{ minWidth: 16, textAlign: 'center', fontWeight: 900, fontSize: 13 }}>{q}</span>
                    <button onClick={() => change(it.id, 1)} aria-label={`add another ${it.name}`} style={qtyBtn}><Plus size={14} /></button>
                  </span>
                ) : (
                  <button onClick={() => change(it.id, 1)} aria-label={`${verb} ${it.name}`} style={{ border: 'none', borderRadius: 99, padding: '7px 14px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', background: shop.color, color: '#fff' }}>{verb}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 4, padding: '10px 14px calc(10px + env(safe-area-inset-bottom))', background: 'rgba(8,6,20,0.92)', borderTop: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 980, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          {done ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#4ade80' }}><Check size={18} />{t('gamify.shop.thanks', 'Thank you! This is a demo shop, so nothing was charged.')}</span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontWeight: 800 }}>
              <ShoppingBag size={18} />{count} {count === 1 ? t('gamify.shop.item', 'item') : t('gamify.shop.items', 'items')}
              <span style={{ color: '#ffe27a', fontSize: 17 }}>{rupees(total)}</span>
            </span>
          )}
          <span style={{ display: 'inline-flex', gap: 8 }}>
            {count > 0 && <button onClick={() => { setCart({}); setDone(false); }} style={{ ...ghostBtn }}>{t('gamify.shop.clear', 'Clear')}</button>}
            <button disabled={!count} onClick={() => { setCart({}); setDone(true); }} style={{ border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 900, fontSize: 14, cursor: count ? 'pointer' : 'default', opacity: count ? 1 : 0.45, background: shop.color, color: '#fff' }}>{t('gamify.shop.checkout', 'Checkout')}</button>
            {onClose && <button onClick={onClose} style={ghostBtn} aria-label="Close shop"><X size={14} style={{ verticalAlign: -2 }} /> {t('gamify.shop.leave', 'Leave shop')}</button>}
          </span>
        </div>
      </div>
    </div>
  );
}

const qtyBtn = { width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 };
const ghostBtn = { border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, padding: '10px 16px', fontWeight: 800, fontSize: 13, cursor: 'pointer', background: 'transparent', color: '#fff' };
