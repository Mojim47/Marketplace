'use client';

import { useEffect, useState } from 'react';

const TRACE_KEY = 'ng_admin_trace_id';

export function useTraceId() {
  const [traceId, setTraceId] = useState<string | null>(null);

  useEffect(() => {
    let stored = sessionStorage.getItem(TRACE_KEY);
    if (!stored) {
      stored = crypto.randomUUID();
      sessionStorage.setItem(TRACE_KEY, stored);
    }
    setTraceId(stored);
    document.documentElement.dataset.traceId = stored;
  }, []);

  return traceId;
}
