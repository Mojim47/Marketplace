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

  return null;
}

