import { readCart } from '@/lib/cart';
import { generateMetadata } from '@/lib/seo';
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
export const metadata = generateMetadata({ title: 'سبد خرید' });
export default async function CartPage() {
  const cart = await readCart();
  const uniqueItems = cart.length;
  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
  return _jsxs('div', {
    dir: 'rtl',
    className: 'container mx-auto p-4',
    children: [
      _jsxs('h1', {
        className: 'text-2xl font-bold',
        children: ['\u0633\u0628\u062F \u062E\u0631\u06CC\u062F (', uniqueItems, ')'],
      }),
      _jsxs('p', {
        className: 'text-sm text-gray-500',
        children: ['\u0645\u062C\u0645\u0648\u0639 \u0627\u0642\u0644\u0627\u0645: ', totalUnits],
      }),
      cart.length
        ? _jsx('ul', {
            className: 'space-y-2 mt-4',
            children: cart.map((item) =>
              _jsxs(
                'li',
                {
                  className: 'p-3 border rounded shadow-sm',
                  'aria-label': `product-${item.productId}`,
                  children: [
                    _jsxs('div', {
                      className: 'font-medium',
                      children: ['\u0645\u062D\u0635\u0648\u0644 #', item.productId],
                    }),
                    _jsxs('div', {
                      className: 'text-sm text-gray-600',
                      children: ['\u062A\u0639\u062F\u0627\u062F: ', item.quantity],
                    }),
                  ],
                },
                item.productId
              )
            ),
          })
        : _jsx('p', {
            className: 'mt-4 text-gray-500',
            children:
              '\u0633\u0628\u062F \u0634\u0645\u0627 \u062E\u0627\u0644\u06CC \u0627\u0633\u062A.',
          }),
    ],
  });
}
//# sourceMappingURL=page.js.map
