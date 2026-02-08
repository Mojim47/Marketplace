'use client';

import { trackUiEvent, type UiEventName } from '@nextgen/observability';

declare global {
  interface Window {
    __uiEvents?: Array<ReturnType<typeof trackUiEvent>>;
  }
}

export function emitUiEvent(
  name: UiEventName,
  payload: Record<string, unknown>,
  traceId?: string,
) {
  const event = trackUiEvent(name, payload, { traceId });

  if (typeof window !== 'undefined') {
    window.__uiEvents = window.__uiEvents ?? [];
    window.__uiEvents.push(event);
  }

  if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    const blob = new Blob([JSON.stringify(event)], { type: 'application/json' });
    navigator.sendBeacon('/api/ui-events', blob);
  } else if (typeof fetch !== 'undefined') {
    fetch('/api/ui-events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => undefined);
  }

  return event;
}
