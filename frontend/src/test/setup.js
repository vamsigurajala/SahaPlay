import '@testing-library/jest-dom/vitest';

// jsdom (this suite's test environment — see vite.config.js) does not
// implement IndexedDB at all. browserDeviceUnlock.js (the "Remember this
// browser" feature) stores its device wrapper there, and its own tests
// exercise the real module code against a real IndexedDB implementation
// rather than a hand-rolled mock — this is the standard, widely-used
// polyfill for exactly that (dev/test only; never part of the production
// bundle, since nothing outside frontend/src/test imports it).
import 'fake-indexeddb/auto';
