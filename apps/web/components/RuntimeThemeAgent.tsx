'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function resolveIntent(pathname: string, query: string): 'high' | 'normal' {
  if (pathname.startsWith('/checkout') || pathname.startsWith('/cart') || pathname.startsWith('/orders')) {
    return 'high';
  }
  if (query.trim().length >= 3) {
    return 'high';
  }
  return 'normal';
}

function resolveAccent(intent: 'high' | 'normal', hour: number): 'emerald' | 'amber' {
  if (intent === 'high') {
    return 'emerald';
  }
  return hour >= 18 ? 'amber' : 'emerald';
}

export function RuntimeThemeAgent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => root.setAttribute('data-theme', media.matches ? 'dark' : 'light');
    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const q = searchParams.get('q') ?? '';
    const intent = resolveIntent(pathname, q);
    const accent = resolveAccent(intent, new Date().getHours());
    root.setAttribute('data-intent', intent);
    root.setAttribute('data-accent', accent);
  }, [pathname, searchParams]);

  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;

    const onPointerMove = (event: PointerEvent) => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      frame = requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth) * 100;
        const y = (event.clientY / window.innerHeight) * 100;
        root.style.setProperty('--mx', `${x.toFixed(2)}%`);
        root.style.setProperty('--my', `${y.toFixed(2)}%`);
      });
    };

    root.style.setProperty('--mx', '72%');
    root.style.setProperty('--my', '18%');
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, []);

  return null;
}
