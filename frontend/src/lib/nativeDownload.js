/**
 * nativeDownload.js
 *
 * Every "Save"/download button across the app (lightbox, file-card,
 * voice-note) used the same plain-browser trick: fetch the blob, spin up a
 * throwaway <a download> element, click it. That's genuinely all a real
 * browser tab needs — the OS's own download manager/notification takes it
 * from there, which is why "through browser it is downloading" already
 * worked with zero code here.
 *
 * Reported live, split by platform:
 *  - Tauri (.exe): the file DOES land on disk (WebView2 honors the
 *    `download` attribute like a real browser) — it's just completely
 *    silent, no toast, nothing telling the user it finished.
 *  - Capacitor (Android APK): the same trick does NOT work at all. Android
 *    WebViews don't implement the `download` attribute the way a real
 *    browser tab or WebView2 does — there's no download manager hook here,
 *    so the click silently does nothing (the previous code's bare `catch
 *    {}` swallowed whatever error that produced, which is why it looked
 *    like "not even downloading" rather than an explicit failure).
 *
 * Talks to the native Filesystem plugin off the raw window.Capacitor.Plugins
 * proxy, NOT `import { Filesystem } from '@capacitor/filesystem'` — same
 * reason every other native bridge in this file's neighbors (nativePush.js)
 * does: @capacitor/filesystem is only ever installed transiently inside the
 * CI Android build job (see android-capacitor-build.yml), never a real
 * frontend dependency, so a real import of it would fail to resolve when
 * THIS repo's own web bundle builds. 'DOCUMENTS' is @capacitor/filesystem's
 * Directory enum's own runtime string value for Directory.Documents —
 * passed literally so no enum import is needed for a single constant.
 */
import { isCapacitorApp, isTauriApp } from './platform';

const filesystemPlugin = () => (isCapacitorApp() ? window.Capacitor?.Plugins?.Filesystem : null);

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Saves an already-fetched Blob to the device and (Tauri/Capacitor only)
 * shows a confirmation toast. `toast` is the caller's own react-hot-toast
 * import — passed in rather than imported here so this stays a plain
 * utility, not a component with its own toast styling opinions.
 *
 * Returns true/false so callers that track upload/download-in-progress UI
 * state can react to a real failure instead of assuming success.
 */
export async function downloadBlobToDevice(blob, filename, toast) {
  const safeName = filename || `download_${Date.now()}`;

  const fs = filesystemPlugin();
  if (fs) {
    try {
      const base64Data = await blobToBase64(blob);
      await fs.writeFile({
        path: safeName,
        data: base64Data,
        directory: 'DOCUMENTS',
        recursive: true,
      });
      toast?.success?.(`Saved "${safeName}" to Documents`);
      return true;
    } catch (e) {
      console.error('[nativeDownload] Capacitor Filesystem save failed:', e);
      toast?.error?.('Download failed');
      return false;
    }
  }

  // Tauri and plain browser both already handle this correctly via the
  // `download` attribute — only Tauri needs an explicit toast added on top
  // (a browser tab already shows its own native download indicator).
  try {
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Freed on a delay, not immediately — revoking right after click() has
    // been known to race the browser/WebView's own read of the blob on
    // some platforms, cancelling the very download this just started.
    setTimeout(() => { try { URL.revokeObjectURL(objectUrl); } catch {} }, 30000);
    if (isTauriApp()) toast?.success?.(`Downloaded "${safeName}"`);
    return true;
  } catch (e) {
    console.error('[nativeDownload] browser download failed:', e);
    toast?.error?.('Download failed');
    return false;
  }
}
