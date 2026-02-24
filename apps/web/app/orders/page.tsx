'use client';

import { useEffect, useMemo, useState } from 'react';
import { AuthNavButton } from '@/components/AuthNavButton';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { useAuth } from '@/components/AuthProvider';
import { Button, GlassCard, PageHeader } from '@/components/ui';
import { useTraceId } from '@/hooks/use-trace-id';
import { emitUiEvent } from '@/lib/ui-telemetry';

type Order = {
  id: string;
  orderNumber?: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items?: Array<{ id: string }>;
};

const fallbackOrders: Order[] = [
  {
    id: 'order-fallback-1',
    orderNumber: 'NX-2049',
    status: 'PAID',
    totalAmount: 49050000,
    createdAt: new Date('2026-02-20T10:00:00Z').toISOString(),
    items: [{ id: 'item-fallback-1' }],
  },
];

const statusMap: Record<string, { label: string; cls: string }> = {
  PAID: { label: 'پرداخت‌شده', cls: 'text-emerald-300 border-emerald-300/30 bg-emerald-500/10' },
  PENDING: { label: 'در انتظار', cls: 'text-amber-300 border-amber-300/30 bg-amber-500/10' },
  FAILED: { label: 'ناموفق', cls: 'text-rose-300 border-rose-300/30 bg-rose-500/10' },
  SHIPPED: { label: 'ارسال‌شده', cls: 'text-orange-600 border-orange-300 bg-orange-50' },
};

export default function OrdersPage() {
  const traceId = useTraceId();
  const { isAuthenticated, loading } = useAuth();
  const locale = typeof document !== 'undefined' ? document.documentElement.lang : 'fa';
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const strings = useMemo(
    () =>
      locale === 'en'
        ? {
            title: 'Order operations',
            subtitle: 'Track fulfillment and payment state for each order.',
            total: 'Total',
            items: 'Items',
            refresh: 'Refresh',
            empty: 'No order found for selected filter.',
          }
        : {
            title: 'عملیات سفارش‌ها',
            subtitle: 'وضعیت پرداخت، پردازش و ارسال هر سفارش را دقیق دنبال کنید.',
            total: 'مبلغ کل',
            items: 'اقلام',
            refresh: 'به‌روزرسانی',
            empty: 'برای فیلتر انتخاب‌شده سفارشی پیدا نشد.',
          },
    [locale]
  );

  const formatter = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fa-IR');

  const loadOrders = async () => {
    try {
      const response = await fetch('/api/backend/v1/orders', { cache: 'no-store' });
      const data = (await response.json().catch(() => [])) as Order[] | { error?: string; message?: string };

      if (!response.ok) {
        setError(String((data as any).message || (data as any).error || 'load_failed'));
        setOrders(fallbackOrders);
        return;
      }

      const nextOrders = Array.isArray(data) ? data : [];
      setOrders(nextOrders.length > 0 ? nextOrders : fallbackOrders);
      setError(null);
    } catch {
      setError('upstream_unreachable');
      setOrders(fallbackOrders);
    }
  };

  useEffect(() => {
    emitUiEvent('page_view', { path: '/orders', locale }, traceId ?? undefined);
  }, [locale, traceId]);

  useEffect(() => {
    if (loading) {
      return;
    }
    loadOrders();
  }, [loading, isAuthenticated]);

  const filteredOrders = useMemo(
    () => orders.filter((order) => statusFilter === 'ALL' || order.status === statusFilter),
    [orders, statusFilter]
  );

  return (
    <div className="min-h-screen" data-trace-id={traceId ?? undefined}>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <PageHeader
          eyebrow="Order Intelligence"
          title={strings.title}
          subtitle={strings.subtitle}
          chips={['Real-time Status', 'Payment-linked', 'Traceable Lifecycle']}
          titleTestId="orders-title"
          actions={
            <>
              <LocaleSwitch />
              <AuthNavButton />
              <Button loading={false} onClick={loadOrders} variant="outline">
                {strings.refresh}
              </Button>
            </>
          }
        />

        <div className="mt-6 flex flex-wrap gap-2">
          {['ALL', 'PAID', 'PENDING', 'FAILED', 'SHIPPED'].map((status) => (
            <button
              key={status}
              className={`rounded-full border px-3 py-1 text-xs ${
                statusFilter === status
                  ? 'border-orange-300 bg-orange-50 text-orange-700'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
              onClick={() => setStatusFilter(status)}
              type="button"
              aria-busy="false"
            >
              {status}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mt-6 rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {error}
          </p>
        ) : null}

        <div className="mt-8 grid gap-5" data-testid="orders-list">
          {filteredOrders.map((order) => {
            const badge = statusMap[order.status] || {
              label: order.status,
              cls: 'text-slate-700 border-slate-300 bg-slate-50',
            };
            return (
              <GlassCard key={order.id} className="rounded-3xl p-6">
                <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-center">
                  <div>
                    <p className="text-xs text-slate-500">{order.orderNumber || order.id}</p>
                    <p className="mt-2 text-sm text-slate-700">
                      {new Date(order.createdAt).toLocaleString('fa-IR')}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {strings.items}: {formatter.format(order.items?.length || 0)}
                    </p>
                  </div>

                  <div className="text-sm text-slate-700 md:text-end">
                    <p className="text-xs text-slate-500">{strings.total}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {formatter.format(Number(order.totalAmount || 0))}
                    </p>
                  </div>

                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <span className={`rounded-full border px-3 py-1 text-xs ${badge.cls}`}>{badge.label}</span>
                    <Button
                      loading={false}
                      variant="ghost"
                      className="w-auto px-4 py-2"
                      data-testid={`order-view-${order.orderNumber || order.id}`}
                    >
                      مشاهده جزئیات
                    </Button>
                  </div>
                </div>
              </GlassCard>
            );
          })}

          {!error && filteredOrders.length === 0 ? (
            <GlassCard className="rounded-3xl p-6 text-sm text-slate-600">{strings.empty}</GlassCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
