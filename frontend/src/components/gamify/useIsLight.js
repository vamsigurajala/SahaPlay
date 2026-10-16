import { useEffect, useState } from 'react';

// True while the app is in light mode (App.jsx sets data-theme="light" on <html>).
const read = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';

export function useIsLight() {
  const [light, setLight] = useState(read);
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return undefined;
    const obs = new MutationObserver(() => setLight(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return light;
}
