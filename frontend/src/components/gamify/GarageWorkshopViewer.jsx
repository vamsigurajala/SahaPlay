import React, { useState, useEffect } from 'react';
import ToolAnimation from './toolAnimations';
import {
  Wrench, Gauge, Disc, Zap, Check, AlertCircle, RefreshCw,
  Sliders, Shield, Award, Play, X, BatteryCharging, Cpu,
  Search, Info, Flame, ChevronRight, Activity, Bike, Car,
  Sparkles, CheckCircle2, RotateCcw
} from 'lucide-react';

// ============================================================================
// GARAGE TOOLS & ASSETS DATA ACROSS CARS, BIKES, AND CYCLES
// ============================================================================

export const GARAGE_CATEGORIES = {
  car: {
    name: 'Supercar Bay',
    subtitle: 'Track-spec tools for Ferrari, Lamborghini & Hypercars',
    icon: 'car',
    color: '#ef4444',
    badge: '1,000 HP SPECS',
    items: [
      {
        id: 'car_impact',
        name: 'Pneumatic 1/2" Impact Wrench',
        spec: '1,400 ft-lb • 8,500 RPM • Twin-Hammer',
        desc: 'Lightning-fast removal and torqueing of magnesium center-lock wheel nuts.',
        actionVerb: 'Torque Wheel Nut',
        animationType: 'spin_impact',
        stats: { speed: '0.8s Nut Removal', torque: '1,400 ft-lb', pressure: '90 PSI Air' }
      },
      {
        id: 'car_jack',
        name: 'Low-Profile Racing Floor Jack',
        spec: '3-Ton • 75mm Ultra-Low Clearance',
        desc: 'Quick-pump hydraulic dual-piston lift engineered for low-slung carbon splitters.',
        actionVerb: 'Lift Chassis',
        animationType: 'jack_lift',
        stats: { capacity: '3,000 kg', liftHeight: '510 mm', pumps: '3 Rapid Pumps' }
      },
      {
        id: 'car_oil',
        name: 'Motul 300V 10W-60 Synthetic Oil',
        spec: 'Ester Core Technology • 300°C Flashpoint',
        desc: 'High-shear racing oil providing unyielding film strength under extreme V8/V12 RPM.',
        actionVerb: 'Replenish Racing Oil',
        animationType: 'oil_pour',
        stats: { grade: '10W-60 Ester', capacity: '9.5 Liters', endurance: '5,000 Track km' }
      },
      {
        id: 'car_polisher',
        name: 'Dual-Action Orbital Paint Buffer',
        spec: '21mm Orbit • 4,800 OPM • Microfiber Pad',
        desc: 'Restores mirror-like wet reflections on Rosso Corsa & Giallo clear coats.',
        actionVerb: 'Polish Paint to Mirror Gloss',
        animationType: 'paint_polish',
        stats: { orbit: '21mm Throw', cut: 'Compound & Finish', gloss: '99.8 GU Mirror' }
      },
      {
        id: 'car_scanner',
        name: 'OBD-II Wireless ECU Scanner',
        spec: 'CAN-FD / DoIP • Live 120Hz Telemetry',
        desc: 'Monitors fuel trims, turbo boost PSI, and hybrid battery cell voltages.',
        actionVerb: 'Run Full ECU Diagnostics',
        animationType: 'ecu_scan',
        stats: { protocols: 'CAN-FD / DoIP', sensors: '148 Live PIDs', errors: '0 DTC Faults' }
      },
      {
        id: 'car_brakes',
        name: 'Ceramic Caliper Vacuum Bleeder',
        spec: 'Brembo Monobloc • DOT 5.1 Fluid',
        desc: 'Purges micro air bubbles from 6-piston front calipers for rock-firm pedal feel.',
        actionVerb: 'Bleed Hydraulic Line',
        animationType: 'brake_bleed',
        stats: { pressure: '2.5 Bar', fluid: 'DOT 5.1 High Temp', boilPoint: '310°C Dry' }
      },
    ]
  },

  bike: {
    name: 'Motorbike Bay',
    subtitle: 'Precision paddock equipment for Sports Superbikes',
    icon: 'bike',
    color: '#06b6d4',
    badge: 'SUPERBIKE SPEC',
    items: [
      {
        id: 'bike_paddock',
        name: 'Rear Paddock Spool Stand',
        spec: 'Heavy-Duty 35mm Steel • Rubber Coated Rollers',
        desc: 'Lifts the rear swingarm effortlessly for wheel changes, chain adjustments, and cleaning.',
        actionVerb: 'Engage Paddock Stand',
        animationType: 'paddock_lift',
        stats: { liftType: 'V-Hook Spool', clearance: '120mm Lift', load: '350 kg' }
      },
      {
        id: 'bike_chain',
        name: 'High-Tack O-Ring Chain Lube & Brush',
        spec: 'PTFE Synthetic • Anti-Fling Formula',
        desc: 'Penetrates deep into 525 O-ring links to protect against friction at 14,000 RPM.',
        actionVerb: 'Clean & Lubricate Chain',
        animationType: 'chain_spray',
        stats: { chainType: '520 / 525 O-Ring', tempRange: '-30°C to 240°C', flingRating: 'Zero Fling' }
      },
      {
        id: 'bike_tpms',
        name: 'Digital Motorcycle Tire Pressure Gauge',
        spec: '0-100 PSI • 0.1 PSI Accuracy • 90° Chuck',
        desc: 'Essential 90-degree angled brass chuck designed to clear dual front brake rotors.',
        actionVerb: 'Calibrate Tire Pressures',
        animationType: 'tire_gauge',
        stats: { frontPsi: '34.0 PSI Track', rearPsi: '38.0 PSI Track', bleedValve: 'Micro-Bleed' }
      },
      {
        id: 'bike_spark',
        name: 'Laser-Iridium Spark Plug Tester',
        spec: 'High-Energy Coil • 25kV Test Arc',
        desc: 'Simulates high-RPM spark pulse to ensure perfect ignition without spark blowout.',
        actionVerb: 'Fire Ignition Arc',
        animationType: 'spark_fire',
        stats: { gap: '0.7mm Micro', voltage: '25,000 Volts', electrode: '0.6mm Iridium' }
      },
      {
        id: 'bike_lever',
        name: 'CNC Folding Clutch & Brake Levers',
        spec: 'Billet 6061-T6 Aluminum • 6-Way Clicker',
        desc: 'Allows fine on-the-fly reach adjustment for instantaneous braking response.',
        actionVerb: 'Adjust Lever Reach',
        animationType: 'lever_click',
        stats: { material: 'Billet 6061-T6', adjustment: '6 Position Clicker', design: 'Pivot Fold' }
      },
      {
        id: 'bike_balancer',
        name: 'High-Precision Wheel Balancer',
        spec: 'Twin Low-Friction Bearings • Carbon Steel Axle',
        desc: 'Detects gram-level imbalance on lightweight forged alloy motorcycle wheels.',
        actionVerb: 'Balance Wheel Assembly',
        animationType: 'wheel_balance',
        stats: { sensitivity: '0.5 Grams', maxWheel: '21 Inch Front/Rear', axle: '12mm Ground' }
      },
    ]
  },

  cycle: {
    name: 'Bicycle Bay',
    subtitle: 'Pro workshop tools for Road, Gravel & Mountain Bikes',
    icon: 'cycle',
    color: '#10b981',
    badge: 'PRO PELOTON',
    items: [
      {
        id: 'cycle_pump',
        name: 'Pro High-Pressure Floor Pump',
        spec: '160 PSI / 11 Bar • Dual Presta/Schrader SmartHead',
        desc: 'Aluminum barrel with oversized base and calibrated top-mount analog pressure dial.',
        actionVerb: 'Pump Tire to 110 PSI',
        animationType: 'pump_cycle',
        stats: { maxPressure: '160 PSI', valveType: 'Presta & Schrader', strokes: '12 Quick Pumps' }
      },
      {
        id: 'cycle_multitool',
        name: '20-in-1 Carbon Torque Multi-Tool',
        spec: '2-8mm Hex • T25 Torx • Chain Breaker • Tire Lever',
        desc: 'Compact lightweight workshop multi-tool forged from hardened chrome-vanadium steel.',
        actionVerb: 'Tune Cockpit & Seatpost',
        animationType: 'hex_tighten',
        stats: { bits: '20 Hardened Bits', weight: '142 Grams', torqueMax: '15 Nm' }
      },
      {
        id: 'cycle_chain_tool',
        name: 'Precision Chain Breaker & Wear Gauge',
        spec: 'Compatible with 8-12 Speed Chains • 0.5% & 0.75% Gauge',
        desc: 'Accurately tests chain link stretch and easily drives out master pins for replacements.',
        actionVerb: 'Check Chain Stretch',
        animationType: 'chain_breaker',
        stats: { wearReading: '0.45% (Healthy)', speeds: '8, 9, 10, 11, 12 Speed', pin: 'Hardened Tool Steel' }
      },
      {
        id: 'cycle_patch',
        name: 'Glueless Inner Tube Patch Kit',
        spec: '6 Vulcanizing Adhesive Patches • Stainless Scuffer',
        desc: 'Instantly seals punctures without messy liquid glue tubes within 30 seconds.',
        actionVerb: 'Apply Vulcanizing Patch',
        animationType: 'patch_repair',
        stats: { cureTime: 'Instant Bond', elasticity: 'High Stretch', patches: '6 Round Patches' }
      },
      {
        id: 'cycle_lube',
        name: 'Ceramic Dry Lube & Degreaser',
        spec: 'Nano-Ceramic Particles • Wax Emulsion',
        desc: 'Repels road dust, sand, and moisture for silent, frictionless pedaling efficiency.',
        actionVerb: 'Apply Nano-Ceramic Lube',
        animationType: 'dry_lube',
        stats: { formula: 'Wax & Nano-Ceramic', friction: '-4.5 Watts Drag', conditions: 'Dry & Dusty Road' }
      },
      {
        id: 'cycle_stand',
        name: 'Adjustable 360° Workshop Repair Stand',
        spec: 'Quick-Release Cam Clamp • 35kg Max Weight',
        desc: 'Suspends the bicycle at optimal eye level to adjust derailleurs and true wheels easily.',
        actionVerb: 'Clamp Bike into Workstand',
        animationType: 'stand_clamp',
        stats: { rotation: '360° Swivel', clamp: 'Rubber-Jawed Cam', height: '100 - 160 cm' }
      },
    ]
  }
};

