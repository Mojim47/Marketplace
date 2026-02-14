import Document, { Head, Html, Main, NextScript } from 'next/document';
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps };
  }
  render() {
    return _jsxs(Html, {
      lang: 'fa',
      dir: 'rtl',
      children: [
        _jsxs(Head, {
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
            _jsx('style', {
              children: `@font-face{font-family:Vazirmatn;src:url(/fonts/vazirmatn.woff2) format('woff2');font-display:swap}`,
            }),
            _jsx('style', {
              children: `@font-face{font-family:Inter;src:url(/fonts/inter.woff2) format('woff2');font-display:swap}`,
            }),
          ],
        }),
        _jsxs('body', { children: [_jsx(Main, {}), _jsx(NextScript, {})] }),
      ],
    });
  }
}
//# sourceMappingURL=_document.js.map
