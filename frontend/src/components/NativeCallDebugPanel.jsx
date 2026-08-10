import React, { useEffect, useRef, useState } from 'react';
import { encodeBase64 } from 'tweetnacl-util';
import { isCapacitorApp } from '../lib/platform';
import { useCrypto } from '../contexts/CryptoContext';
import { API } from '../lib/api';
import {
  isNativeCallEngineAvailable, initNativeCallEngine, setNativeCallSecretKey,
  startNativeCall, endNativeCall, onNativeCallEngineStatus,
} from '../lib/nativeCallEngine';

// Phase 2 debug-only panel for the native calling engine (see the plan doc
// and CallEngineService.java's class comment). Lets a real device manually
// drive a native call:invite -> accept -> offer/answer/ICE round trip
// against a live callee, with a status log, to verify the NaCl crypto and
// WebRTC signaling actually interoperate with the existing web client
// before any real UI is built on top of it. Renders nothing outside the
// native Android app. Intentionally rough — "no polish" is explicit scope
// for this phase.
export default function NativeCallDebugPanel() {
  const { keyPair } = useCrypto();
  const [calleeUsername, setCalleeUsername] = useState('');
  const [log, setLog] = useState([]);
  const [initialized, setInitialized] = useState(false);
  const unsubRef = useRef(null);

  useEffect(() => {
    return () => { unsubRef.current?.(); };
  }, []);

  if (!isCapacitorApp() || !isNativeCallEngineAvailable()) return null;

  const appendLog = (status) => setLog(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()} — ${status}`]);

  const handleInit = async () => {
    const token = localStorage.getItem('watch_token');
    const username = localStorage.getItem('watch_username');
    if (!token || !username) { appendLog('no token/username in localStorage'); return; }
    if (!keyPair?.secretKey) { appendLog('crypto keypair not ready yet'); return; }
    unsubRef.current?.();
    unsubRef.current = onNativeCallEngineStatus(appendLog);
    await initNativeCallEngine(API, token, username);
    await setNativeCallSecretKey(encodeBase64(keyPair.secretKey));
    setInitialized(true);
    appendLog('init complete');
  };

  const handleStartCall = async () => {
    if (!calleeUsername.trim()) return;
    await startNativeCall(calleeUsername.trim(), 'voice');
  };

  const handleEndCall = async () => {
    await endNativeCall();
  };

  return (
    <div style={{
      margin: '24px 16px', padding: 16, borderRadius: 12,
      border: '1px dashed rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.06)',
      fontSize: 12, fontFamily: 'monospace',
    }}>
      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: '#ef4444' }}>
        Native Call Engine — Phase 2 Debug (temporary)
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <button onClick={handleInit} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#334155', color: '#fff', cursor: 'pointer' }}>
          1. Init engine
        </button>
        <input
          value={calleeUsername}
          onChange={(e) => setCalleeUsername(e.target.value)}
          placeholder="callee username"
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'inherit', minWidth: 140 }}
        />
        <button onClick={handleStartCall} disabled={!initialized} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', cursor: initialized ? 'pointer' : 'not-allowed', opacity: initialized ? 1 : 0.5 }}>
          2. Start voice call
        </button>
        <button onClick={handleEndCall} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer' }}>
          End call
        </button>
      </div>
      <div style={{ maxHeight: 160, overflowY: 'auto', background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 8, lineHeight: 1.6 }}>
        {log.length === 0 ? <span style={{ opacity: 0.5 }}>No status yet — tap "Init engine" first.</span> : log.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
}
