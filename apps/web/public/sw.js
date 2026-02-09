if (!self.define) {
  let e;
  const a = {};
  const s = (s, i) => (
    (s = new URL(`${s}.js`, i).href),
    a[s] ||
      new Promise((a) => {
        if ('document' in self) {
          const e = document.createElement('script');
          (e.src = s), (e.onload = a), document.head.appendChild(e);
        } else {
          (e = s), importScripts(s), a();
        }
      }).then(() => {
        const e = a[s];
        if (!e) {
          throw new Error(`Module ${s} didn’t register its module`);
        }
        return e;
      })
  );
  self.define = (i, c) => {
    const r = e || ('document' in self ? document.currentScript.src : '') || location.href;
    if (a[r]) {
      return;
    }
    const n = {};
    const p = (e) => s(e, r);
    const t = { module: { uri: r }, exports: n, require: p };
    a[r] = Promise.all(i.map((e) => t[e] || p(e))).then((e) => (c(...e), n));
  };
}
define(['./workbox-c05e7c83'], (e) => {
  importScripts('fallback-eAQdKaE9RGzDw6iUPwPJG.js'),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        { url: '/_next/app-build-manifest.json', revision: '6710de80bdbb0f12a14c6e2c24c2cbbf' },
        {
          url: '/_next/static/chunks/03570cf8-7093b54aebd95488.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/0437d602-885bd52983dc35a1.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/05bcfd58-45358b4591f9cc36.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/094ca9f6-3e8623987cbcb57b.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        { url: '/_next/static/chunks/1022.d8844fd417adfc38.js', revision: 'd8844fd417adfc38' },
        { url: '/_next/static/chunks/170-74449ac1fe725065.js', revision: 'eAQdKaE9RGzDw6iUPwPJG' },
        { url: '/_next/static/chunks/1783-ded3736129610537.js', revision: 'eAQdKaE9RGzDw6iUPwPJG' },
        { url: '/_next/static/chunks/1992.03c75978a6f0ddb8.js', revision: '03c75978a6f0ddb8' },
        { url: '/_next/static/chunks/2188-a5afa1016abaa3df.js', revision: 'eAQdKaE9RGzDw6iUPwPJG' },
        { url: '/_next/static/chunks/2418-6c5861bc8f1967ad.js', revision: 'eAQdKaE9RGzDw6iUPwPJG' },
        { url: '/_next/static/chunks/2461-c8b15ccb123daee6.js', revision: 'eAQdKaE9RGzDw6iUPwPJG' },
        {
          url: '/_next/static/chunks/269505af-f366c559afe9ca11.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/2bd4bdc7-277425bb53b2b97e.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        { url: '/_next/static/chunks/3723.8dff3f4ec94e4a3a.js', revision: '8dff3f4ec94e4a3a' },
        { url: '/_next/static/chunks/3983-18741ebddee73f63.js', revision: 'eAQdKaE9RGzDw6iUPwPJG' },
        { url: '/_next/static/chunks/4225-9181dbb9fd664591.js', revision: 'eAQdKaE9RGzDw6iUPwPJG' },
        {
          url: '/_next/static/chunks/44704b1c-7afb577356876eb8.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/46515caa-d3c4ab96553ea0d8.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        { url: '/_next/static/chunks/504.ffe03fd5060b65af.js', revision: 'ffe03fd5060b65af' },
        { url: '/_next/static/chunks/547.5b86efc7a49138f6.js', revision: '5b86efc7a49138f6' },
        {
          url: '/_next/static/chunks/54ad1269-aa6e3cb7d757fdad.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        { url: '/_next/static/chunks/5f20d705.0b24559cbb93075f.js', revision: '0b24559cbb93075f' },
        { url: '/_next/static/chunks/6017.976651b5bf9abb3c.js', revision: '976651b5bf9abb3c' },
        { url: '/_next/static/chunks/6038.fc29bc6a6365faf8.js', revision: 'fc29bc6a6365faf8' },
        { url: '/_next/static/chunks/6283.e1992f6efb777e71.js', revision: 'e1992f6efb777e71' },
        { url: '/_next/static/chunks/6756dbf3.3391c06b5fbc7f09.js', revision: '3391c06b5fbc7f09' },
        {
          url: '/_next/static/chunks/6ce88f8e-deda1859e11f2235.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        { url: '/_next/static/chunks/7237-8a5bc3675604974a.js', revision: 'eAQdKaE9RGzDw6iUPwPJG' },
        { url: '/_next/static/chunks/8610.025bcb06f917a245.js', revision: '025bcb06f917a245' },
        { url: '/_next/static/chunks/879bad74.d4beed6643254f0f.js', revision: 'd4beed6643254f0f' },
        { url: '/_next/static/chunks/8933-874fb0d01ecf22ac.js', revision: 'eAQdKaE9RGzDw6iUPwPJG' },
        { url: '/_next/static/chunks/897a3545.b1a7618bb4edfa83.js', revision: 'b1a7618bb4edfa83' },
        { url: '/_next/static/chunks/9295-1c4ce63fe0860cc5.js', revision: 'eAQdKaE9RGzDw6iUPwPJG' },
        { url: '/_next/static/chunks/9304-c8fdfeb49bdbfaa9.js', revision: 'eAQdKaE9RGzDw6iUPwPJG' },
        { url: '/_next/static/chunks/9772.e0c9e6379565a656.js', revision: 'e0c9e6379565a656' },
        { url: '/_next/static/chunks/9935-84c40bca269ed51d.js', revision: 'eAQdKaE9RGzDw6iUPwPJG' },
        {
          url: '/_next/static/chunks/aca69962-01bdfa2da6d0dfed.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/(admin)/analytics/page-9962d8afab5a5e74.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/(admin)/dashboard/page-9479c673df2cb6dd.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/(admin)/geo-location/page-9c71a5c828d6272f.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/(admin)/layout-2572a5d91543c8a6.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/(admin)/orders/page-4705ba200f2d6932.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/(admin)/products/page-3d132f9b0958227d.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/(admin)/seo/page-0ea56518947a545e.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/(admin)/settings/page-d09eca632a9d5844.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/(admin)/users/page-2a1fe7c92c64c815.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/(admin)/vendors/page-a78f1637ecf0a71b.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/(executor)/executor/products/page-12e44345b5787d89.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/(executor)/executor/projects/page-254be0a592dd32bd.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/(executor)/executor/quotes/page-f4e0e051bd1eaee4.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/(executor)/layout-bc7fe208fe2084ac.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/(public)/cart/page-3acd1e94a716b6b2.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/(public)/layout-cad582fdea06becb.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/(public)/product/%5Bid%5D/page-c13c129bae021587.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/_not-found/page-7c9451823a353692.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/admin/ar-generation/page-5eacebf07f3a98ab.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/admin/orders/%5Bid%5D/print/page-cc4f61f5d564d9ac.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/api-docs/page-9fe496e92ea813ff.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/b2b/network/page-77c2b3fe20465d59.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/b2b/quick-order/page-70050a410d872ff9.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/b2b/quotes/page-65ec8f63a4c6b43f.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/cart/proforma/page-559e2f4c01ed03a5.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/compare/page-eba9047d54d78a8a.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/error-9029da08af2d5315.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/executor/register/page-c1ae7d876a28b3e9.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/global-error-7a3db88df403a796.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/layout-65a22abe1de5c3fa.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/loading-d56edf90cd6f506d.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/login/page-4b4ed3440f309689.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/not-found-aa816e5bdbad6e1c.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/offline/page-c51dd1bad940e60e.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/page-944ab7b8b6951ed4.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/products/%5Bid%5D/page-b13ae94b37e01110.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/quick-buy/page-431cab4da7725299.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/register/page-7a65ffbbad26488b.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/shop/%5Bslug%5D/page-62ad5f3bf5f9d740.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/app/wishlist/page-67ccf0f20023b5a3.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        { url: '/_next/static/chunks/b481dfb5.be9c2109366786b1.js', revision: 'be9c2109366786b1' },
        {
          url: '/_next/static/chunks/bcdca0c3-6497cbd5ccfa8b0a.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/cd8265b4-508f32f535be43de.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/d460d106-9da1465cc94a1c22.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/ea039d0a-c3f1bfcb8807cd7c.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/eae6ad1b-057dd3e3ccce73f8.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/ef7687e3-9fe29e19c7699d70.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/framework-20afca218c33ed8b.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        { url: '/_next/static/chunks/main-5c2efce8a9319ad6.js', revision: 'eAQdKaE9RGzDw6iUPwPJG' },
        {
          url: '/_next/static/chunks/main-app-60a6f23cdd01a34f.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/pages/_app-3f21a1c34c886611.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/pages/_error-625106484a7139f4.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        {
          url: '/_next/static/chunks/polyfills-42372ed130431b0a.js',
          revision: '846118c33b2c0e922d7b3a7676f81f6f',
        },
        {
          url: '/_next/static/chunks/webpack-f515d434137e5874.js',
          revision: 'eAQdKaE9RGzDw6iUPwPJG',
        },
        { url: '/_next/static/css/30a03da7bd5c9424.css', revision: '30a03da7bd5c9424' },
        {
          url: '/_next/static/eAQdKaE9RGzDw6iUPwPJG/_buildManifest.js',
          revision: '80ff1fe2d0adb15df6ad9b6d244f97ac',
        },
        {
          url: '/_next/static/eAQdKaE9RGzDw6iUPwPJG/_ssgManifest.js',
          revision: 'b6652df95db52feb4daf4eca35380933',
        },
        {
          url: '/_next/static/media/19cfc7226ec3afaa-s.woff2',
          revision: '9dda5cfc9a46f256d0e131bb535e46f8',
        },
        {
          url: '/_next/static/media/21350d82a1f187e9-s.woff2',
          revision: '4e2553027f1d60eff32898367dd4d541',
        },
        {
          url: '/_next/static/media/8e9860b6e62d6359-s.p.woff2',
          revision: '01ba6c2a184b8cba08b0d57167664d75',
        },
        {
          url: '/_next/static/media/ba9851c3c22cd980-s.woff2',
          revision: '9e494903d6b0ffec1a1e14d34427d44d',
        },
        {
          url: '/_next/static/media/c5fe6dc8356a8c31-s.woff2',
          revision: '027a89e9ab733a145db70f09b8a18b42',
        },
        {
          url: '/_next/static/media/df0a9ae256c0569c-s.woff2',
          revision: 'd54db44de5ccb18886ece2fda72bdfe0',
        },
        {
          url: '/_next/static/media/e4af272ccee01ff0-s.p.woff2',
          revision: '65850a373e258f1c897a2b3d75eb74de',
        },
        {
          url: '/apps/web/app/(public)/cart/page.js',
          revision: 'a6eae1d30bb854da0f0cb9fcd39c8337',
        },
        {
          url: '/apps/web/app/(public)/cart/page.js.map',
          revision: '0f522426d012be13ab6ec2b04cfca052',
        },
        { url: '/apps/web/app/(public)/layout.js', revision: 'a7d69f45fe8c58b7be667df8e313fd13' },
        {
          url: '/apps/web/app/(public)/layout.js.map',
          revision: '479356fecd06660f300e0d7e8f7f151d',
        },
        { url: '/apps/web/app/(public)/page.js', revision: 'aec7a1865b609d189792f49f912732a5' },
        { url: '/apps/web/app/(public)/page.js.map', revision: 'bad86d4320c07f0585b5a7401f159bec' },
        {
          url: '/apps/web/app/(public)/product/[id]/CopilotButton.js',
          revision: 'd776e079cca9dbb6572f6d1a46041622',
        },
        {
          url: '/apps/web/app/(public)/product/[id]/CopilotButton.js.map',
          revision: 'dba31d009e48cfa9b10a8aa7b81269fa',
        },
        {
          url: '/apps/web/app/(public)/product/[id]/page.js',
          revision: 'e06078cc727f3f4de1771e62682e6ceb',
        },
        {
          url: '/apps/web/app/(public)/product/[id]/page.js.map',
          revision: '560d03fa4664ce8fae22589db6699577',
        },
        { url: '/apps/web/app/layout.js', revision: '8135b26272648124d34bfb6106b7aaa7' },
        { url: '/apps/web/app/layout.js.map', revision: '87475ebb254343304d01d56010680bb4' },
        { url: '/apps/web/lib/auth.js', revision: '2c8a120395644974660e472481290d29' },
        { url: '/apps/web/lib/auth.js.map', revision: 'a044122e1dee2d012524cd702342e30f' },
        { url: '/apps/web/lib/cart.js', revision: '096ef44d554bb6e9cac4f47cd3e0fbf6' },
        { url: '/apps/web/lib/cart.js.map', revision: '7977f2818df55f52e25c29d44344e229' },
        { url: '/apps/web/lib/seo.js', revision: 'b16c082e5191ce3eb08ee9f323d354af' },
        { url: '/apps/web/lib/seo.js.map', revision: 'e19f3ae042c642f212cf85f91609743d' },
        {
          url: '/apps/web/src/app/(fa)/(admin)/sena/page.js',
          revision: '91f2d6e3b31483f7662e2637e842ac75',
        },
        {
          url: '/apps/web/src/app/(fa)/(admin)/sena/page.js.map',
          revision: 'ef15b796858a6021bc82a6df02ade821',
        },
        {
          url: '/apps/web/src/app/(fa)/(admin)/sena/page.test.js',
          revision: '0f599757b73db735da92d203c9342c29',
        },
        {
          url: '/apps/web/src/app/(fa)/(admin)/sena/page.test.js.map',
          revision: 'bdeb137c15333d05d8c07886cef057f6',
        },
        {
          url: '/apps/web/src/app/(fa)/(admin)/tax-reports/page.js',
          revision: '50ff87c7d020c3718d461483798cfbf6',
        },
        {
          url: '/apps/web/src/app/(fa)/(admin)/tax-reports/page.js.map',
          revision: '24b73a6c7e2da455a6528acdc8a018bc',
        },
        {
          url: '/apps/web/src/app/(fa)/(admin)/tax-reports/page.test.js',
          revision: '894541a1739ff1e36b4195e5f0b00e15',
        },
        {
          url: '/apps/web/src/app/(fa)/(admin)/tax-reports/page.test.js.map',
          revision: 'a7d8172e98696bf25a9d0291793bf108',
        },
        {
          url: '/apps/web/src/app/(fa)/(cooperation)/marketplace/page.js',
          revision: '70e9f367f84bf59cb09383586d9fcac2',
        },
        {
          url: '/apps/web/src/app/(fa)/(cooperation)/marketplace/page.js.map',
          revision: 'a7c77b00d7d1bfc8f23ff51bef274f31',
        },
        {
          url: '/apps/web/src/app/(fa)/(cooperation)/marketplace/page.test.js',
          revision: 'c82fc7d8b120a41a41229cd5215609ad',
        },
        {
          url: '/apps/web/src/app/(fa)/(cooperation)/marketplace/page.test.js.map',
          revision: 'bc0f2a20c8c3a5b9fb8e3a60089d1bce',
        },
        {
          url: '/apps/web/src/app/(fa)/(seller)/ai/page.js',
          revision: '13b7a50bd392e9322194bb51ffbe93d8',
        },
        {
          url: '/apps/web/src/app/(fa)/(seller)/ai/page.js.map',
          revision: 'a0271c1137b85a51c3895c97302f5785',
        },
        {
          url: '/apps/web/src/app/(fa)/(seller)/ai/page.test.js',
          revision: '53ce0cca5ae30b697f38d54831ec5820',
        },
        {
          url: '/apps/web/src/app/(fa)/(seller)/ai/page.test.js.map',
          revision: 'fe54b34e1c53887cd8d63a10bf967991',
        },
        { url: '/apps/web/src/app/(fa)/layout.js', revision: 'd0c3bc202badba6ec6a0a94ba38cc211' },
        {
          url: '/apps/web/src/app/(fa)/layout.js.map',
          revision: '6332e4c8177ac811e672add881c2eeed',
        },
        {
          url: '/apps/web/src/app/(fa)/layout.test.js',
          revision: 'a83301056ce486cc815c234a31dbfd4a',
        },
        {
          url: '/apps/web/src/app/(fa)/layout.test.js.map',
          revision: 'cafea42efacd7c8f911e19dce8590ecd',
        },
        {
          url: '/apps/web/src/app/(fa)/offline-client.js',
          revision: '6123992c001c0b93ccdc0cdcac84ea3d',
        },
        {
          url: '/apps/web/src/app/(fa)/offline-client.js.map',
          revision: '5626db5a8937fc426263d94aa14f350c',
        },
        {
          url: '/apps/web/src/app/(fa)/offline-client.test.js',
          revision: '78fe3f6c543954b8f49c239af003717d',
        },
        {
          url: '/apps/web/src/app/(fa)/offline-client.test.js.map',
          revision: '325f4761c181b7faa84cf832897941ac',
        },
        { url: '/apps/web/src/app/(fa)/page.js', revision: '2fe59d3a35dc9b8289f4f03fd1fd683d' },
        { url: '/apps/web/src/app/(fa)/page.js.map', revision: 'e6e9feb2f0273ab0292fe79e45b5ff24' },
        {
          url: '/apps/web/src/app/(fa)/page.test.js',
          revision: '15561bbe81cfa03e7e7958b0f3fe4cbb',
        },
        {
          url: '/apps/web/src/app/(fa)/page.test.js.map',
          revision: 'e7c21b57c91a56aafc869e8b2c293990',
        },
        {
          url: '/apps/web/src/app/(fa)/seller/dashboard/page.js',
          revision: 'a1d1d212a1a959814003ead4a2f7361d',
        },
        {
          url: '/apps/web/src/app/(fa)/seller/dashboard/page.js.map',
          revision: 'e0fe742d61304d220cceffd40ac217ac',
        },
        {
          url: '/apps/web/src/app/(fa)/seller/dashboard/page.test.js',
          revision: 'e593f80318e16bf22570af12bc541e8a',
        },
        {
          url: '/apps/web/src/app/(fa)/seller/dashboard/page.test.js.map',
          revision: '95ea9568dba660b4d1caf8646753c517',
        },
        {
          url: '/apps/web/src/app/components/site-shell.client.js',
          revision: '14db526ceaa3a86790b838a165511f0d',
        },
        {
          url: '/apps/web/src/app/components/site-shell.client.js.map',
          revision: 'c3f8e148d3597083cea421f2eb1a114d',
        },
        { url: '/apps/web/src/app/en/layout.js', revision: '6d04d6b333e5e200db152d29e55016f3' },
        { url: '/apps/web/src/app/en/layout.js.map', revision: '3b9a00a32c8058bd72c46eebb7ccd9be' },
        { url: '/apps/web/src/app/en/page.js', revision: 'b754c527e4b7f3b2b6e9e46e9248a1a3' },
        { url: '/apps/web/src/app/en/page.js.map', revision: '8a739075ff4e9ab2eb10b557a5925c27' },
        { url: '/apps/web/src/app/sw.js', revision: '5929c44cf705c361872d5e1768d37aa2' },
        { url: '/apps/web/src/app/sw.js.map', revision: 'ba49e03065f4e8681241a0324809d0b6' },
        {
          url: '/apps/web/src/components/ui/persian-date-picker.js',
          revision: 'da812868fc51cb642b0c8e5fc74b87c9',
        },
        {
          url: '/apps/web/src/components/ui/persian-date-picker.js.map',
          revision: '7c51482d41255c7bf78234dac9ac840d',
        },
        {
          url: '/apps/web/src/components/ui/persian-date-picker.test.js',
          revision: 'd9974ef291743609e69cd44e54790ec6',
        },
        {
          url: '/apps/web/src/components/ui/persian-date-picker.test.js.map',
          revision: 'ca434f8afc7c7ce78a29b8be615013ba',
        },
        {
          url: '/apps/web/src/components/ui/persian-date-utils.test.js',
          revision: 'b23e85a365008fc6c1ed49957c80c25c',
        },
        {
          url: '/apps/web/src/components/ui/persian-date-utils.test.js.map',
          revision: '9446da034765a004926026e5a8e7ad64',
        },
        { url: '/apps/web/src/lib/env.js', revision: '3a9df93cb233ea79c2b8c509ca8558b9' },
        { url: '/apps/web/src/lib/env.js.map', revision: 'de1e35af7b471d009002b6cef15994f0' },
        { url: '/apps/web/src/pages/_document.js', revision: '1738465ab42d85a3df45ceb9c95f26f3' },
        {
          url: '/apps/web/src/pages/_document.js.map',
          revision: '6ff82b539f56c2f6c19ba23034563f29',
        },
        { url: '/apps/web/src/pages/api/health.js', revision: 'd7b8ca0784217737d811018f6b03a207' },
        {
          url: '/apps/web/src/pages/api/health.js.map',
          revision: 'd835e881254068374318a1a535326ae2',
        },
        { url: '/apps/web/src/pages/api/live.js', revision: 'bba4157366964aa065c9ce7913b19c41' },
        {
          url: '/apps/web/src/pages/api/live.js.map',
          revision: 'd2e7f61cd3c7dbd396b86f0c4c50e458',
        },
        { url: '/apps/web/src/pages/api/ready.js', revision: '60230946932618ee6f47c3faac4bf151' },
        {
          url: '/apps/web/src/pages/api/ready.js.map',
          revision: 'f2747ef1bdeb02e8c492a32f6468a7e4',
        },
        { url: '/apps/web/tsconfig.tsbuildinfo', revision: 'c989664f0cbf567542104e519062ee29' },
        { url: '/fonts/README.txt', revision: '0daa3aa865f0512b9b24f6ccbff7e756' },
        { url: '/icons/icon-192.png', revision: '8cf91114aaaf6320d35749219bfbae92' },
        { url: '/icons/icon-512.png', revision: '8cf91114aaaf6320d35749219bfbae92' },
        { url: '/icons/offline-image.png', revision: 'eAQdKaE9RGzDw6iUPwPJG' },
        { url: '/manifest.json', revision: 'e58dd1384dd77b8d85276e839c75a26b' },
        { url: '/manifest.webmanifest', revision: '670355251f866aba0d3d221ab3852a5c' },
        { url: '/models/tinyllama-q4.onnx', revision: '90227ba4aba75a187c8dfcf369d8214f' },
        { url: '/offline', revision: 'eAQdKaE9RGzDw6iUPwPJG' },
      ],
      { ignoreURLParametersMatching: [] }
    ),
    e.cleanupOutdatedCaches(),
    e.registerRoute(
      '/',
      new e.NetworkFirst({
        cacheName: 'start-url',
        plugins: [
          {
            cacheWillUpdate: async ({ request: e, response: a, event: s, state: i }) =>
              a && 'opaqueredirect' === a.type
                ? new Response(a.body, { status: 200, statusText: 'OK', headers: a.headers })
                : a,
          },
          { handlerDidError: async ({ request: e }) => self.fallback(e) },
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
      new e.CacheFirst({
        cacheName: 'google-fonts',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 31536e3 }),
          { handlerDidError: async ({ request: e }) => self.fallback(e) },
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /^https:\/\/cdn\.nextgen-market\.ir\/.*/i,
      new e.CacheFirst({
        cacheName: 'cdn-images',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 2592e3 }),
          { handlerDidError: async ({ request: e }) => self.fallback(e) },
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /^https:\/\/api\.nextgen-market\.ir\/api\/.*/i,
      new e.NetworkFirst({
        cacheName: 'api-responses',
        networkTimeoutSeconds: 10,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 86400 }),
          { handlerDidError: async ({ request: e }) => self.fallback(e) },
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:js|css|woff2?|ttf|eot|svg)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 604800 }),
          { handlerDidError: async ({ request: e }) => self.fallback(e) },
        ],
      }),
      'GET'
    );
});
