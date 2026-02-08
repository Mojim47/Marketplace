import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { generateMetadata as buildMetadata } from '@/lib/seo';
import { ARViewer } from '@nextgen/ar';
import { getProduct } from '@nextgen/types';
import dynamic from 'next/dynamic';
const CopilotButton = dynamic(() => import('./CopilotButton').then((mod) => mod.CopilotButton), {
  ssr: false,
  loading: () =>
    _jsx('button', {
      className: 'mt-4 px-3 py-1 bg-slate-100 text-slate-500 rounded text-sm',
      disabled: true,
      children:
        '\u062F\u0631 \u062D\u0627\u0644 \u0622\u0645\u0627\u062F\u0647\u200C\u0633\u0627\u0632\u06CC \u06A9\u0645\u06CC\u0627\u0631...',
    }),
});
export async function generateMetadata({ params }) {
  return buildMetadata({ title: `محصول ${params.id}` });
}
export default async function ProductPage({ params }) {
  const product = await getProduct(params.id);
  return _jsxs('div', {
    dir: 'rtl',
    className: 'container mx-auto p-4 space-y-6',
    children: [
      _jsxs('div', {
        children: [
          _jsxs('p', {
            className: 'text-xs text-slate-500',
            children: ['\u06A9\u062F \u0645\u062D\u0635\u0648\u0644: ', product.id],
          }),
          _jsx('h1', { className: 'text-2xl font-bold mt-1', children: product.name }),
          _jsx('p', { className: 'mt-2 text-slate-700 leading-7', children: product.description }),
        ],
      }),
      product.arModelId &&
        _jsxs('section', {
          children: [
            _jsx('h2', {
              className: 'text-lg font-semibold mb-2',
              children:
                '\u0645\u0634\u0627\u0647\u062F\u0647 \u062F\u0631 \u0641\u0636\u0627\u06CC \u0648\u0627\u0642\u0639\u06CC',
            }),
            _jsx(ARViewer, { modelId: product.arModelId }),
          ],
        }),
      _jsx(CopilotButton, {}),
    ],
  });
}
//# sourceMappingURL=page.js.map
