import '@testing-library/jest-dom/vitest';
import { webcrypto } from 'node:crypto';

// jsdom has no WebCrypto; Node's matches the browser API the app uses.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
