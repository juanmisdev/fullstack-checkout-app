import '@testing-library/jest-dom';

// Node >= 22 exposes a built-in `localStorage` global that shadows the jsdom
// implementation but ships without methods (empty object). Detect that broken
// state and install a minimal in-memory fallback so tests can exercise the
// persistence logic.
const broken =
  typeof localStorage === 'undefined' || typeof localStorage.clear !== 'function';

if (broken) {
  let data: Record<string, string> = {};
  const storage: Storage = {
    get length() {
      return Object.keys(data).length;
    },
    clear: () => {
      data = {};
    },
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = String(value);
    },
    removeItem: (key: string) => {
      delete data[key];
    },
    key: (index: number) => Object.keys(data)[index] ?? null,
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}