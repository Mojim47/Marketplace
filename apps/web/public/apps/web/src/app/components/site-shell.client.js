'use client';
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from 'react/jsx-runtime';
import { useEffect, useState } from 'react';
import { OfflineClient } from '../(fa)/offline-client';
import { Footer } from '../../../../../libs/ui/src/components/layout/Footer';
import { Header } from '../../../../../libs/ui/src/components/layout/Header';
export function SiteShell({ children, direction, skipLabel, mainTestId }) {
  const [mode, setMode] = useState('light');
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('royal-mode') : null;
    if (saved) setMode(saved);
  }, []);
  const handleMode = (nextMode) => {
    setMode(nextMode);
    try {
      localStorage.setItem('royal-mode', nextMode);
    } catch {
      /* ignore storage errors */
    }
  };
  return _jsxs(_Fragment, {
    children: [
      _jsx('a', {
        href: '#main',
        className: 'skip-link',
        style: {
          position: 'absolute',
          left: '-999px',
          top: '-999px',
          background: '#fff',
          color: '#000',
          padding: '8px 12px',
          borderRadius: 4,
          boxShadow: '0 0 0 2px #000',
        },
        onFocus: (e) => {
          e.currentTarget.style.left = '8px';
          e.currentTarget.style.top = '8px';
        },
        onBlur: (e) => {
          e.currentTarget.style.left = '-999px';
          e.currentTarget.style.top = '-999px';
        },
        children: skipLabel,
      }),
      _jsx('script', {
        dangerouslySetInnerHTML: {
          __html: `try{window.trustedTypes?.createPolicy('appPolicy',{createHTML:(s)=>s,createScript:(s)=>s,createScriptURL:(s)=>s});}catch(e){}`,
        },
      }),
      _jsx(OfflineClient, {}),
      _jsx(Header, { mode: mode, onMode: handleMode }),
      _jsx('main', {
        id: 'main',
        'data-testid': mainTestId,
        dir: direction,
        style: { direction, minHeight: '60vh' },
        children: children,
      }),
      _jsx(Footer, {}),
    ],
  });
}
//# sourceMappingURL=site-shell.client.js.map
