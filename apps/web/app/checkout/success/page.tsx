'use client';

import { Button, GlassCard, PageHeader } from '@/components/ui';
import { useTraceId } from '@/hooks/use-trace-id';
import { emitUiEvent } from '@/lib/ui-telemetry';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';

export default function CheckoutSuccessPage() {
  const traceId = useTraceId();
  const search = useSearchParams();
  const locale = typeof document !== 'undefined' ? document.documentElement.lang : 'fa';
  const orderId = search.get('orderId');
  const orderNumber = search.get('orderNumber');
  const paymentStatus = search.get('paymentStatus');
  const paymentMessage = search.get('paymentMessage');
  const storyId = search.get('storyId');
  const conversionSent = useRef(false);

  const strings = useMemo(
    () =>
      locale === 'en'
        ? {
            title: 'Order has been created',
            subtitle: 'Your purchase entered fulfillment pipeline successfully.',
            cta: 'Back to marketplace',
          }
        : {
            title: 'سفارش با موفقیت ایجاد شد',
            subtitle: 'خرید شما وارد مسیر پردازش و ارسال شد.',
            cta: 'بازگشت به فروشگاه',
          },
    [locale]
  );

  useEffect(() => {
    emitUiEvent('page_view', { path: '/checkout/success', locale }, traceId ?? undefined);
    emitUiEvent('flow_complete', { flow: 'checkout', status: 'success' }, traceId ?? undefined);
  }, [locale, traceId]);

  useEffect(() => {
    if (conversionSent.current || paymentStatus !== 'success') {
      return;
    }
    conversionSent.current = true;
    fetch('/api/stories/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        type: 'conversion',
        storyId: storyId || undefined,
        traceId: traceId || undefined,
        meta: {
          path: '/checkout/success',
          orderId: orderId || null,
          orderNumber: orderNumber || null,
        },
      }),
    }).catch(() => undefined);
  }, [orderId, orderNumber, paymentStatus, storyId, traceId]);

  const paymentLabel =
    paymentStatus === 'success' ? 'موفق' : paymentStatus === 'failed' ? 'ناموفق' : 'در انتظار';

  return (
    <div className="min-h-screen px-6 py-14" data-testid="checkout-success">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow="Order Confirmation"
          title={strings.title}
          subtitle={strings.subtitle}
          chips={['Order Created', 'Trace Logged', 'Fulfillment Ready']}
          titleTestId="checkout-success-title"
        />

        <GlassCard className="mt-8 rounded-3xl p-10 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-500/10 text-3xl text-emerald-200">
            ✓
          </div>

          {orderNumber || orderId ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {orderNumber ? <p>شماره سفارش: {orderNumber}</p> : null}
              {orderId ? <p>شناسه سفارش: {orderId}</p> : null}
            </div>
          ) : null}

          {paymentStatus ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p>وضعیت پرداخت: {paymentLabel}</p>
              {paymentMessage ? (
                <p className="mt-2 text-xs text-slate-600">{paymentMessage}</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-8 flex justify-center gap-3">
            <Link href="/orders">
              <Button loading={false} variant="outline">
                مشاهده سفارش‌ها
              </Button>
            </Link>
            <Link href="/">
              <Button loading={false}>{strings.cta}</Button>
            </Link>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
