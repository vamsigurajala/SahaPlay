import { isCapacitorApp } from './platform';

// Bridges the native SahaplayMedia plugin's MediaProjection-based screen
// capture (see capacitor-android-plugin/SahaplayScreenCaptureService.java)
// into a real MediaStream the existing WebRTC screenshare code in Room.jsx
// can broadcast unchanged. getDisplayMedia() is undefined inside the
// Android WebView this app otherwise runs on — not a support gap, a hard
// engine limitation — so this bypasses it entirely: native code captures
// the screen and streams JPEG frames back over the bridge, and
// getNativeScreenCaptureStream() draws each one onto a <canvas>, then
// canvas.captureStream() turns that into a genuine MediaStream. This is the
// exact same "draw frames onto a canvas, capture the canvas" trick
// Room.jsx's screenshare enhancement-filter pipeline already uses, so it
// drops straight into the existing peer-connection code with zero changes
// there.
const plugin = () => (isCapacitorApp() ? window.Capacitor?.Plugins?.SahaplayMedia : null);

// Resolves once the user has granted the OS screen-capture permission and
// the native foreground service has started (see requestScreenCapture in
// SahaplayMediaPlugin.java) — rejects if denied/cancelled.
function requestNativeScreenCapture() {
  const p = plugin();
  if (!p) return Promise.reject(new Error('Native screen capture unavailable'));
  return p.requestScreenCapture();
}

function stopNativeScreenCapture() {
  plugin()?.stopScreenCapture?.().catch(() => {});
}

// addListener()'s return shape isn't consistent across Capacitor
// versions/platforms — some return the PluginListenerHandle synchronously,
// others return a Promise<PluginListenerHandle>. Assuming it was always a
// Promise ("r.addListener(...).then is not a function") was the bug that
// broke every screen-share attempt outright: the native capture (confirmed
// by the capture notification) had already started successfully by the
// time this threw, so nothing about the native side needed fixing — just
// this call needed to handle either shape.
function removeListenerSafe(handleOrPromise) {
  if (!handleOrPromise) return;
  if (typeof handleOrPromise.remove === 'function') { handleOrPromise.remove(); return; }
  if (typeof handleOrPromise.then === 'function') {
    handleOrPromise.then((h) => h?.remove?.()).catch(() => {});
  }
}

// Resolves with { stream, cleanup } once the first native frame has
// arrived and sized the canvas. `cleanup` removes the frame listener and
// stops the native capture — call it from stopScreenshare().
export async function getNativeScreenCaptureStream({ onUnexpectedStop } = {}) {
  await requestNativeScreenCapture();

  const p = plugin();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  let started = false;
  let settled = false;
  let haveFrame = false;
  let rafId = 0;

  // Native frames arrive over the Capacitor bridge at whatever cadence the
  // MediaProjection encoder + base64 hop can manage — often bursty and well
  // under the capture fps. canvas.captureStream() only emits a non-black
  // frame for a tick where the canvas was actually painted, so drawing only
  // inside img.onload left the WebRTC track mostly black on the viewer side.
  // A steady rAF loop re-blits the latest decoded frame every tick so the
  // captured stream always has fresh pixels regardless of bridge jitter.
  const pump = () => {
    if (haveFrame) {
      try { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); } catch {}
    }
    rafId = requestAnimationFrame(pump);
  };

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      removeListenerSafe(frameListenerHandle);
      removeListenerSafe(stopListenerHandle);
      stopNativeScreenCapture();
    };

    img.onload = () => {
      if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
        canvas.width = img.naturalWidth || canvas.width || 1280;
        canvas.height = img.naturalHeight || canvas.height || 720;
      }
      haveFrame = true;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (!started) {
        started = true;
        settled = true;
        rafId = requestAnimationFrame(pump);
        const stream = canvas.captureStream(15);
        resolve({ stream, cleanup });
      }
    };

    const frameListenerHandle = p.addListener('screenFrame', (frame) => {
      if (frame?.data) img.src = `data:image/jpeg;base64,${frame.data}`;
    });

    const stopListenerHandle = p.addListener('screenCaptureStopped', () => {
      // Fires when the user stops sharing from the OS's own capture
      // indicator rather than through our UI — the native side is already
      // torn down, this just needs to be reflected on the JS side too.
      cleanup();
      onUnexpectedStop?.();
    });

    // Safety net — if no frame ever arrives (capture failed to start on the
    // native side for some reason), don't leave the caller hanging forever.
    setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error('No frames received from native screen capture'));
      }
    }, 8000);
  });
}