GARAGE_CATEGORIES.shared = {
  name: 'Gearbox & Shared Tools',
  subtitle: 'Equipment that works on supercars, motorbikes and bicycles alike',
  icon: 'gearbox',
  color: '#f59e0b',
  badge: 'ALL VEHICLES',
  items: [
    {
      id: 'shared_gearbox',
      name: 'Transmission Gearbox Bench',
      spec: '6-Speed Sequential • Meshing Helical Gears',
      desc: 'See how a gearbox works: the input gear drives the layshaft and each ratio trades speed for torque. The same principle sits inside a supercar and a superbike.',
      actionVerb: 'Shift Through the Gears',
      animationType: 'gearbox',
      stats: { ratios: '6 Forward', type: 'Helical Gears', fluid: 'Gear Oil 75W-90' },
    },
    {
      id: 'shared_torque',
      name: 'Click-Type Torque Wrench',
      spec: '20-200 Nm • Reversible Ratchet',
      desc: 'Clicks when the set torque is reached so wheel nuts, axle bolts and cockpit bolts are never over-tightened.',
      actionVerb: 'Torque to Spec',
      animationType: 'torque_wrench',
      stats: { range: '20-200 Nm', drive: '1/2 inch Square', accuracy: '+/- 3 %' },
    },
    {
      id: 'shared_compressor',
      name: 'Portable Air Compressor',
      spec: '12V • 150 PSI • Auto Shut-Off',
      desc: 'Inflates car, motorcycle and bicycle tyres, then stops itself at the pressure you set.',
      actionVerb: 'Inflate Tyres',
      animationType: 'compressor',
      stats: { max: '150 PSI', power: '12 V DC', valves: 'Presta + Schrader' },
    },
    {
      id: 'shared_battery',
      name: 'Smart Battery Charger',
      spec: '12V • 10A • Trickle Maintenance',
      desc: 'Brings a flat car or motorcycle battery back to life and keeps it topped up in storage.',
      actionVerb: 'Charge Battery',
      animationType: 'battery',
      stats: { current: '10 A', modes: 'AGM / Lithium', safety: 'Spark-Proof' },
    },
    {
      id: 'shared_meter',
      name: 'Digital Multimeter',
      spec: 'Auto-Range • True RMS • CAT III',
      desc: 'Checks battery voltage, fuses, sensors and lighting circuits on any vehicle with an electrical system.',
      actionVerb: 'Test the Circuit',
      animationType: 'multimeter',
      stats: { volts: '1000 V Max', amps: '10 A', extra: 'Continuity Beep' },
    },
    {
      id: 'shared_grease',
      name: 'High-Pressure Grease Gun',
      spec: 'Lithium Complex • 400 g Cartridge',
      desc: 'Pushes fresh grease into bearings, joints and linkages so moving parts stay smooth and quiet.',
      actionVerb: 'Grease the Bearings',
      animationType: 'grease',
      stats: { pressure: '6,000 PSI', grease: 'Lithium EP2', fit: 'Standard Zerk' },
    },
  ],
};

