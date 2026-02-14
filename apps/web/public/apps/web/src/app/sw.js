// Service Worker for Performance & Offline (IndexedDB + Cache API)
// Built for full offline (HTML shell + static assets + dynamic JSON stubs)
/// <reference lib="webworker" />
const VERSION = 'v1-performance';
const ASSET_CACHE = `assets-${VERSION}`;
const DATA_CACHE = `data-${VERSION}`;
// List of core assets to precache (shell)
const CORE = ['/', '/favicon.ico', '/fonts/vazirmatn.woff2', '/fonts/inter.woff2'];
self.addEventListener('install', (event) => {
  const swEvent = event;
  swEvent.waitUntil(
    caches
      .open(ASSET_CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (event) => {
  const swEvent = event;
  swEvent.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => ![ASSET_CACHE, DATA_CACHE].includes(k)).map((k) => caches.delete(k))
      );
      self.clients.claim();
    })()
  );
});
// IndexedDB helper for opaque JSON caching
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('nextgen-sw', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('json')) {
        db.createObjectStore('json');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('json', 'readonly');
      const store = tx.objectStore('json');
      const g = store.get(key);
      g.onsuccess = () => resolve(g.result);
      g.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}
async function idbPut(key, value) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('json', 'readwrite');
      const store = tx.objectStore('json');
      const p = store.put(value, key);
      p.onsuccess = () => resolve();
      p.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}
self.addEventListener('fetch', (event) => {
  const fe = event;
  const url = new URL(fe.request.url);
  if (fe.request.method !== 'GET') {
    return;
  }
  // API JSON caching via IndexedDB (same-origin only)
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) {
    fe.respondWith(
      (async () => {
        try {
          const networkResp = await fetch(fe.request);
          if (networkResp.ok) {
            const clone = networkResp.clone();
            const json = await clone.json();
            await idbPut(url.pathname + url.search, json);
            return networkResp;
          }
          // fallback to db
          const cached = await idbGet(url.pathname + url.search);
          if (cached) {
            return new Response(JSON.stringify(cached), {
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return networkResp;
        } catch {
          const cached = await idbGet(url.pathname + url.search);
          if (cached) {
            return new Response(JSON.stringify(cached), {
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response(JSON.stringify({ offline: true }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          });
        }
      })()
    );
    return;
  }
  // Static asset cache-first strategy
  if (url.origin === location.origin) {
    fe.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const match = await cache.match(fe.request);
        if (match) {
          return match;
        }
        try {
          const fetched = await fetch(fe.request);
          if (fetched.ok && fetched.type === 'basic') {
            cache.put(fe.request, fetched.clone());
          }
          return fetched;
        } catch {
          // offline fallback: root shell
          if (url.pathname === '/' || url.pathname === '/index.html') {
            const shell = await cache.match('/');
            return shell || new Response('Offline', { status: 200 });
          }
          return new Response('Offline', { status: 200 });
        }
      })()
    );
  }
});
export {};
//# sourceMappingURL=sw.js.map
