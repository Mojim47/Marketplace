'use client';

import { LocaleSwitch } from '@/components/LocaleSwitch';
import { Button } from '@/components/ui/Button';
import { useTraceId } from '@/hooks/use-trace-id';
import { emitUiEvent } from '@/lib/ui-telemetry';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

type CheckoutForm = {
  fullName: string;
  phone: string;
  address: string;
  payment: 'card' | 'wallet';
};

const ITEMS = [
  { id: 'nx-1', name: 'Galaxy Ultra 5G', price: 45200000 },
  { id: 'nx-2', name: 'Xperia Camera', price: 28900000 },
];

export default function CheckoutPage() {
  const router = useRouter();
  const traceId = useTraceId();
  const locale = typeof document !== 'undefined' ? document.documentElement.lang : 'fa';
  const [form, setForm] = useState<CheckoutForm>({
    fullName: '',
    phone: '',
    address: '',
    payment: 'card',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strings = useMemo(
    () =>
      locale === 'en'
        ? {
            title: 'Secure checkout',
            subtitle: 'Confirm your delivery details and payment method.',
            customer: 'Customer details',
            fullName: 'Full name',
            phone: 'Phone number',
            address: 'Delivery address',
            payment: 'Payment method',
            card: 'Card payment',
            wallet: 'Wallet balance',
            summary: 'Order summary',
            total: 'Total',
            submit: 'Place order',
            error: 'Please fill in all required fields.',
          }
        : {
            title: 'تسویه امن',
            subtitle: 'مشخصات ارسال و روش پرداخت خود را تأیید کنید.',
            customer: 'مشخصات مشتری',
            fullName: 'نام و نام خانوادگی',
            phone: 'شماره تماس',
            address: 'آدرس تحویل',
            payment: 'روش پرداخت',
            card: 'پرداخت با کارت',
            wallet: 'اعتبار کیف پول',
            summary: 'خلاصه سفارش',
            total: 'جمع کل',
            submit: 'ثبت سفارش',
            error: 'لطفاً تمام فیلدهای ضروری را تکمیل کنید.',
          },
    [locale]
  );

  const total = ITEMS.reduce((sum, item) => sum + item.price, 0);
  const formatter = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fa-IR');

  useEffect(() => {
    emitUiEvent('page_view', { path: '/checkout', locale }, traceId ?? undefined);
    emitUiEvent('flow_start', { flow: 'checkout' }, traceId ?? undefined);
  }, [locale, traceId]);

  const handleChange =
    (key: keyof CheckoutForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const handlePayment = (payment: CheckoutForm['payment']) => {
    setForm((prev) => ({ ...prev, payment }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!form.fullName || !form.phone || !form.address) {
      setError(strings.error);
      emitUiEvent('error_shown', { code: 'checkout_missing_fields' }, traceId ?? undefined);
      return;
    }

    setLoading(true);
    emitUiEvent(
      'cta_click',
      { label: 'checkout_submit', location: 'checkout' },
      traceId ?? undefined
    );

    setTimeout(() => {
      emitUiEvent('flow_complete', { flow: 'checkout', status: 'success' }, traceId ?? undefined);
      router.push('/checkout/success');
      setLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen" data-trace-id={traceId ?? undefined}>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-300">NextGen Marketplace</p>
            <h1 className="section-title mt-2 text-3xl text-white" data-testid="checkout-title">
              {strings.title}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-slate-300">{strings.subtitle}</p>
          </div>
          <LocaleSwitch />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form
            className="glass-card rounded-3xl p-6"
            data-error-state={error ? 'visible' : 'hidden'}
            data-empty-state={form.fullName || form.phone || form.address ? 'filled' : 'empty'}
            onSubmit={handleSubmit}
            data-testid="checkout-form"
          >
            <h2 className="section-title text-xl text-white">{strings.customer}</h2>
            <div className="mt-6 space-y-4 text-sm">
              <div>
                <label htmlFor="checkout-fullname" className="text-xs text-slate-300">
                  {strings.fullName}
                </label>
                <input
                  id="checkout-fullname"
                  className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white"
                  placeholder={strings.fullName}
                  value={form.fullName}
                  onChange={handleChange('fullName')}
                  aria-invalid={Boolean(error)}
                />
              </div>
              <div>
                <label htmlFor="checkout-phone" className="text-xs text-slate-300">
                  {strings.phone}
                </label>
                <input
                  id="checkout-phone"
                  className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white"
                  placeholder={strings.phone}
                  value={form.phone}
                  onChange={handleChange('phone')}
                  aria-invalid={Boolean(error)}
                />
              </div>
              <div>
                <label htmlFor="checkout-address" className="text-xs text-slate-300">
                  {strings.address}
                </label>
                <textarea
                  id="checkout-address"
                  className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white"
                  placeholder={strings.address}
                  value={form.address}
                  onChange={handleChange('address')}
                  rows={3}
                  aria-invalid={Boolean(error)}
                />
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-sm text-slate-300">{strings.payment}</h3>
              <div className="mt-3 grid gap-3">
                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                  <span>{strings.card}</span>
                  <input
                    type="radio"
                    name="payment"
                    checked={form.payment === 'card'}
                    onChange={() => handlePayment('card')}
                  />
                </label>
                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                  <span>{strings.wallet}</span>
                  <input
                    type="radio"
                    name="payment"
                    checked={form.payment === 'wallet'}
                    onChange={() => handlePayment('wallet')}
                  />
                </label>
              </div>
            </div>

            {error ? (
              <p
                className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-rose-200"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-8">
              <Button loading={loading} loadingText={strings.submit} data-testid="checkout-submit">
                {strings.submit}
              </Button>
            </div>
          </form>

          <div className="glass-card rounded-3xl p-6" data-testid="checkout-summary">
            <h2 className="section-title text-xl text-white">{strings.summary}</h2>
            <div className="mt-6 space-y-4 text-sm">
              {ITEMS.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-slate-200">
                  <span>{item.name}</span>
                  <span>{formatter.format(item.price)}</span>
                </div>
              ))}
              <div className="border-t border-white/10 pt-4 text-white">
                <div className="flex items-center justify-between">
                  <span>{strings.total}</span>
                  <span className="text-lg font-semibold">{formatter.format(total)}</span>
                </div>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-dashed border-white/20 p-4 text-xs text-slate-300">
              پرداخت‌ها با استاندارد رمزنگاری بانکی و ثبت تراکنش آنی انجام می‌شوند.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
