'use client';

import { useRouter } from 'next/navigation';
import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AuthNavButton } from '@/components/AuthNavButton';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { useAuth } from '@/components/AuthProvider';
import { Button, GlassCard, PageHeader } from '@/components/ui';
import { useTraceId } from '@/hooks/use-trace-id';
import { transitionFlow } from '@/lib/marketplace-state-machine';
import { emitUiEvent } from '@/lib/ui-telemetry';

type CheckoutForm = {
  fullName: string;
  phone: string;
  province: string;
  city: string;
  address: string;
  postalCode: string;
};

type CartSnapshot = {
  items: Array<{ productId: string; productName: string; price: number; quantity: number }>;
  total: number;
  subtotal: number;
  taxAmount: number;
};

type CheckoutSession = {
  id: string;
};

function hasValidOrderIdentity(payload: unknown): payload is { orderId: string; orderNumber: string } {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const record = payload as Record<string, unknown>;
  return (
    typeof record.orderId === 'string' &&
    record.orderId.trim().length > 0 &&
    typeof record.orderNumber === 'string' &&
    record.orderNumber.trim().length > 0
  );
}

async function fetchJson<T>(url: string, init?: globalThis.RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => ({}))) as T & { error?: string; message?: string };

  if (!response.ok) {
    throw new Error(String((data as any).message || (data as any).error || response.status));
  }

  return data as T;
}

