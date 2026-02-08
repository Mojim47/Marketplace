import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import '../(fa)/globals.css';
import { SiteShell } from '../components/site-shell.client';
export const metadata = { title: 'Nextgen Marketplace', description: 'Seller portal' };
export default function RootLayout({ children }) {
  return _jsxs('html', {
    lang: 'en',
    dir: 'ltr',
    children: [
      _jsxs('head', {
        children: [
          _jsx('link', {
            rel: 'preload',
            as: 'font',
            href: '/fonts/inter.woff2',
            type: 'font/woff2',
            crossOrigin: 'anonymous',
          }),
          _jsx('link', {
            rel: 'preload',
            as: 'font',
            href: '/fonts/vazirmatn.woff2',
            type: 'font/woff2',
            crossOrigin: 'anonymous',
          }),
          _jsx('link', { rel: 'manifest', href: '/manifest.webmanifest' }),
          _jsx('style', {
            children: `@font-face{font-family:Inter;src:url(/fonts/inter.woff2) format('woff2');font-display:swap}`,
          }),
          _jsx('style', {
            children: `@font-face{font-family:Vazirmatn;src:url(/fonts/vazirmatn.woff2) format('woff2');font-display:swap}`,
          }),
        ],
      }),
      _jsx('body', {
        style: {
          margin: 0,
          fontFamily: 'Inter, Vazirmatn, system-ui',
          background: 'var(--color-bg)',
          color: 'var(--color-fg)',
        },
        children: _jsx(SiteShell, {
          direction: 'ltr',
          skipLabel: 'Skip to main content',
          children: children,
        }),
      }),
    ],
  });
}
//# sourceMappingURL=layout.js.map
