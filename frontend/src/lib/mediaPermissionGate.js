import { isCapacitorApp } from './platform';
import {
  ensureNativeMediaPermissions,
  ensureNativeCameraPermissions,
  ensureNativePhotoPermissions,
  openNativeAppSettings
} from './nativeMedia';

// Camera/mic permissions for calls & video rooms — invokes native Android
// system dialogs. If denied or blocked, directly opens native Android App Settings.
export async function requestMediaAccess() {
  if (!isCapacitorApp()) return true;
  const granted = await ensureNativeMediaPermissions();
  if (!granted) {
    await openNativeAppSettings();
    return false;
  }
  return true;
}

// Camera permission for in-app camera capture in chat — invokes native Android
// system prompt (Screenshot 2: "Allow SahaPlay to take pictures and record video?").
export async function requestCameraAccess() {
  const granted = await ensureNativeCameraPermissions();
  if (!granted && isCapacitorApp()) {
    await openNativeAppSettings();
    return false;
  }
  return granted;
}

// Photo & video permissions for gallery & file attachment pickers — invokes
// native Android system prompt (Screenshot 1: "Allow SahaPlay to access photos and videos on this device?").
export async function requestPhotoAccess() {
  const granted = await ensureNativePhotoPermissions();
  if (!granted && isCapacitorApp()) {
    await openNativeAppSettings();
    return false;
  }
  return granted;
}
