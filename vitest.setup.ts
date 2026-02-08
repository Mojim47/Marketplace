// Conditionally import testing-library and React for DOM tests
// Using dynamic imports with string variables to prevent Vite's static analysis from failing

const testingLibraryModule = '@testing-library/jest-dom/vitest';
const reactModule = 'react';

// Setup testing library if available
try {
  await import(/* @vite-ignore */ testingLibraryModule);
} catch {
  // @testing-library/jest-dom not available, skip
}

// Ensure legacy JSX runtime tests still see a React global.
try {
  const React = await import(/* @vite-ignore */ reactModule);
  const globalWithReact = globalThis as typeof globalThis & { React?: typeof import('react') };
  globalWithReact.React = React.default || React;
} catch {
  // React not available, skip
}

// JSDOM lacks matchMedia; provide a deterministic stub for UI tests.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  });
}

if (typeof window !== 'undefined') {
  const createMemoryStorage = (): Storage => {
    const store = new Map<string, string>();
    return {
      get length() {
        return store.size;
      },
      clear() {
        store.clear();
      },
      getItem(key: string) {
        return store.has(key) ? store.get(key)! : null;
      },
      key(index: number) {
        return Array.from(store.keys())[index] ?? null;
      },
      removeItem(key: string) {
        store.delete(key);
      },
      setItem(key: string, value: string) {
        store.set(key, String(value));
      },
    };
  };
  Object.defineProperty(window, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true,
  });
  Object.defineProperty(window, 'sessionStorage', {
    value: createMemoryStorage(),
    configurable: true,
  });
}
