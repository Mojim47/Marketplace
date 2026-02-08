'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { emitUiEvent } from '@/lib/ui-telemetry';
import { useTraceId } from '@/hooks/use-trace-id';

export default function CheckoutSuccessPage() {
  const traceId = useTraceId();
  const locale = typeof document !== 'undefined' ? document.documentElement.lang : 'fa';

  const strings = useMemo(
    () =>
      locale === 'en'
        ? {
            title: 'Order confirmed',
            subtitle: 'Your order has been submitted successfully.',
            cta: 'Back to marketplace',
          }
        : {
            title: 'سفارش ثبت شد',
            subtitle: 'سفارش شما با موفقیت ثبت شد و در حال پردازش است.',
            cta: 'بازگشت به فروشگاه',
          },
    [locale],
  );

  useEffect(() => {
    emitUiEvent('page_view', { path: '/checkout/success', locale }, traceId ?? undefined);
    emitUiEvent('flow_complete', { flow: 'checkout', status: 'success' }, traceId ?? undefined);
  }, [locale, traceId]);

  return (
    <div className="min-h-screen px-6 py-16" data-testid="checkout-success">
      <div className="glass-card mx-auto max-w-2xl rounded-3xl p-10 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-3xl">
          ✓
        </div>
        <h1 className="section-title mt-6 text-3xl text-white" data-testid="checkout-success-title">
          {strings.title}
        </h1>
        <p className="mt-3 text-sm text-slate-300">{strings.subtitle}</p>
        <div className="mt-8 flex justify-center">
          <Link href="/">
            <Button loading={false}>{strings.cta}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
