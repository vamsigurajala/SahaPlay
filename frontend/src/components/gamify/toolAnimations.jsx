import React from 'react';

// Looping animated illustrations for the garage workshop tools. Pure SVG + CSS
// keyframes (no images), drawn with the viewer's accent colour `c` and ink colour
// `k` so they read well on both the dark and the light card. `fast` speeds the
// motion up while a tool is being "used".

const VB = '0 0 320 180';

const CSS = `
@keyframes ga-spin { to { transform: rotate(360deg); } }
@keyframes ga-spinr { to { transform: rotate(-360deg); } }
@keyframes ga-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
@keyframes ga-lift { 0%,15% { transform: translateY(0); } 55%,85% { transform: translateY(-26px); } 100% { transform: translateY(0); } }
@keyframes ga-pump { 0%,100% { transform: translateY(0); } 50% { transform: translateY(34px); } }
@keyframes ga-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
@keyframes ga-dash { to { stroke-dashoffset: -40; } }
@keyframes ga-rise { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-60px); opacity: 0; } }
@keyframes ga-fall { 0% { transform: translateY(-6px); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(40px); opacity: 0; } }
@keyframes ga-pulse { 0%,100% { opacity: .25; } 50% { opacity: 1; } }
@keyframes ga-orbit { to { transform: rotate(360deg); } }
@keyframes ga-sweep { 0% { transform: translateX(-120px); } 100% { transform: translateX(260px); } }
@keyframes ga-fill { 0% { transform: scaleY(0.15); } 100% { transform: scaleY(1); } }
@keyframes ga-needle { 0%,100% { transform: rotate(-50deg); } 50% { transform: rotate(55deg); } }
@keyframes ga-rock { 0%,100% { transform: rotate(-26deg); } 50% { transform: rotate(18deg); } }
@keyframes ga-press { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-18deg); } }
@keyframes ga-flash { 0%,40%,100% { opacity: 0; } 45%,55% { opacity: 1; } 60% { opacity: .2; } 65% { opacity: .9; } }
@keyframes ga-wave { to { transform: translateX(-60px); } }
@keyframes ga-slide { 0%,100% { transform: translateX(0); } 50% { transform: translateX(26px); } }
@keyframes ga-clamp { 0%,100% { transform: translateX(0); } 50% { transform: translateX(16px); } }
`;

