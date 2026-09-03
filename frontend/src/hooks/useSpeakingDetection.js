import { useEffect, useRef, useState } from 'react';

// Real-time "who's actually talking right now" for a group call's grid tiles
// — distinct from a participant's mic just being un-muted (which the grid
// already showed via a pulsing avatar), this measures actual audio level
// per stream via Web Audio's AnalyserNode. A short hangover keeps the
// highlight from flickering off during the brief silences between words.
const SPEAKING_THRESHOLD = 12; // 0-255 average byte-frequency level
const HANGOVER_MS = 350;

// `streamsByKey` is a plain { key: MediaStream } object, rebuilt fresh every
// render by the caller — this hook only creates a new analyser the first
// time it sees a given key (tracked in analysersRef, not stream identity),
// so a new object reference every render doesn't rebuild the audio graph.
export function useSpeakingDetection(streamsByKey) {
  const [speaking, setSpeaking] = useState(() => new Set());
  const analysersRef = useRef(new Map()); // key -> { analyser, dataArray, source, lastAboveAt }
  const audioCtxRef = useRef(null);

  useEffect(() => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return undefined;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
    const ctx = audioCtxRef.current;
    ctx.resume?.().catch(() => {});

    const currentKeys = new Set(Object.keys(streamsByKey || {}));
    for (const key of [...analysersRef.current.keys()]) {
      if (!currentKeys.has(key)) {
        try { analysersRef.current.get(key).source.disconnect(); } catch {}
        analysersRef.current.delete(key);
      }
    }
    for (const [key, stream] of Object.entries(streamsByKey || {})) {
      if (!stream || analysersRef.current.has(key) || stream.getAudioTracks().length === 0) continue;
      try {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        analysersRef.current.set(key, { analyser, source, dataArray: new Uint8Array(analyser.frequencyBinCount), lastAboveAt: 0 });
      } catch {}
    }

    let raf;
    const tick = () => {
      const now = Date.now();
      const next = new Set();
      for (const [key, entry] of analysersRef.current) {
        entry.analyser.getByteFrequencyData(entry.dataArray);
        let sum = 0;
        for (let i = 0; i < entry.dataArray.length; i++) sum += entry.dataArray[i];
        const avg = sum / entry.dataArray.length;
        if (avg > SPEAKING_THRESHOLD) entry.lastAboveAt = now;
        if (now - entry.lastAboveAt < HANGOVER_MS) next.add(key);
      }
      setSpeaking(prev => {
        if (prev.size === next.size && [...prev].every(k => next.has(k))) return prev;
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [streamsByKey]);

  // Full audio-graph teardown only on unmount (not per dependency-change
  // above, which would tear down and rebuild on every render).
  useEffect(() => () => {
    for (const entry of analysersRef.current.values()) { try { entry.source.disconnect(); } catch {} }
    analysersRef.current.clear();
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  return speaking;
}
