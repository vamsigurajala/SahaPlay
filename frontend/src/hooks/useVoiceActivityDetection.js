import { useEffect } from 'react';

const SPEAK_THRESHOLD = 22;
const SPEAK_CONFIRM_MS = 200;
const SILENCE_CONFIRM_MS = 700;

// Attaches a Web Audio analyser to an existing MediaStream to detect speech.
// Does NOT call getUserMedia — the caller must supply the stream.
export function useVoiceActivityDetection({ micStream, enabled, onSpeakingChange }) {
  useEffect(() => {
    if (!enabled || !micStream) return;

    let audioCtx;
    try {
      audioCtx = new AudioContext();
    } catch {
      return;
    }

    const source = audioCtx.createMediaStreamSource(micStream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let speaking = false;
    let aboveThresholdSince = null;
    let belowThresholdSince = null;
    let rafId;

    function tick() {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const now = performance.now();

      if (avg > SPEAK_THRESHOLD) {
        belowThresholdSince = null;
        if (!aboveThresholdSince) aboveThresholdSince = now;
        if (!speaking && now - aboveThresholdSince > SPEAK_CONFIRM_MS) {
          speaking = true;
          onSpeakingChange(true);
        }
      } else {
        aboveThresholdSince = null;
        if (!belowThresholdSince) belowThresholdSince = now;
        if (speaking && now - belowThresholdSince > SILENCE_CONFIRM_MS) {
          speaking = false;
          onSpeakingChange(false);
        }
      }

      rafId = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      source.disconnect();
      audioCtx.close();
      if (speaking) {
        // Release user from server speaking set if they were mid-speech
        onSpeakingChange(false);
      }
    };
  }, [enabled, micStream, onSpeakingChange]);
}