const gearPath = (cx, cy, r, teeth) => {
  const pts = [];
  const step = (Math.PI * 2) / (teeth * 2);
  for (let i = 0; i < teeth * 2; i++) {
    const rr = i % 2 ? r * 0.82 : r;
    const a0 = i * step;
    const a1 = a0 + step * 0.5;
    pts.push(`${(cx + Math.cos(a0) * rr).toFixed(1)},${(cy + Math.sin(a0) * rr).toFixed(1)}`);
    pts.push(`${(cx + Math.cos(a1) * rr).toFixed(1)},${(cy + Math.sin(a1) * rr).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
};

const sp = (d, extra = '') => `${d} linear infinite ${extra}`;

function Gear({ cx, cy, r, teeth, dur = 4, rev = false, c, k, hub = true }) {
  return (
    <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: sp(`${rev ? 'ga-spinr' : 'ga-spin'} ${dur}s`) }}>
      <path d={gearPath(cx, cy, r, teeth)} fill={c} fillOpacity="0.9" stroke={k} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={cx} cy={cy} r={r * 0.5} fill="none" stroke={k} strokeOpacity="0.5" strokeWidth="1.5" />
      {hub && <circle cx={cx} cy={cy} r={r * 0.2} fill={k} />}
      <line x1={cx} y1={cy - r * 0.5} x2={cx} y2={cy + r * 0.5} stroke={k} strokeOpacity="0.45" strokeWidth="2" />
    </g>
  );
}

function Wheel({ cx, cy, r, c, k, dur = 2, spin = true, spokes = 8, tire = 7 }) {
  return (
    <g style={spin ? { transformOrigin: `${cx}px ${cy}px`, animation: sp(`ga-spin ${dur}s`) } : undefined}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={k} strokeWidth={tire} />
      <circle cx={cx} cy={cy} r={r - tire / 2} fill="none" stroke={c} strokeWidth="2" />
      {Array.from({ length: spokes }).map((_, i) => {
        const a = (i / spokes) * Math.PI * 2;
        return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * (r - tire / 2)} y2={cy + Math.sin(a) * (r - tire / 2)} stroke={c} strokeWidth="2" strokeOpacity="0.85" />;
      })}
      <circle cx={cx} cy={cy} r="5" fill={c} />
    </g>
  );
}

function CarSide({ x = 0, y = 0, c, k, wheels = true }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-100 0 L-98 -16 Q-80 -22 -52 -26 L-26 -44 Q-8 -52 18 -50 L52 -46 Q86 -34 100 -18 L102 0 Z" fill={c} stroke={k} strokeWidth="2" strokeLinejoin="round" />
      <path d="M-22 -28 L-4 -42 Q8 -46 24 -45 L40 -42 L34 -28 Z" fill={k} fillOpacity="0.28" />
      {wheels && [-58, 60].map(wx => <g key={wx}><circle cx={wx} cy={2} r="17" fill={k} /><circle cx={wx} cy={2} r="8" fill={c} fillOpacity="0.8" /></g>)}
    </g>
  );
}

const Spark = ({ x, y, c, d = 0 }) => <circle cx={x} cy={y} r="3" fill={c} style={{ animation: `ga-pulse 0.5s ease-in-out ${d}s infinite` }} />;

const SCENES = {
  spin_impact: ({ c, k, s }) => (
    <g>
      <g style={{ transformOrigin: '210px 90px', animation: sp(`ga-spin ${0.7 / s}s`) }}>
        <polygon points="210,60 236,75 236,105 210,120 184,105 184,75" fill={c} stroke={k} strokeWidth="2" />
        <circle cx="210" cy="90" r="11" fill={k} fillOpacity="0.4" />
      </g>
      <g style={{ animation: sp(`ga-shake ${0.12 / s}s`) }}>
        <rect x="40" y="76" width="110" height="28" rx="10" fill={k} fillOpacity="0.85" />
        <rect x="150" y="82" width="34" height="16" rx="4" fill={k} />
        <rect x="52" y="66" width="46" height="12" rx="5" fill={c} />
        <rect x="60" y="104" width="14" height="40" rx="5" fill={k} fillOpacity="0.85" />
      </g>
      {[0, 1, 2, 3].map(i => <line key={i} x1={246 + i * 4} y1={70 + i * 14} x2={268 + i * 6} y2={64 + i * 18} stroke={c} strokeWidth="3" strokeLinecap="round" style={{ animation: `ga-pulse ${0.35 / s}s ease-in-out ${i * 0.08}s infinite` }} />)}
    </g>
  ),
  jack_lift: ({ c, k, s }) => (
    <g>
      <line x1="30" y1="150" x2="290" y2="150" stroke={k} strokeOpacity="0.4" strokeWidth="3" />
      <g style={{ animation: sp(`ga-lift ${4 / s}s`) }}><CarSide x={170} y={112} c={c} k={k} /></g>
      <g>
        <rect x="132" y="138" width="76" height="12" rx="4" fill={k} />
        <rect x="160" y="124" width="20" height="14" fill={k} fillOpacity="0.7" />
        <g style={{ transformOrigin: '210px 140px', animation: sp(`ga-press ${1.3 / s}s`) }}><line x1="210" y1="140" x2="282" y2="116" stroke={c} strokeWidth="6" strokeLinecap="round" /></g>
      </g>
    </g>
  ),
  oil_pour: ({ c, k, s }) => (
    <g>
      <g style={{ transformOrigin: '110px 60px', animation: sp(`ga-rock ${3 / s}s`) }}>
        <rect x="76" y="30" width="62" height="78" rx="12" fill={c} stroke={k} strokeWidth="2" />
        <rect x="92" y="14" width="30" height="18" rx="4" fill={k} />
        <rect x="84" y="56" width="46" height="26" rx="4" fill={k} fillOpacity="0.2" />
      </g>
      <path d="M150 104 Q168 122 172 150" fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" strokeDasharray="8 8" style={{ animation: sp(`ga-dash ${0.6 / s}s`) }} />
      <path d="M150 140 L196 140 L190 150 L156 150Z" fill={k} fillOpacity="0.8" />
      <rect x="200" y="96" width="76" height="62" rx="8" fill="none" stroke={k} strokeWidth="2.5" />
      <g style={{ transformOrigin: '238px 158px', animation: sp(`ga-fill ${3 / s}s`) }}><rect x="203" y="98" width="70" height="58" rx="5" fill={c} fillOpacity="0.75" /></g>
    </g>
  ),
  paint_polish: ({ c, k, s }) => (
    <g>
      <path d="M30 140 Q40 70 120 60 L280 60 Q300 100 296 140Z" fill={c} stroke={k} strokeWidth="2" />
      <g style={{ animation: sp(`ga-sweep ${2.6 / s}s`) }}><rect x="40" y="56" width="26" height="90" fill="#fff" fillOpacity="0.45" transform="skewX(-20)" /></g>
      <g style={{ transformOrigin: '170px 100px', animation: sp(`ga-orbit ${1.2 / s}s`) }}>
        <g transform="translate(170 100)"><g transform="translate(18 0)">
          <circle r="26" fill={k} fillOpacity="0.88" /><circle r="17" fill="none" stroke={c} strokeWidth="3" /><circle r="4" fill={c} />
        </g></g>
      </g>
      {[0, 1, 2].map(i => <Spark key={i} x={120 + i * 55} y={50 + (i % 2) * 8} c="#fff" d={i * 0.3} />)}
    </g>
  ),
  ecu_scan: ({ c, k, s }) => (
    <g>
      <rect x="50" y="26" width="220" height="128" rx="10" fill={k} fillOpacity="0.08" stroke={k} strokeWidth="2" />
      <clipPath id="ga-ecu"><rect x="58" y="60" width="204" height="60" /></clipPath>
      <g clipPath="url(#ga-ecu)"><g style={{ animation: sp(`ga-wave ${1.4 / s}s`) }}>
        <path d="M58 90 q8 -40 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0" fill="none" stroke={c} strokeWidth="2.5" />
      </g></g>
      {[0, 1, 2, 3].map(i => <rect key={i} x={64 + i * 50} y="130" width="38" height="14" rx="3" fill={c} fillOpacity="0.8" style={{ animation: `ga-pulse ${1.2 / s}s ease-in-out ${i * 0.25}s infinite` }} />)}
      <text x="64" y="50" fontSize="12" fontWeight="800" fill={k}>LIVE PIDs  120 Hz</text>
      <circle cx="252" cy="44" r="5" fill="#22c55e" style={{ animation: 'ga-pulse 1s infinite' }} />
    </g>
  ),
  brake_bleed: ({ c, k, s }) => (
    <g>
      <circle cx="120" cy="92" r="52" fill="none" stroke={k} strokeWidth="9" strokeOpacity="0.85" />
      <rect x="84" y="50" width="76" height="42" rx="10" fill={c} stroke={k} strokeWidth="2" />
      <circle cx="122" cy="108" r="6" fill={k} />
      <path d="M160 80 Q210 80 214 120 L214 150" fill="none" stroke={k} strokeWidth="6" strokeOpacity="0.7" />
      <rect x="196" y="140" width="36" height="26" rx="5" fill="none" stroke={k} strokeWidth="2.5" />
      {[0, 1, 2, 3, 4].map(i => <circle key={i} cx="196" cy="120" r={3 + (i % 2)} fill="#fff" stroke={k} strokeOpacity="0.5" style={{ animation: `ga-rise ${1.8 / s}s ease-in ${i * 0.35}s infinite`, transform: `translate(${i * 3}px, ${i * 4}px)` }} />)}
      <rect x="200" y="152" width="28" height="12" rx="3" fill={c} fillOpacity="0.75" />
    </g>
  ),
  paddock_lift: ({ c, k, s }) => (
    <g>
      <line x1="20" y1="150" x2="300" y2="150" stroke={k} strokeOpacity="0.4" strokeWidth="3" />
      <g style={{ animation: sp(`ga-lift ${4 / s}s`) }}>
        <Wheel cx={90} cy={116} r={30} c={c} k={k} dur={6 / s} />
        <Wheel cx={230} cy={116} r={30} c={c} k={k} dur={6 / s} />
        <path d="M90 116 L130 82 L196 82 L230 116 M130 82 L150 54 L186 54" fill="none" stroke={k} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
        <rect x="132" y="60" width="52" height="20" rx="8" fill={c} />
      </g>
      <path d="M96 150 L96 128 L120 128" fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" />
      <circle cx="96" cy="128" r="6" fill={c} />
    </g>
  ),
  chain_spray: ({ c, k, s }) => (
    <g>
      <Gear cx={90} cy={96} r={36} teeth={14} dur={5 / s} c={c} k={k} />
      <Gear cx={236} cy={96} r={18} teeth={9} dur={2.5 / s} c={c} k={k} />
      <path d="M90 60 L236 78 M90 132 L236 114" fill="none" stroke={k} strokeWidth="6" strokeDasharray="7 5" style={{ animation: sp(`ga-dash ${0.8 / s}s`) }} />
      <rect x="140" y="14" width="32" height="40" rx="6" fill={k} fillOpacity="0.85" />
      <rect x="150" y="6" width="12" height="10" rx="2" fill={c} />
      {[0, 1, 2, 3, 4].map(i => <circle key={i} cx={156 + (i - 2) * 6} cy="58" r="2.5" fill={c} style={{ animation: `ga-fall ${0.9 / s}s ease-in ${i * 0.15}s infinite` }} />)}
    </g>
  ),
  tire_gauge: ({ c, k, s }) => (
    <g>
      <circle cx="130" cy="90" r="64" fill="none" stroke={k} strokeWidth="5" />
      <circle cx="130" cy="90" r="56" fill={k} fillOpacity="0.07" />
      {Array.from({ length: 11 }).map((_, i) => { const a = (-210 + i * 24) * Math.PI / 180; return <line key={i} x1={130 + Math.cos(a) * 48} y1={90 + Math.sin(a) * 48} x2={130 + Math.cos(a) * 55} y2={90 + Math.sin(a) * 55} stroke={k} strokeWidth="2" />; })}
      <g style={{ transformOrigin: '130px 90px', animation: sp(`ga-needle ${2.4 / s}s`, 'alternate') }}><line x1="130" y1="90" x2="130" y2="44" stroke={c} strokeWidth="4" strokeLinecap="round" /></g>
      <circle cx="130" cy="90" r="6" fill={k} />
      <text x="130" y="122" fontSize="12" fontWeight="900" fill={k} textAnchor="middle">PSI</text>
      <rect x="194" y="82" width="70" height="16" rx="6" fill={k} fillOpacity="0.85" />
      <rect x="258" y="76" width="22" height="28" rx="4" fill={c} />
    </g>
  ),
  spark_fire: ({ c, k, s }) => (
    <g>
      <rect x="140" y="20" width="40" height="30" rx="5" fill={k} fillOpacity="0.85" />
      <rect x="148" y="50" width="24" height="52" rx="3" fill="#e2e8f0" stroke={k} strokeWidth="2" />
      <path d="M148 102 L172 102 L168 118 L152 118Z" fill={k} />
      <line x1="160" y1="118" x2="160" y2="136" stroke={k} strokeWidth="3" />
      <path d="M144 140 L160 136" stroke={k} strokeWidth="3" />
      <path d="M160 122 L152 132 L166 130 L156 144" fill="none" stroke={c} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: sp(`ga-flash ${0.8 / s}s`) }} />
      <circle cx="160" cy="136" r="26" fill={c} fillOpacity="0.28" style={{ animation: sp(`ga-flash ${0.8 / s}s`) }} />
      <text x="214" y="96" fontSize="13" fontWeight="900" fill={k}>25 kV</text>
    </g>
  ),
  lever_click: ({ c, k, s }) => (
    <g>
      <rect x="40" y="76" width="70" height="30" rx="14" fill={k} fillOpacity="0.85" />
      <g style={{ transformOrigin: '110px 92px', animation: sp(`ga-rock ${2.2 / s}s`, 'alternate') }}>
        <path d="M110 84 Q190 70 250 110 L244 122 Q184 90 110 100Z" fill={c} stroke={k} strokeWidth="2" strokeLinejoin="round" />
      </g>
      {[0, 1, 2, 3, 4, 5].map(i => <circle key={i} cx={150 + i * 14} cy="150" r="5" fill={c} style={{ animation: `ga-pulse ${2.2 / s}s ease-in-out ${i * 0.2}s infinite` }} />)}
      <text x="150" y="30" fontSize="12" fontWeight="900" fill={k}>6-WAY REACH</text>
    </g>
  ),
  wheel_balance: ({ c, k, s }) => (
    <g>
      <line x1="40" y1="90" x2="280" y2="90" stroke={k} strokeWidth="5" />
      <Wheel cx={160} cy={90} r={62} c={c} k={k} dur={1.6 / s} spokes={10} tire={12} />
      <g style={{ transformOrigin: '160px 90px', animation: sp(`ga-spin ${1.6 / s}s`) }}><rect x="152" y="22" width="16" height="9" rx="2" fill="#f59e0b" /></g>
      <path d="M130 156 L160 138 L190 156" fill="none" stroke={k} strokeWidth="5" strokeLinecap="round" />
    </g>
  ),
  pump_cycle: ({ c, k, s }) => (
    <g>
      <rect x="120" y="150" width="80" height="10" rx="4" fill={k} />
      <rect x="152" y="60" width="16" height="92" rx="4" fill={c} fillOpacity="0.85" stroke={k} strokeWidth="2" />
      <g style={{ animation: sp(`ga-pump ${1.1 / s}s`, 'ease-in-out') }}>
        <line x1="160" y1="30" x2="160" y2="96" stroke={k} strokeWidth="6" strokeLinecap="round" />
        <rect x="132" y="22" width="56" height="12" rx="6" fill={k} />
      </g>
      <circle cx="226" cy="60" r="28" fill="none" stroke={k} strokeWidth="4" />
      <g style={{ transformOrigin: '226px 60px', animation: sp(`ga-needle ${2.2 / s}s`, 'alternate') }}><line x1="226" y1="60" x2="226" y2="38" stroke={c} strokeWidth="3.5" strokeLinecap="round" /></g>
      <path d="M168 120 Q214 124 226 90" fill="none" stroke={k} strokeWidth="5" strokeOpacity="0.7" />
    </g>
  ),
  hex_tighten: ({ c, k, s }) => (
    <g>
      <g style={{ transformOrigin: '210px 90px', animation: sp(`ga-spin ${1.6 / s}s`) }}>
        <polygon points="210,62 234,76 234,104 210,118 186,104 186,76" fill={k} fillOpacity="0.8" />
        <polygon points="210,80 218,85 218,95 210,100 202,95 202,85" fill={c} />
      </g>
      <g style={{ transformOrigin: '210px 90px', animation: sp(`ga-spin ${1.6 / s}s`) }}>
        <path d="M210 90 L120 90 L120 150" fill="none" stroke={c} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  ),
  chain_breaker: ({ c, k, s }) => (
    <g>
      <path d="M30 120 L290 120" stroke={k} strokeWidth="9" strokeDasharray="14 6" strokeOpacity="0.85" style={{ animation: sp(`ga-dash ${2 / s}s`) }} />
      <rect x="130" y="74" width="60" height="28" rx="6" fill={k} fillOpacity="0.8" />
      <g style={{ animation: sp(`ga-pump ${1.4 / s}s`, 'ease-in-out') }}><rect x="156" y="36" width="8" height="48" rx="3" fill={c} /><rect x="144" y="28" width="32" height="10" rx="5" fill={c} /></g>
      <rect x="40" y="144" width="240" height="10" rx="5" fill="none" stroke={k} strokeWidth="2" />
      <rect x="42" y="146" width="96" height="6" rx="3" fill="#22c55e" />
      <text x="238" y="50" fontSize="12" fontWeight="900" fill={k} textAnchor="middle">0.45%</text>
    </g>
  ),
  patch_repair: ({ c, k, s }) => (
    <g>
      <ellipse cx="160" cy="96" rx="110" ry="52" fill="none" stroke={k} strokeWidth="14" />
      <circle cx="160" cy="44" r="5" fill="#ef4444" style={{ animation: sp(`ga-pulse ${0.9 / s}s`) }} />
      <g style={{ animation: sp(`ga-bob ${2.2 / s}s`) }}><circle cx="160" cy="38" r="16" fill={c} stroke={k} strokeWidth="2" /></g>
      {[0, 1, 2].map(i => <circle key={i} cx={156 + i * 6} cy="56" r="2.5" fill="#fff" style={{ animation: `ga-rise ${1.2 / s}s ease-out ${i * 0.3}s infinite` }} />)}
    </g>
  ),
  dry_lube: ({ c, k, s }) => (
    <g>
      <path d="M40 140 L280 140" stroke={k} strokeWidth="10" strokeDasharray="16 6" strokeOpacity="0.85" style={{ animation: sp(`ga-dash ${1.2 / s}s`) }} />
      <rect x="132" y="14" width="56" height="48" rx="10" fill={c} stroke={k} strokeWidth="2" />
      <path d="M154 62 L166 62 L160 78Z" fill={k} />
      {[0, 1, 2].map(i => <path key={i} d="M160 84 Q158 100 160 112" stroke={c} strokeWidth="5" strokeLinecap="round" fill="none" style={{ animation: `ga-fall ${1.1 / s}s ease-in ${i * 0.35}s infinite` }} />)}
      <circle cx="160" cy="140" r="6" fill={c} style={{ animation: sp(`ga-pulse ${1.1 / s}s`) }} />
    </g>
  ),
  stand_clamp: ({ c, k, s }) => (
    <g>
      <line x1="160" y1="60" x2="160" y2="150" stroke={k} strokeWidth="9" />
      <path d="M110 160 L160 144 L210 160" fill="none" stroke={k} strokeWidth="7" strokeLinecap="round" />
      <path d="M60 110 L140 70 L200 70 L270 110" fill="none" stroke={c} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <g style={{ animation: sp(`ga-clamp ${2 / s}s`, 'ease-in-out') }}><rect x="120" y="42" width="22" height="36" rx="5" fill={k} /></g>
      <rect x="150" y="42" width="22" height="36" rx="5" fill={k} fillOpacity="0.8" />
      <Wheel cx={60} cy={130} r={26} c={c} k={k} dur={3 / s} spin tire={5} />
      <Wheel cx={270} cy={130} r={26} c={c} k={k} dur={3 / s} spin tire={5} />
    </g>
  ),

  // Shared bench: used on cars and bikes alike
  gearbox: ({ c, k, s }) => (
    <g>
      <rect x="40" y="26" width="240" height="128" rx="18" fill={k} fillOpacity="0.07" stroke={k} strokeWidth="3" />
      <Gear cx={100} cy={96} r={44} teeth={16} dur={6 / s} c={c} k={k} />
      <Gear cx={163} cy={62} r={30} teeth={11} dur={6 * (30 / 44) / s} rev c={c} k={k} />
      <Gear cx={197} cy={92} r={19} teeth={7} dur={6 * (19 / 44) / s} c={c} k={k} />
      <Gear cx={232} cy={118} r={16} teeth={6} dur={6 * (16 / 44) / s} rev c={c} k={k} />
      <text x="160" y="170" fontSize="11" fontWeight="900" fill={k} textAnchor="middle">6-SPEED  GEARBOX</text>
    </g>
  ),
  torque_wrench: ({ c, k, s }) => (
    <g>
      <g style={{ transformOrigin: '230px 90px', animation: sp(`ga-press ${1.6 / s}s`, 'ease-in-out') }}>
        <rect x="60" y="82" width="170" height="16" rx="8" fill={k} fillOpacity="0.85" />
        <rect x="60" y="82" width="90" height="16" rx="8" fill={c} />
        <circle cx="230" cy="90" r="18" fill={k} />
        <polygon points="230,78 241,84 241,96 230,102 219,96 219,84" fill={c} />
      </g>
      {[0, 1, 2].map(i => <path key={i} d={`M${262 + i * 8} ${70 - i * 4} q8 20 0 40`} stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" style={{ animation: `ga-pulse ${1.6 / s}s ease-in-out ${i * 0.2}s infinite` }} />)}
      <text x="110" y="134" fontSize="12" fontWeight="900" fill={k}>CLICK  120 Nm</text>
    </g>
  ),
  compressor: ({ c, k, s }) => (
    <g>
      <rect x="70" y="60" width="150" height="70" rx="35" fill={c} fillOpacity="0.85" stroke={k} strokeWidth="2.5" />
      <rect x="110" y="40" width="70" height="22" rx="6" fill={k} />
      <g style={{ animation: sp(`ga-pump ${0.5 / s}s`, 'ease-in-out') }}><rect x="140" y="46" width="10" height="14" rx="2" fill={c} /></g>
      <circle cx="96" cy="136" r="12" fill={k} /><circle cx="194" cy="136" r="12" fill={k} />
      <path d="M220 94 Q262 94 262 134" fill="none" stroke={k} strokeWidth="6" strokeLinecap="round" />
      <circle cx="262" cy="144" r="14" fill="none" stroke={k} strokeWidth="5" />
      <g style={{ transformOrigin: '262px 144px', animation: sp(`ga-spin ${1.4 / s}s`) }}><line x1="262" y1="144" x2="262" y2="132" stroke={c} strokeWidth="3" /></g>
    </g>
  ),
  battery: ({ c, k, s }) => (
    <g>
      <rect x="80" y="54" width="150" height="86" rx="10" fill="none" stroke={k} strokeWidth="4" />
      <rect x="104" y="42" width="26" height="14" rx="3" fill={k} /><rect x="180" y="42" width="26" height="14" rx="3" fill={c} />
      <g style={{ transformOrigin: '84px 138px', animation: sp(`ga-fill ${3 / s}s`) }}><rect x="86" y="58" width="142" height="78" rx="6" fill="#22c55e" fillOpacity="0.8" /></g>
      <path d="M170 76 L146 108 L166 108 L152 134 L186 98 L166 98Z" fill="#fff" stroke={k} strokeWidth="2" strokeLinejoin="round" style={{ animation: sp(`ga-pulse ${1.2 / s}s`) }} />
    </g>
  ),
  multimeter: ({ c, k, s }) => (
    <g>
      <rect x="100" y="14" width="120" height="152" rx="16" fill={k} fillOpacity="0.85" />
      <rect x="112" y="26" width="96" height="40" rx="6" fill={c} fillOpacity="0.35" />
      <text x="200" y="56" fontSize="26" fontWeight="900" fill="#fff" textAnchor="end" style={{ fontVariantNumeric: 'tabular-nums' }}>12.6<tspan fontSize="12">V</tspan></text>
      <g style={{ transformOrigin: '160px 112px', animation: sp(`ga-rock ${3 / s}s`, 'alternate') }}>
        <circle cx="160" cy="112" r="30" fill="#e2e8f0" /><line x1="160" y1="112" x2="160" y2="86" stroke={c} strokeWidth="5" strokeLinecap="round" />
      </g>
      <path d="M118 166 Q90 170 70 140" fill="none" stroke="#ef4444" strokeWidth="4" /><path d="M202 166 Q230 170 250 140" fill="none" stroke="#111" strokeWidth="4" />
    </g>
  ),
  grease: ({ c, k, s }) => (
    <g>
      <rect x="60" y="86" width="120" height="24" rx="8" fill={k} fillOpacity="0.85" />
      <g style={{ animation: sp(`ga-slide ${1.6 / s}s`, 'ease-in-out') }}><rect x="40" y="78" width="30" height="40" rx="4" fill={c} /></g>
      <path d="M180 98 L214 98" stroke={c} strokeWidth="8" strokeLinecap="round" strokeDasharray="10 8" style={{ animation: sp(`ga-dash ${0.7 / s}s`) }} />
      <Gear cx={246} cy={98} r={26} teeth={10} dur={5 / s} c={c} k={k} />
    </g>
  ),
};

export default function ToolAnimation({ type, c = '#ef4444', k = '#0f172a', fast = false, height = 200 }) {
  const Scene = SCENES[type] || SCENES.gearbox;
  const s = fast ? 2.2 : 1;
  return (
    <svg viewBox={VB} width="100%" height={height} role="img" aria-label="Animated illustration of the tool" style={{ display: 'block' }}>
      <style>{CSS}</style>
      <Scene c={c} k={k} s={s} />
    </svg>
  );
}

export const TOOL_ANIMATION_TYPES = Object.keys(SCENES);
