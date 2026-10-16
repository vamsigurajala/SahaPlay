import React, { useState, useEffect } from 'react';
import {
  Wrench, Gauge, Disc, Zap, Check, AlertCircle, RefreshCw,
  Sliders, Shield, Award, Play, X, BatteryCharging, Cpu,
  Search, Info, Flame, ChevronRight, Activity
} from 'lucide-react';

const MECHANIC_TOOLS = [
  {
    id: 'torque',
    name: 'Digital Precision Torque Wrench',
    category: 'Assembly & Safety',
    spec: '20 - 250 Nm • 1/2" Drive • ±1% Accuracy',
    desc: 'Crucial for torquing lightweight magnesium center-lock wheel nuts and cylinder head studs to exact manufacturer tolerances.',
    icon: 'wrench',
    actionText: 'Torque Center-Lock Nut (140 Nm)',
  },
  {
    id: 'impact',
    name: 'Twin-Hammer Pneumatic Impact Gun',
    category: 'Rapid Wheel Service',
    spec: '1,400 ft-lb Breakaway Torque • 8,500 RPM',
    desc: 'Heavy-duty air-powered gun used in pit stops for lightning-fast tire changes and stubborn suspension fasteners.',
    icon: 'zap',
    actionText: 'Spin Off Wheel Fastener',
  },
  {
    id: 'scanner',
    name: 'OBD-II Advanced ECU Telemetry Scanner',
    category: 'Diagnostics & Tuning',
    spec: 'CAN-FD / DoIP Protocols • Live 120Hz Telemetry',
    desc: 'Connects directly to the twin-turbo V8 hybrid ECU to read fuel trim, turbo boost pressure, and clear fault codes.',
    icon: 'cpu',
    actionText: 'Scan ECU Telemetry',
  },
  {
    id: 'jack',
    name: '3-Ton Ultra Low-Profile Racing Floor Jack',
    category: 'Lifting & Rigging',
    spec: '75mm Minimum Clearance • Dual Rapid Pump',
    desc: 'Engineered specifically for slammed supercars with ground clearance under 80mm to lift safely on chassis jack points.',
    icon: 'sliders',
    actionText: 'Pump Chassis Lift',
  },
  {
    id: 'brake_bleeder',
    name: 'Pneumatic Brake Bleeding & Vacuum Kit',
    category: 'Hydraulics',
    spec: 'Vacuum Reservoir • 3.0 Bar DOT 5.1 Pressure',
    desc: 'Flushes high-temperature racing brake fluid through 6-piston monobloc Brembo calipers, purging air bubbles.',
    icon: 'disc',
    actionText: 'Bleed Brake Line',
  },
  {
    id: 'spark_gauge',
    name: 'Iridium Spark Plug Feeler & Gap Gauge',
    category: 'Ignition Tuning',
    spec: '0.02 - 1.00 mm • Micro-Metric Steel Blades',
    desc: 'Calibrates the electrode gap on twin-turbo spark plugs to prevent ignition blowout under 2.2 bar boost.',
    icon: 'flame',
    actionText: 'Calibrate Electrode Gap',
  },
  {
    id: 'multimeter',
    name: 'Hybrid Automotive True-RMS Multimeter',
    category: 'Electrical & 48V Hybrid',
    spec: '1,000V CAT III • Insulation Resistance • 100A Clamp',
    desc: 'Safely measures high-voltage hybrid lithium battery cells and electric motor regenerative braking currents.',
    icon: 'battery',
    actionText: 'Test Hybrid Battery Cell',
  },
  {
    id: 'sockets',
    name: 'Titanium-Alloy Hex & Torx Socket Set',
    category: 'Hand Tools',
    spec: 'T10 - T60 Torx • 8mm - 36mm Thin-Wall Hex',
    desc: 'Magnetic thin-wall sockets designed to access recessed titanium bolts in engine bays without marring finishes.',
    icon: 'wrench',
    actionText: 'Inspect Fasteners',
  },
];

