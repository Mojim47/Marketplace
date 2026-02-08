'use client';

import { LocaleSwitch } from '@/components/LocaleSwitch';
import { Button } from '@/components/ui/Button';
import { useTraceId } from '@/hooks/use-trace-id';
import { emitUiEvent } from '@/lib/ui-telemetry';
import { useEffect, useMemo } from 'react';

type Order = {
  id: string;
  status: 'delivered' | 'processing' | 'cancelled';
  total: number;
  items: number;
  date: string;
};

const ORDERS: Order[] = [
  { id: 'NX-2049', status: 'delivered', total: 9850000, items: 2, date: '2026-02-01' },
  { id: 'NX-2055', status: 'processing', total: 21450000, items: 1, date: '2026-02-04' },
  { id: 'NX-2061', status: 'cancelled', total: 6750000, items: 1, date: '2026-02-06' },
];

export default function OrdersPage() {
  const traceId = useTraceId();
  const locale = typeof document !== 'undefined' ? document.documentElement.lang : 'fa';

  const strings = useMemo(
    () =>
      locale === 'en'
        ? {
            title: 'Order history',
            subtitle: 'Track your recent orders and delivery status.',
            total: 'Total',
            items: 'Items',
            status: 'Status',
            view: 'View order',
            delivered: 'Delivered',
            processing: 'Processing',
            cancelled: 'Cancelled',
          }
        : {
            title: 'سفارش‌های من',
            subtitle: 'سفارش‌های اخیر و وضعیت ارسال را دنبال کنید.',
            total: 'مبلغ کل',
            items: 'اقلام',
            status: 'وضعیت',
            view: 'مشاهده سفارش',
            delivered: 'تحویل شده',
            processing: 'در حال پردازش',
            cancelled: 'لغو شده',
          },
    [locale]
  );

  const formatter = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fa-IR');

  useEffect(() => {
    emitUiEvent('page_view', { path: '/orders', locale }, traceId ?? undefined);
  }, [locale, traceId]);

  const statusLabel = (status: Order['status']) => {
    if (status === 'delivered') {
      return strings.delivered;
    }
    if (status === 'processing') {
      return strings.processing;
    }
    return strings.cancelled;
  };

  const statusTone = (status: Order['status']) => {
    if (status === 'delivered') {
      return 'text-emerald-300';
    }
    if (status === 'processing') {
      return 'text-blue-200';
    }
    return 'text-rose-200';
  };

  return (
    <div className="min-h-screen" data-trace-id={traceId ?? undefined}>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-300">NextGen Marketplace</p>
            <h1 className="section-title mt-2 text-3xl text-white" data-testid="orders-title">
              {strings.title}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-slate-300">{strings.subtitle}</p>
          </div>
          <LocaleSwitch />
        </div>

        <div className="mt-10 grid gap-6" data-testid="orders-list">
          {ORDERS.map((order) => (
            <div key={order.id} className="glass-card rounded-3xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-400">{order.id}</p>
                  <p className="mt-2 text-sm text-slate-200">{order.date}</p>
                </div>
                <div className="text-end text-sm text-slate-200">
                  <p>
                    {strings.total}: {formatter.format(order.total)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {strings.items}: {formatter.format(order.items)}
                  </p>
                </div>
                <div className="text-sm">
                  <p className="text-xs text-slate-400">{strings.status}</p>
                  <p className={`mt-2 font-semibold ${statusTone(order.status)}`}>
                    {statusLabel(order.status)}
                  </p>
                </div>
                <Button
                  loading={false}
                  onClick={() =>
                    emitUiEvent(
                      'cta_click',
                      { label: 'order_view', location: 'orders' },
                      traceId ?? undefined
                    )
                  }
                  data-testid={`order-view-${order.id}`}
                >
                  {strings.view}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