export default function CheckoutPage() {
  const router = useRouter();
  const traceId = useTraceId();
  const { isAuthenticated, loading } = useAuth();
  const locale = typeof document !== 'undefined' ? document.documentElement.lang : 'fa';
  const [form, setForm] = useState<CheckoutForm>({
    fullName: '',
    phone: '',
    province: '',
    city: '',
    address: '',
    postalCode: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [cart, setCart] = useState<CartSnapshot | null>(null);

  const strings = useMemo(
    () =>
      locale === 'en'
        ? {
            title: 'Secure checkout',
            subtitle: 'Shipping, payment, and order completion with verified server transitions.',
            customer: 'Customer and shipping',
            fullName: 'Full name',
            phone: 'Phone number',
            province: 'Province',
            city: 'City',
            address: 'Delivery address',
            postalCode: 'Postal code',
            payment: 'Payment method',
            card: 'ZarinPal online payment',
            summary: 'Order summary',
            total: 'Payable total',
            submit: 'Submit order',
            error: 'Please complete all required fields.',
          }
        : {
            title: 'تسویه امن',
            subtitle: 'ثبت آدرس، انتخاب پرداخت و تکمیل سفارش با کنترل‌های سروری واقعی.',
            customer: 'مشخصات مشتری و ارسال',
            fullName: 'نام و نام خانوادگی',
            phone: 'شماره تماس',
            province: 'استان',
            city: 'شهر',
            address: 'آدرس تحویل',
            postalCode: 'کد پستی',
            payment: 'روش پرداخت',
            card: 'پرداخت آنلاین زرین‌پال',
            summary: 'خلاصه سفارش',
            total: 'مبلغ قابل پرداخت',
            submit: 'ثبت سفارش',
            error: 'لطفاً تمام فیلدهای ضروری را تکمیل کنید.',
          },
    [locale]
  );

  const formatter = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fa-IR');

  useEffect(() => {
    emitUiEvent('page_view', { path: '/checkout', locale }, traceId ?? undefined);
    emitUiEvent('flow_start', { flow: 'checkout' }, traceId ?? undefined);
  }, [locale, traceId]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!isAuthenticated) {
      router.push('/auth/login?next=/checkout');
      return;
    }

    fetchJson<CartSnapshot>('/api/backend/cart')
      .then((data) => {
        setCart(data);
        if ((data.items || []).length > 0) {
          transitionFlow('S5_CART_ACTIVE', {
            reason: 'checkout_cart_loaded_with_items',
            traceId: traceId ?? undefined,
          });
        }
      })
      .catch((err: Error) => {
        setError(err.message);
      });
  }, [loading, isAuthenticated, router, traceId]);

  const handleChange =
    (key: keyof CheckoutForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const validateForm = () =>
    form.fullName && form.phone && form.province && form.city && form.address && form.postalCode;

  const steps = [
    { title: 'سبد خرید', status: 'done' },
    { title: 'اطلاعات ارسال', status: validateForm() ? 'done' : 'active' },
    { title: 'پرداخت', status: loadingSubmit ? 'active' : 'pending' },
    { title: 'تایید سفارش', status: successMsg ? 'done' : 'pending' },
  ];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!validateForm()) {
      setError(strings.error);
      emitUiEvent('error_shown', { code: 'checkout_missing_fields' }, traceId ?? undefined);
      return;
    }

    setLoadingSubmit(true);

    try {
      const session = await fetchJson<CheckoutSession>('/api/backend/checkout/init', { method: 'POST' });
      transitionFlow('S6_CHECKOUT_INIT', { reason: 'checkout_init_success', traceId: traceId ?? undefined });

      await fetchJson(`/api/backend/checkout/${session.id}/shipping`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          province: form.province,
          city: form.city,
          address: form.address,
          postalCode: form.postalCode,
        }),
      });
      transitionFlow('S7_CHECKOUT_SHIPPING_SET', {
        reason: 'checkout_shipping_success',
        traceId: traceId ?? undefined,
      });

      await fetchJson(`/api/backend/checkout/${session.id}/payment`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method: 'ONLINE' }),
      });
      transitionFlow('S8_CHECKOUT_PAYMENT_SET', {
        reason: 'checkout_payment_success',
        traceId: traceId ?? undefined,
      });

      const completeRaw = await fetchJson<unknown>(`/api/backend/checkout/${session.id}/complete`, {
        method: 'POST',
      });

      if (!hasValidOrderIdentity(completeRaw)) {
        transitionFlow('S_ERR', {
          reason: 'checkout_complete_missing_order_identity',
          guard: 'checkout_identity_guard',
          traceId: traceId ?? undefined,
          details: { checkoutSessionId: session.id },
        });
        setError('order_identity_missing');
        return;
      }
      const complete = completeRaw;
      transitionFlow('S9_ORDER_CREATED', {
        reason: 'checkout_complete_success',
        traceId: traceId ?? undefined,
        details: { orderId: complete.orderId, orderNumber: complete.orderNumber },
      });

      let paymentStatus: 'success' | 'pending' | 'failed' = 'pending';
      let paymentMessage = '';
      try {
        const maybeUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            complete.orderId
          );
        if (!maybeUuid) {
          paymentStatus = 'pending';
          paymentMessage = 'پرداخت آنلاین زرین‌پال برای این سفارش در حالت انتظار است.';
        } else {
          await fetchJson('/api/backend/payment/request', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ orderId: complete.orderId }),
          });
          paymentStatus = 'success';
        }
      } catch (paymentErr) {
        paymentStatus = 'failed';
        paymentMessage = (paymentErr as Error).message;
      }

      emitUiEvent('flow_complete', { flow: 'checkout', status: 'success' }, traceId ?? undefined);
      setSuccessMsg('سفارش با موفقیت ثبت شد. در حال انتقال...');
      router.push(
        `/checkout/success?orderId=${encodeURIComponent(complete.orderId)}&orderNumber=${encodeURIComponent(complete.orderNumber)}&paymentStatus=${paymentStatus}&paymentMessage=${encodeURIComponent(paymentMessage)}`
      );
      router.refresh();
    } catch (err) {
      const message = (err as Error).message;
      const isAuthError = /401|unauthorized/i.test(message);
      if (isAuthError) {
        try {
          transitionFlow('S2_TOKEN_EXPIRED', {
            reason: 'checkout_api_401',
            traceId: traceId ?? undefined,
          });
        } catch {
          // Keep auth recovery deterministic even if transition guard blocks.
        }
        router.replace('/auth/login?next=/checkout');
        router.refresh();
        return;
      }
      setError(message);
      emitUiEvent('error_shown', { code: 'checkout_failed', reason: message }, traceId ?? undefined);
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="min-h-screen" data-trace-id={traceId ?? undefined}>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <PageHeader
          eyebrow="Checkout Pipeline"
          title={strings.title}
          subtitle={strings.subtitle}
          chips={['Shipping Validated', 'Payment Guarded', 'Order Identity Checked']}
          titleTestId="checkout-title"
          actions={
            <>
              <LocaleSwitch />
              <AuthNavButton />
            </>
          }
        />

        <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-4">
          {steps.map((step) => (
            <div key={step.title} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-200">
              <p>{step.title}</p>
              <p className="mt-1 text-[11px] text-slate-400">{step.status}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form
            className="glass-card rounded-3xl p-6"
            onSubmit={handleSubmit}
            data-testid="checkout-form"
            data-error-state={error ? 'true' : 'false'}
            data-empty-state={validateForm() ? 'false' : 'true'}
          >
            <h2 className="section-title text-xl text-white">{strings.customer}</h2>
            <div className="mt-6 space-y-4 text-sm">
              <div>
                <label htmlFor="checkout-fullname" className="text-xs text-slate-300">{strings.fullName}</label>
                <input id="checkout-fullname" className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white" value={form.fullName} onChange={handleChange('fullName')} />
              </div>
              <div>
                <label htmlFor="checkout-phone" className="text-xs text-slate-300">{strings.phone}</label>
                <input id="checkout-phone" className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white" value={form.phone} onChange={handleChange('phone')} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="checkout-province" className="text-xs text-slate-300">{strings.province}</label>
                  <input id="checkout-province" className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white" value={form.province} onChange={handleChange('province')} />
                </div>
                <div>
                  <label htmlFor="checkout-city" className="text-xs text-slate-300">{strings.city}</label>
                  <input id="checkout-city" className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white" value={form.city} onChange={handleChange('city')} />
                </div>
              </div>
              <div>
                <label htmlFor="checkout-address" className="text-xs text-slate-300">{strings.address}</label>
                <textarea id="checkout-address" className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white" value={form.address} onChange={handleChange('address')} rows={3} />
              </div>
              <div>
                <label htmlFor="checkout-postal" className="text-xs text-slate-300">{strings.postalCode}</label>
                <input id="checkout-postal" className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white" value={form.postalCode} onChange={handleChange('postalCode')} />
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-sm text-slate-300">{strings.payment}</h3>
              <div className="mt-3 grid gap-3">
                <div className="flex items-center justify-between rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  <span>{strings.card}</span>
                  <span className="text-xs">Only Gateway</span>
                </div>
              </div>
            </div>

            {error ? <p className="mt-6 rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</p> : null}
            {successMsg ? <p className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">{successMsg}</p> : null}

            <div className="mt-8">
              <Button loading={loadingSubmit} loadingText={strings.submit} data-testid="checkout-submit">
                {strings.submit}
              </Button>
            </div>
          </form>

          <GlassCard className="sticky top-32 h-fit rounded-3xl p-6" data-testid="checkout-summary">
            <h2 className="section-title text-xl text-white">{strings.summary}</h2>
            <div className="mt-6 space-y-4 text-sm">
              {(cart?.items || []).map((item) => (
                <div key={item.productId} className="flex items-center justify-between text-slate-200">
                  <span>{item.productName}</span>
                  <span>{formatter.format(item.price * item.quantity)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-slate-300">
                <span>جمع جزئی</span>
                <span>{formatter.format(cart?.subtotal || 0)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>مالیات</span>
                <span>{formatter.format(cart?.taxAmount || 0)}</span>
              </div>
              <div className="border-t border-white/10 pt-4 text-white">
                <div className="flex items-center justify-between">
                  <span>{strings.total}</span>
                  <span className="text-lg font-semibold">{formatter.format(cart?.total || 0)}</span>
                </div>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-dashed border-white/20 p-4 text-xs text-slate-300">
              اعتبارسنجی سمت سرور برای موجودی، قیمت و پرداخت در هر مرحله انجام می‌شود.
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
