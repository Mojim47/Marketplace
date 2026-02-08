import { jsx as _jsx } from 'react/jsx-runtime';
import '@nextgen/ui/globals.css';
import { dir } from 'i18next';
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin', 'latin-ext'], display: 'swap' });
export default function RootLayout({ children }) {
  return _jsx('html', {
    lang: 'fa',
    dir: dir('fa'),
    children: _jsx('body', { className: inter.className, children: children }),
  });
}
//# sourceMappingURL=layout.js.map
