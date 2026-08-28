import { isCapacitorApp } from './platform';
import {
  ensureNativeMediaPermissions,
  ensureNativeCameraPermissions,
  ensureNativePhotoPermissions
} from './nativeMedia';

// Camera/mic permissions for calls & video rooms — invokes native Android
// system dialogs.
export async function requestMediaAccess() {
  if (!isCapacitorApp()) return true;
  return await ensureNativeMediaPermissions();
}

// Camera permission for in-app camera capture in chat — invokes native Android
// system prompt (Screenshot: "Allow SahaPlay to take pictures and record video?").
export async function requestCameraAccess() {
  return await ensureNativeCameraPermissions();
}

// Photo & video permissions for gallery & file attachment pickers — invokes
// native Android system prompt (Screenshot: "Allow SahaPlay to access photos and videos on this device?").
export async function requestPhotoAccess() {
  return await ensureNativePhotoPermissions();
}