const CATEGORY_KEYS = ['car', 'bike', 'cycle', 'shared'];

export default function GarageWorkshopViewer({ onClose, arg }) {
  const startKey = CATEGORY_KEYS.includes(arg) ? arg : 'car';
  const [activeCategory, setActiveCategory] = useState(startKey);
  const [selectedItem, setSelectedItem] = useState(GARAGE_CATEGORIES[startKey].items[0]);
  const [isServicing, setIsServicing] = useState(false);
  const [serviceProgress, setServiceProgress] = useState(0);
  const [serviceCompleted, setServiceCompleted] = useState(false);
  const [actionLog, setActionLog] = useState('');

  const [isLight, setIsLight] = useState(() => {
    return typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  });

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // When changing category, switch selected item automatically
  const handleCategorySwitch = (catKey) => {
    setActiveCategory(catKey);
    setSelectedItem(GARAGE_CATEGORIES[catKey].items[0]);
    setIsServicing(false);
    setServiceProgress(0);
    setServiceCompleted(false);
    setActionLog('');
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setIsServicing(false);
    setServiceProgress(0);
    setServiceCompleted(false);
    setActionLog('');
  };

  // Trigger interactive servicing simulation
  const handleUseTool = () => {
    if (isServicing) return;
    setIsServicing(true);
    setServiceProgress(0);
    setServiceCompleted(false);
    setActionLog(`Engaging ${selectedItem.name}...`);

    let p = 0;
    const interval = setInterval(() => {
      p += 10;
      setServiceProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setIsServicing(false);
        setServiceCompleted(true);
        setActionLog(`Success! ${selectedItem.actionVerb} completed with pro accuracy.`);
      }
    }, 120);
  };

  const currentCategory = GARAGE_CATEGORIES[activeCategory];

  // Theme-adaptive palettes
  const cardBg = isLight
    ? 'linear-gradient(165deg, rgba(255,255,255,0.98), rgba(245,247,252,0.99))'
    : 'linear-gradient(165deg, rgba(20,16,32,0.97), rgba(10,8,18,0.99))';
  const cardBorder = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)';
  const textTitle = isLight ? '#0f172a' : '#ffffff';
  const textSub = isLight ? '#475569' : '#94a3b8';
  const innerCardBg = isLight ? 'rgba(241,245,249,0.85)' : 'rgba(255,255,255,0.04)';
  const innerCardBorder = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
  const toolInk = isLight ? '#0f172a' : '#e2e8f0';

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: 980,
        height: '88vh',
        maxHeight: 800,
        borderRadius: 24,
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: isLight
          ? '0 24px 60px rgba(0,0,0,0.16)'
          : `0 24px 60px rgba(0,0,0,0.7), 0 0 50px ${currentCategory.color}25`,
        backdropFilter: 'blur(16px)',
        overflow: 'hidden',
        color: textTitle,
        display: 'flex',
        flexDirection: 'column',
        animation: 'gp-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes gear-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pump-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes spark-flicker {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
      `}</style>

      {/* ── Top Header Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: `1px solid ${innerCardBorder}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${currentCategory.color}, #09090b)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: `0 4px 16px ${currentCategory.color}50`,
            }}
          >
            <Wrench size={22} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
              Multi-Vehicle Workshop &amp; Garage Station
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 99,
                  background: `${currentCategory.color}20`,
                  color: currentCategory.color,
                  border: `1px solid ${currentCategory.color}40`,
                }}
              >
                {currentCategory.badge}
              </span>
            </div>
            <div style={{ fontSize: 12, color: textSub }}>
              Interactive mechanical tools and servicing assets for Supercars, Motorbikes &amp; Bicycles
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          title="Close"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: `1px solid ${innerCardBorder}`,
            background: innerCardBg,
            color: textTitle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Category Switcher: Supercars, Motorbikes, Bicycles ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 12,
          padding: '14px 24px',
          borderBottom: `1px solid ${innerCardBorder}`,
          background: isLight ? 'rgba(241,245,249,0.5)' : 'rgba(0,0,0,0.2)',
        }}
      >
        {[
          { key: 'car', label: 'Supercar Bay', icon: <Car size={18} />, color: '#ef4444', desc: 'Ferrari & Lambo' },
          { key: 'bike', label: 'Motorbike Bay', icon: <Zap size={18} />, color: '#06b6d4', desc: 'Sports Superbikes' },
          { key: 'cycle', label: 'Bicycle Bay', icon: <Bike size={18} />, color: '#10b981', desc: 'Road & Mountain Bikes' },
          { key: 'shared', label: 'Gearbox & Shared', icon: <Cpu size={18} />, color: '#f59e0b', desc: 'For every vehicle' },
        ].map(cat => (
          <button
            key={cat.key}
            onClick={() => handleCategorySwitch(cat.key)}
            style={{
              padding: '10px 16px',
              borderRadius: 14,
              border: activeCategory === cat.key ? `2px solid ${cat.color}` : `1px solid ${innerCardBorder}`,
              background: activeCategory === cat.key ? `${cat.color}15` : innerCardBg,
              color: textTitle,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: activeCategory === cat.key ? cat.color : isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeCategory === cat.key ? '#fff' : textTitle,
              }}
            >
              {cat.icon}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: activeCategory === cat.key ? cat.color : textTitle }}>
                {cat.label}
              </div>
              <div style={{ fontSize: 11, color: textSub }}>{cat.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Main Content Area: Grid of Animated Assets on Left + Live Workstation on Right ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1.3fr', overflow: 'hidden' }}>
        {/* Left Column: Animated Assets & Tool Cards Grid */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: textSub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Available Mechanical Assets ({currentCategory.items.length})
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {currentCategory.items.map(item => {
              const isSelected = selectedItem.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 16,
                    background: isSelected ? `${currentCategory.color}15` : innerCardBg,
                    border: isSelected ? `2px solid ${currentCategory.color}` : `1px solid ${innerCardBorder}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    transition: 'all 0.15s',
                    boxShadow: isSelected ? `0 4px 20px ${currentCategory.color}25` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Animated Tool Icon Badge */}
                    <div
                      style={{
                        width: 72,
                        height: 46,
                        borderRadius: 12,
                        background: isLight ? '#ffffff' : 'rgba(255,255,255,0.06)',
                        border: isSelected ? `2px solid ${currentCategory.color}` : `1px solid ${innerCardBorder}`,
                        overflow: 'hidden',
                        flexShrink: 0,
                        transition: 'all 0.2s',
                      }}
                    >
                      <ToolAnimation type={item.animationType} c={currentCategory.color} k={toolInk} height={44} />
                    </div>

                    <div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: isSelected ? currentCategory.color : textTitle }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#38bdf8', fontWeight: 700, marginTop: 2 }}>
                        {item.spec}
                      </div>
                    </div>
                  </div>

                  <ChevronRight size={18} color={isSelected ? currentCategory.color : textSub} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live Interactive Mechanical Workstation */}
        <div
          style={{
            padding: '24px',
            borderLeft: `1px solid ${innerCardBorder}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: isLight ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.25)',
            overflowY: 'auto',
          }}
        >
          {/* Upper Section: Details & Animated Asset Showcase */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: 99,
                  background: `${currentCategory.color}20`,
                  color: currentCategory.color,
                  textTransform: 'uppercase',
                }}
              >
                {currentCategory.name}
              </span>
              <span style={{ fontSize: 11, color: textSub, fontWeight: 700 }}>
                STATUS: READY TO DEPLOY
              </span>
            </div>

            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 6 }}>
              {selectedItem.name}
            </div>

            <div style={{ fontSize: 13, color: textSub, lineHeight: 1.6, marginBottom: 18 }}>
              {selectedItem.desc}
            </div>

            {/* Animated Asset Feature Specs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
              {Object.entries(selectedItem.stats).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    background: innerCardBg,
                    border: `1px solid ${innerCardBorder}`,
                    borderRadius: 12,
                    padding: '10px 12px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, color: textSub, textTransform: 'uppercase' }}>
                    {k}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: textTitle, marginTop: 4 }}>
                    {v}
                  </div>
                </div>
              ))}
            </div>

            {/* Live animated illustration of the selected tool */}
            <div
              style={{
                borderRadius: 18,
                background: isLight ? '#f8fafc' : '#0b0a14',
                border: `1px solid ${innerCardBorder}`,
                position: 'relative',
                overflow: 'hidden',
                padding: '8px 12px 14px',
              }}
            >
              <ToolAnimation type={selectedItem.animationType} c={currentCategory.color} k={toolInk} fast={isServicing} height={210} />
              <div style={{ position: 'absolute', top: 10, left: 12, fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: isServicing ? currentCategory.color : textSub }}>
                {isServicing ? `Working ${serviceProgress}%` : serviceCompleted ? 'Done' : 'Live demo'}
              </div>
              {serviceCompleted && (
                <div style={{ position: 'absolute', top: 8, right: 10, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 900, color: '#22c55e' }}>
                  <CheckCircle2 size={16} /> Complete
                </div>
              )}
              {isServicing && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(128,128,128,0.2)' }}>
                  <div style={{ height: '100%', width: `${serviceProgress}%`, background: currentCategory.color, transition: 'width 0.12s linear' }} />
                </div>
              )}
            </div>

            {actionLog && (
              <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: serviceCompleted ? '#22c55e' : textSub, textAlign: 'center' }}>
                {actionLog}
              </div>
            )}
          </div>

          {/* Bottom Interactive Action Button */}
          <div style={{ marginTop: 20 }}>
            <button
              onClick={handleUseTool}
              disabled={isServicing}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 16,
                border: 'none',
                background: isServicing
                  ? 'rgba(255,255,255,0.1)'
                  : `linear-gradient(135deg, ${currentCategory.color}, #09090b)`,
                color: '#fff',
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                cursor: isServicing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: isServicing ? 'none' : `0 6px 20px ${currentCategory.color}45`,
                transition: 'all 0.2s',
              }}
            >
              <Wrench size={18} />
              <span>{isServicing ? 'Working...' : selectedItem.actionVerb.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