export default function GarageWorkshopViewer({ onClose }) {
  const [activeTab, setActiveTab] = useState('tools'); // 'tools' | 'service' | 'dyno'
  const [selectedTool, setSelectedTool] = useState(MECHANIC_TOOLS[0]);
  const [toolActionActive, setToolActionActive] = useState(false);
  const [actionFeedback, setActionFeedback] = useState('');

  // Service Bay State
  const [oilLevel, setOilLevel] = useState(65);
  const [brakePadLife, setBrakePadLife] = useState(72);
  const [frontPsi, setFrontPsi] = useState(28);
  const [rearPsi, setRearPsi] = useState(30);
  const [ecuErrorsCleared, setEcuErrorsCleared] = useState(false);
  const [serviceMessage, setServiceMessage] = useState('');

  // Dyno Test State
  const [isDynoRunning, setIsDynoRunning] = useState(false);
  const [dynoRpm, setDynoRpm] = useState(0);
  const [dynoHp, setDynoHp] = useState(0);
  const [dynoTorque, setDynoTorque] = useState(0);
  const [dynoDone, setDynoDone] = useState(false);

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

  const triggerToolAction = () => {
    setToolActionActive(true);
    setActionFeedback(`Executing: ${selectedTool.actionText}...`);
    setTimeout(() => {
      setToolActionActive(false);
      setActionFeedback(`Complete! ${selectedTool.name} calibrated successfully.`);
    }, 1400);
  };

  const runDynoTest = () => {
    if (isDynoRunning) return;
    setIsDynoRunning(true);
    setDynoDone(false);
    setDynoRpm(1000);
    setDynoHp(80);
    setDynoTorque(180);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      const currentRpm = 1000 + step * 250;
      setDynoRpm(currentRpm);

      // Dyno curve simulation
      const progress = step / 32;
      const calculatedHp = Math.round(100 + Math.sin(progress * Math.PI * 0.9) * 915);
      const calculatedTorque = Math.round(200 + Math.sin(progress * Math.PI * 0.8) * 620);
      setDynoHp(calculatedHp);
      setDynoTorque(calculatedTorque);

      if (step >= 32) {
        clearInterval(interval);
        setIsDynoRunning(false);
        setDynoDone(true);
        setDynoRpm(8500);
        setDynoHp(1015);
        setDynoTorque(820);
      }
    }, 90);
  };

  // Styling theme tokens
  const cardBg = isLight
    ? 'linear-gradient(165deg, rgba(255,255,255,0.98), rgba(245,247,252,0.99))'
    : 'linear-gradient(165deg, rgba(22,18,36,0.97), rgba(10,8,18,0.99))';
  const cardBorder = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)';
  const textTitle = isLight ? '#0f172a' : '#ffffff';
  const textSub = isLight ? '#475569' : '#94a3b8';
  const innerCardBg = isLight ? 'rgba(241,245,249,0.85)' : 'rgba(255,255,255,0.04)';
  const innerCardBorder = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: 960,
        height: '88vh',
        maxHeight: 780,
        borderRadius: 24,
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: isLight
          ? '0 24px 60px rgba(0,0,0,0.18)'
          : '0 24px 60px rgba(0,0,0,0.7), 0 0 50px rgba(239,68,68,0.18)',
        backdropFilter: 'blur(16px)',
        overflow: 'hidden',
        color: textTitle,
        display: 'flex',
        flexDirection: 'column',
        animation: 'gp-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
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
              background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 16px rgba(239,68,68,0.4)',
            }}
          >
            <Wrench size={22} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
              Supercar Mechanic Workshop &amp; Garage Station
              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                PRO PIT LANE
              </span>
            </div>
            <div style={{ fontSize: 12, color: textSub }}>
              Precision tools, diagnostics scanner &amp; dyno tuning bay for hypercars
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {[
            { id: 'tools', label: 'Mechanic Tools', icon: <Wrench size={14} /> },
            { id: 'service', label: 'Service Bay', icon: <Disc size={14} /> },
            { id: 'dyno', label: 'Dyno Pull Test', icon: <Gauge size={14} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 14px',
                borderRadius: 12,
                border: activeTab === tab.id ? '1px solid #ef4444' : `1px solid ${innerCardBorder}`,
                background: activeTab === tab.id ? '#ef4444' : innerCardBg,
                color: activeTab === tab.id ? '#fff' : textTitle,
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}

          <button
            onClick={onClose}
            title="Close"
            style={{
              marginLeft: 8,
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
      </div>

      {/* ── Main Tab View Area ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {/* TAB 1: MECHANIC TOOLS INVENTORY */}
        {activeTab === 'tools' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: 20, height: '100%' }}>
            {/* Left: Tool Selection List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: textSub, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Workshop Equipment ({MECHANIC_TOOLS.length})
              </div>
              {MECHANIC_TOOLS.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTool(t)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: selectedTool.id === t.id
                      ? isLight ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.18)'
                      : innerCardBg,
                    border: selectedTool.id === t.id
                      ? '1px solid #ef4444'
                      : `1px solid ${innerCardBorder}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                      <Wrench size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: selectedTool.id === t.id ? '#ef4444' : textTitle }}>
                        {t.name}
                      </div>
                      <div style={{ fontSize: 11, color: textSub }}>{t.category}</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color={selectedTool.id === t.id ? '#ef4444' : textSub} />
                </div>
              ))}
            </div>

            {/* Right: Detailed Tool Inspection & Action Bay */}
            <div
              style={{
                background: innerCardBg,
                border: `1px solid ${innerCardBorder}`,
                borderRadius: 20,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 99, background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 12 }}>
                  {selectedTool.category}
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 8 }}>
                  {selectedTool.name}
                </div>
                <div style={{ fontSize: 13, color: '#38bdf8', fontWeight: 700, marginBottom: 16 }}>
                  SPEC: {selectedTool.spec}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: textSub, marginBottom: 24 }}>
                  {selectedTool.desc}
                </div>

                {/* Technical Features Specs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                  <div style={{ background: isLight ? '#fff' : 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: 12, border: `1px solid ${innerCardBorder}` }}>
                    <div style={{ fontSize: 11, color: textSub, fontWeight: 700 }}>MATERIAL GRADE</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: textTitle, marginTop: 3 }}>Chrome-Vanadium &bull; Titanium</div>
                  </div>
                  <div style={{ background: isLight ? '#fff' : 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: 12, border: `1px solid ${innerCardBorder}` }}>
                    <div style={{ fontSize: 11, color: textSub, fontWeight: 700 }}>CERTIFICATION</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: textTitle, marginTop: 3 }}>FIA Pit Lane Spec &bull; ISO 6789</div>
                  </div>
                </div>
              </div>

              {/* Action Button & Feedback */}
              <div>
                {actionFeedback && (
                  <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Check size={16} />
                    <span>{actionFeedback}</span>
                  </div>
                )}

                <button
                  onClick={triggerToolAction}
                  disabled={toolActionActive}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 14,
                    border: 'none',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 900,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    cursor: toolActionActive ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 16px rgba(239,68,68,0.4)',
                    transition: 'all 0.2s',
                  }}
                >
                  <Wrench size={18} />
                  <span>{toolActionActive ? 'Operating Tool...' : selectedTool.actionText}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SERVICE & MAINTENANCE BAY */}
        {activeTab === 'service' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {serviceMessage && (
              <div style={{ padding: '10px 16px', borderRadius: 12, background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Check size={16} />
                <span>{serviceMessage}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {/* Oil Service */}
              <div style={{ background: innerCardBg, border: `1px solid ${innerCardBorder}`, borderRadius: 18, padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>Engine Racing Lubricant (10W-60)</span>
                  <span style={{ fontSize: 15, fontWeight: 900, color: oilLevel > 80 ? '#22c55e' : '#f59e0b' }}>{oilLevel}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ height: '100%', width: `${oilLevel}%`, background: 'linear-gradient(90deg, #f59e0b, #22c55e)', transition: 'width 0.4s' }} />
                </div>
                <button
                  onClick={() => {
                    setOilLevel(100);
                    setServiceMessage('Fresh Motul 300V 10W-60 synthetic oil replenished. Filter replaced!');
                  }}
                  style={{ width: '100%', padding: '10px', borderRadius: 12, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                >
                  Drain &amp; Refill Racing Oil
                </button>
              </div>

              {/* Brake Pad Wear */}
              <div style={{ background: innerCardBg, border: `1px solid ${innerCardBorder}`, borderRadius: 18, padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>Carbon Ceramic Brake Pads</span>
                  <span style={{ fontSize: 15, fontWeight: 900, color: brakePadLife > 80 ? '#22c55e' : '#f59e0b' }}>{brakePadLife}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ height: '100%', width: `${brakePadLife}%`, background: 'linear-gradient(90deg, #ef4444, #22c55e)', transition: 'width 0.4s' }} />
                </div>
                <button
                  onClick={() => {
                    setBrakePadLife(100);
                    setServiceMessage('High-friction Brembo ceramic pads installed and bedded in!');
                  }}
                  style={{ width: '100%', padding: '10px', borderRadius: 12, border: 'none', background: '#8b5cf6', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                >
                  Bed-In New Racing Brake Pads
                </button>
              </div>

              {/* Tire Pressure System */}
              <div style={{ background: innerCardBg, border: `1px solid ${innerCardBorder}`, borderRadius: 18, padding: '18px' }}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Tire Pressure Monitoring (TPMS)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <div style={{ textAlign: 'center', padding: '8px', borderRadius: 10, background: isLight ? '#fff' : 'rgba(0,0,0,0.3)' }}>
                    <div style={{ fontSize: 11, color: textSub }}>FRONT WHEELS</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: frontPsi >= 32 ? '#22c55e' : '#f59e0b' }}>{frontPsi} PSI</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px', borderRadius: 10, background: isLight ? '#fff' : 'rgba(0,0,0,0.3)' }}>
                    <div style={{ fontSize: 11, color: textSub }}>REAR WHEELS</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: rearPsi >= 34 ? '#22c55e' : '#f59e0b' }}>{rearPsi} PSI</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setFrontPsi(32);
                    setRearPsi(34);
                    setServiceMessage('All 4 Michelin Pilot Sport Cup 2 tires calibrated to track pressures!');
                  }}
                  style={{ width: '100%', padding: '10px', borderRadius: 12, border: 'none', background: '#06b6d4', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                >
                  Inflate to Track Spec (32 / 34 PSI)
                </button>
              </div>

              {/* OBD-II Fault Codes */}
              <div style={{ background: innerCardBg, border: `1px solid ${innerCardBorder}`, borderRadius: 18, padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>ECU System Diagnostics</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: ecuErrorsCleared ? '#22c55e' : '#ef4444' }}>
                    {ecuErrorsCleared ? '0 DTC Codes' : '1 Minor Code: P0133'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: textSub, marginBottom: 16, lineHeight: 1.5 }}>
                  {ecuErrorsCleared
                    ? 'All 6 micro-controllers online: Engine, Dual-Clutch Transmission, Active Aero, Hybrid Inverter.'
                    : 'Fault Code P0133: Bank 1 O2 sensor response slow due to cold track session.'}
                </div>
                <button
                  onClick={() => {
                    setEcuErrorsCleared(true);
                    setServiceMessage('OBD-II scanner cleared all DTC codes. ECU reset to factory performance map!');
                  }}
                  style={{ width: '100%', padding: '10px', borderRadius: 12, border: 'none', background: '#10b981', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                >
                  Clear Codes &amp; Reset ECU
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DYNO PERFORMANCE TEST */}
        {activeTab === 'dyno' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div style={{ background: innerCardBg, border: `1px solid ${innerCardBorder}`, borderRadius: 18, padding: '18px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: textSub, textTransform: 'uppercase' }}>ENGINE RPM</div>
                <div style={{ fontSize: 38, fontWeight: 900, color: dynoRpm > 7500 ? '#ef4444' : '#fff', marginTop: 4 }}>
                  {dynoRpm}
                </div>
              </div>
              <div style={{ background: innerCardBg, border: `1px solid ${innerCardBorder}`, borderRadius: 18, padding: '18px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: textSub, textTransform: 'uppercase' }}>MAX HORSEPOWER</div>
                <div style={{ fontSize: 38, fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>
                  {dynoHp} <span style={{ fontSize: 18 }}>BHP</span>
                </div>
              </div>
              <div style={{ background: innerCardBg, border: `1px solid ${innerCardBorder}`, borderRadius: 18, padding: '18px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: textSub, textTransform: 'uppercase' }}>TORQUE OUTPUT</div>
                <div style={{ fontSize: 38, fontWeight: 900, color: '#38bdf8', marginTop: 4 }}>
                  {dynoTorque} <span style={{ fontSize: 18 }}>NM</span>
                </div>
              </div>
            </div>

            {/* Dyno Visual Graph */}
            <div
              style={{
                height: 220,
                background: isLight ? '#fff' : 'rgba(0,0,0,0.4)',
                border: `1px solid ${innerCardBorder}`,
                borderRadius: 18,
                padding: '16px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 12, left: 16, fontSize: 12, fontWeight: 800, color: textSub }}>
                CHASSIS DYNAMOMETER TELEMETRY GRAPH
              </div>

              {/* Simulated Dyno Curve Bars */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, width: '100%' }}>
                {Array.from({ length: 28 }).map((_, i) => {
                  const barH = isDynoRunning || dynoDone
                    ? Math.sin((i / 28) * Math.PI * 0.85) * (dynoHp / 1015) * 100
                    : 10;
                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: `${Math.max(6, barH)}%`,
                        borderRadius: '4px 4px 0 0',
                        background: i > 22 ? '#ef4444' : i > 14 ? '#f59e0b' : '#3b82f6',
                        transition: 'height 0.1s ease-out',
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Start Dyno Pull Button */}
            <button
              onClick={runDynoTest}
              disabled={isDynoRunning}
              style={{
                padding: '16px',
                borderRadius: 16,
                border: 'none',
                background: isDynoRunning
                  ? 'rgba(239,68,68,0.3)'
                  : 'linear-gradient(135deg, #ef4444, #b91c1c)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 900,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                cursor: isDynoRunning ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: isDynoRunning ? 'none' : '0 4px 20px rgba(239,68,68,0.5)',
              }}
            >
              <Gauge size={20} />
              <span>{isDynoRunning ? 'Running Wide-Open Throttle Dyno Pull...' : dynoDone ? 'Re-Run Dyno Test' : 'Start Wide-Open Throttle Dyno Test'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
