'use client';

import { LocaleSwitch } from '@/components/LocaleSwitch';
import { Button } from '@/components/ui/Button';
import { useTraceId } from '@/hooks/use-trace-id';
import { emitUiEvent } from '@/lib/ui-telemetry';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';

type CartItem = {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
};

const ITEMS: CartItem[] = [
  { id: 'nx-1', name: 'Galaxy Ultra 5G', sku: 'NX-ULTRA-5G', price: 45200000, quantity: 1 },
  { id: 'nx-2', name: 'Xperia Camera', sku: 'NX-EXPERIA-CAM', price: 28900000, quantity: 1 },
];

export default function CartPage() {
  const router = useRouter();
  const traceId = useTraceId();
  const locale = typeof document !== 'undefined' ? document.documentElement.lang : 'fa';

  const strings = useMemo(
    () =>
      locale === 'en'
        ? {
            title: 'Cart review',
            subtitle: 'Review your items and proceed to secure checkout.',
            items: 'Items',
            summary: 'Order summary',
            total: 'Total',
            checkout: 'Continue to checkout',
          }
        : {
            title: 'بازبینی سبد خرید',
            subtitle: 'آیتم‌های انتخاب‌شده را بررسی کنید و وارد پرداخت امن شوید.',
            items: 'اقلام',
            summary: 'خلاصه سفارش',
            total: 'جمع کل',
            checkout: 'ادامه به تسویه',
          },
    [locale]
  );

  const total = ITEMS.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const formatter = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fa-IR');

  useEffect(() => {
    emitUiEvent('page_view', { path: '/cart', locale }, traceId ?? undefined);
  }, [locale, traceId]);

  const handleCheckout = () => {
    emitUiEvent('cta_click', { label: 'cart_checkout', location: 'cart' }, traceId ?? undefined);
    router.push('/checkout');
  };

  return (
    <div className="min-h-screen" data-trace-id={traceId ?? undefined}>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-300">NextGen Marketplace</p>
            <h1 className="section-title mt-2 text-3xl text-white" data-testid="cart-title">
              {strings.title}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-slate-300">{strings.subtitle}</p>
          </div>
          <LocaleSwitch />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="glass-card rounded-3xl p-6" data-testid="cart-items">
            <div className="flex items-center justify-between">
              <h2 className="section-title text-xl text-white">{strings.items}</h2>
              <span className="text-xs text-slate-300">{ITEMS.length}</span>
            </div>
            <div className="mt-6 space-y-4">
              {ITEMS.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/5 px-4 py-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm text-white">{item.name}</p>
                    <p className="text-xs text-slate-300">{item.sku}</p>
                  </div>
                  <div className="text-end text-sm text-slate-200">
                    <p>{formatter.format(item.price)}</p>
                    <p className="text-xs text-slate-400">× {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-3xl p-6" data-testid="cart-summary">
            <h2 className="section-title text-xl text-white">{strings.summary}</h2>
            <div className="mt-6 space-y-4 text-sm">
              {ITEMS.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-slate-200">
                  <span>{item.name}</span>
                  <span>{formatter.format(item.price * item.quantity)}</span>
                </div>
              ))}
              <div className="border-t border-white/10 pt-4 text-white">
                <div className="flex items-center justify-between">
                  <span>{strings.total}</span>
                  <span className="text-lg font-semibold">{formatter.format(total)}</span>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <Button loading={false} onClick={handleCheckout} data-testid="cart-checkout-cta">
                {strings.checkout}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
