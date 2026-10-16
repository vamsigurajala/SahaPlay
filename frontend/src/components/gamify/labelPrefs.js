import { useSyncExternalStore } from 'react';

// "Hide names and dots": one switch in the right-hand menu that hides room names, shop
// signs, the pulsing tap dots and the little action chips, and shows them again when
// pressed again. It is remembered on this device.

const KEY = 'sp_gamify_hide_labels';
let hidden = false;
try { hidden = localStorage.getItem(KEY) === 'true'; } catch { /* storage unavailable */ }
const listeners = new Set();

export const getHideLabels = () => hidden;
export function setHideLabels(next) {
  hidden = !!next;
  try { localStorage.setItem(KEY, String(hidden)); } catch { /* ignore */ }
  listeners.forEach(l => l());
}
export const toggleHideLabels = () => setHideLabels(!hidden);
export const useHideLabels = () => useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, getHideLabels, getHideLabels);
