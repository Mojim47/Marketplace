'use client';
import { useEffect } from 'react';
export function OfflineClient() {
  useEffect(() => {
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        // Best-effort register
        // @ts-ignore
        navigator.serviceWorker?.register?.('/sw.js').catch(() => {});
      }
      if (typeof indexedDB !== 'undefined') {
        // Minimal IndexedDB open for seller data cache
        const req = indexedDB.open('nextgen-seller', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('kv')) {
            db.createObjectStore('kv');
          }
        };
      }
    } catch {
      // ignore in non-browser test environments
    }
  }, []);
  return null;
}
//# sourceMappingURL=offline-client.js.map
