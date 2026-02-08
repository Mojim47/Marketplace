import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { SiteShell } from '../components/site-shell.client';
import './globals.css';
export const metadata = { title: 'بازار نسل بعد', description: 'سامانه فروشندگان' };
export default function RootLayout({ children }) {
  return _jsxs('html', {
    lang: 'fa',
    dir: 'rtl',
    children: [
      _jsxs('head', {
        children: [
          _jsx('link', {
            rel: 'preload',
            as: 'font',
            href: '/fonts/vazirmatn.woff2',
            type: 'font/woff2',
            crossOrigin: 'anonymous',
          }),
          _jsx('link', {
            rel: 'preload',
            as: 'font',
            href: '/fonts/inter.woff2',
            type: 'font/woff2',
            crossOrigin: 'anonymous',
          }),
          _jsx('link', { rel: 'manifest', href: '/manifest.webmanifest' }),
          _jsx('style', {
            children: `@font-face{font-family:Vazirmatn;src:url(/fonts/vazirmatn.woff2) format('woff2');font-display:swap}`,
          }),
          _jsx('style', {
            children: `@font-face{font-family:Inter;src:url(/fonts/inter.woff2) format('woff2');font-display:swap}`,
          }),
        ],
      }),
      _jsx('body', {
        style: {
          margin: 0,
          fontFamily: 'Vazirmatn, Inter, system-ui',
          background: 'var(--color-bg)',
          color: 'var(--color-fg)',
        },
        children: _jsx(SiteShell, {
          direction: 'rtl',
          skipLabel:
            '\u067E\u0631\u0634 \u0628\u0647 \u0645\u062D\u062A\u0648\u0627\u06CC \u0627\u0635\u0644\u06CC',
          mainTestId: 'rtl-root',
          children: children,
        }),
      }),
    ],
  });
}
//# sourceMappingURL=layout.js.map
