import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import {
  detectLocale,
  formatCurrency,
  formatDate,
} from '../../../../../../../libs/ui/src/i18n/config';
export default function SellerDashboard() {
  const locale = detectLocale('/fa/seller/dashboard');
  const today = new Date('2025-03-21T00:00:00Z');
  const total = 12500000;
  return _jsxs('main', {
    style: { padding: 24 },
    children: [
      _jsx('h1', {
        children:
          '\u062F\u0627\u0634\u0628\u0648\u0631\u062F \u0641\u0631\u0648\u0634\u0646\u062F\u0647',
      }),
      _jsxs('section', {
        children: [
          _jsxs('div', {
            'aria-label': 'current-date',
            children: [
              '\u062A\u0627\u0631\u06CC\u062E \u0627\u0645\u0631\u0648\u0632: ',
              formatDate(today, locale),
            ],
          }),
          _jsxs('div', {
            'aria-label': 'total-sales',
            children: [
              '\u0645\u062C\u0645\u0648\u0639 \u0641\u0631\u0648\u0634: ',
              formatCurrency(total, locale),
            ],
          }),
        ],
      }),
    ],
  });
}
//# sourceMappingURL=page.js.map
