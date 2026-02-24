'use client';

import { AuthNavButton } from '@/components/AuthNavButton';
import { useAuth } from '@/components/AuthProvider';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { Button, PageHeader } from '@/components/ui';
import { useTraceId } from '@/hooks/use-trace-id';
import { transitionFlow } from '@/lib/marketplace-state-machine';
import { emitUiEvent } from '@/lib/ui-telemetry';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type CartItem = {
  productId: string;
  productName: string;
  productSku: string;
  price: number;
  quantity: number;
};

type CartResponse = {
  items: CartItem[];
  subtotal: number;
  discount: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
};

const promoBanners = [
  { title: 'Smart Savings', subtitle: 'تخفیف‌های پویا بر اساس سبد خرید', badge: 'AI Offer' },
  {
    title: 'Express Delivery',
    subtitle: 'ارسال زیر 24 ساعت برای کالاهای منتخب',
    badge: 'Fast Lane',
  },
  {
    title: 'Secure Checkout',
    subtitle: 'تسویه زرین‌پال با گارانتی پرداخت امن',
    badge: 'Trusted Pay',
  },
];

const productImages = [
  '/images/products/phone-ultra.jpg',
  '/images/products/laptop.jpg',
  '/images/products/headphones.jpg',
  '/images/products/camera.jpg',
  '/images/products/router.jpg',
  '/images/products/smartwatch.jpg',
  '/images/products/monitor.jpg',
  '/images/products/speaker.jpg',
  '/images/products/smart-home.jpg',
  '/images/products/lock.jpg',
];

async function fetchJson<T>(url: string, init?: globalThis.RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error((data as any).message || (data as any).error || 'request_failed');
  }

  return data as T;
}

export default function CartPage() {
  const router = useRouter();
  const traceId = useTraceId();
  const { isAuthenticated, loading } = useAuth();
  const locale = typeof document !== 'undefined' ? document.documentElement.lang : 'fa';

  const [cart, setCart] = useState<CartResponse | null>(null);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strings = useMemo(
    () =>
      locale === 'en'
        ? {
            title: 'Cart control center',
            subtitle: 'Review, optimize, and finalize your purchase with real backend state.',
            items: 'Line items',
            summary: 'Financial summary',
            total: 'Payable total',
            checkout: 'Proceed to checkout',
            loginRequired: 'Please sign in to use cart.',
            empty: 'Your cart is empty. Add products to continue.',
            quickAdd: 'Quick add from recommended products',
          }
        : {
            title: 'مرکز کنترل سبد خرید',
            subtitle: 'سبد خرید واقعی، مدیریت اقلام، و آمادگی کامل برای تسویه امن.',
            items: 'اقلام سفارش',
            summary: 'خلاصه مالی',
            total: 'مبلغ قابل پرداخت',
            checkout: 'ادامه به تسویه',
            loginRequired: 'برای استفاده از سبد خرید ابتدا وارد شوید.',
            empty: 'سبد خرید شما خالی است. برای ادامه خرید، محصول اضافه کنید.',
            quickAdd: 'افزودن سریع از محصولات پیشنهادی',
          },
    [locale]
  );

  const formatter = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fa-IR');

  const loadCart = useCallback(async () => {
    const value = await fetchJson<CartResponse>('/api/backend/cart');
    setCart(value);
    if (!value.items || value.items.length === 0) {
      transitionFlow('S4_CART_EMPTY', {
        reason: 'cart_loaded_empty',
        traceId: traceId ?? undefined,
      });
    } else {
      transitionFlow('S5_CART_ACTIVE', {
        reason: 'cart_loaded_with_items',
        traceId: traceId ?? undefined,
      });
    }
  }, [traceId]);

  const loadProducts = useCallback(async () => {
    try {
      const list = await fetchJson<Product[]>('/api/backend/products');
      setCatalog(list.slice(0, 6));
    } catch {
      setCatalog([]);
    }
  }, []);

  useEffect(() => {
    emitUiEvent('page_view', { path: '/cart', locale }, traceId ?? undefined);
  }, [locale, traceId]);

  useEffect(() => {
    if (loading || !isAuthenticated) {
      return;
    }

    setError(null);
    Promise.all([loadCart(), loadProducts()]).catch((err: Error) => {
      if (err.message.includes('401')) {
        setError(strings.loginRequired);
        router.push('/auth/login?next=/cart');
        return;
      }
      setError(err.message);
    });
  }, [loading, isAuthenticated, router, strings.loginRequired, loadCart, loadProducts]);

  const addToCart = async (productId: string) => {
    setBusy(true);
    setError(null);
    try {
      await fetchJson('/api/backend/cart/items', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      await loadCart();
      transitionFlow('S5_CART_ACTIVE', {
        reason: 'cart_item_added',
        traceId: traceId ?? undefined,
      });
    } catch (err) {
      setError((err as Error).message);
      transitionFlow('S_ERR', {
        reason: 'cart_add_failed',
        guard: 'cart_server_validation',
        traceId: traceId ?? undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    setBusy(true);
    setError(null);
    try {
      await fetchJson('/api/backend/cart/items', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
      });
      await loadCart();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (productId: string) => {
    setBusy(true);
    setError(null);
    try {
      await fetchJson(`/api/backend/cart/items/${productId}`, { method: 'DELETE' });
      await loadCart();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleCheckout = () => {
    emitUiEvent('cta_click', { label: 'cart_checkout', location: 'cart' }, traceId ?? undefined);
    router.push('/checkout');
  };

  if (!loading && !isAuthenticated) {
    return (
      <div className="min-h-screen">
        <div className="mx-auto max-w-4xl px-6 py-12 text-center">
          <div className="market-shell">
            <h1 className="section-title text-3xl text-slate-900" data-testid="cart-title">
              {strings.title}
            </h1>
            <p className="mt-2 text-sm text-slate-700">{strings.loginRequired}</p>
            <div className="mt-6 grid gap-3 text-start">
              <div
                data-testid="cart-items"
                className="market-panel-soft p-4 text-xs text-slate-600"
              >
                برای مشاهده جزئیات سبد خرید وارد حساب شوید.
              </div>
              <div
                data-testid="cart-summary"
                className="market-panel-soft p-4 text-xs text-slate-600"
              >
                خلاصه مالی بعد از ورود نمایش داده می‌شود.
              </div>
            </div>
            <Link
              href="/auth/login?next=/cart"
              className="btn btn-3d mt-5 inline-flex"
              data-testid="cart-checkout-cta"
            >
              ورود
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isEmpty = !cart || cart.items.length === 0;

  return (
    <div className="min-h-screen" data-trace-id={traceId ?? undefined}>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <PageHeader
          eyebrow="Commerce Flow"
          title={strings.title}
          subtitle={strings.subtitle}
          chips={['Cart State Synced', 'Real Backend', 'Idempotent-ready']}
          titleTestId="cart-title"
          actions={
            <>
              <LocaleSwitch />
              <AuthNavButton />
            </>
          }
        />

        <div className="mt-6 flex flex-wrap gap-2">
          {promoBanners.map((banner) => (
            <span key={banner.title} className="market-strip">
              {banner.badge}: {banner.subtitle}
            </span>
          ))}
        </div>

        {error ? (
          <p className="mt-6 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="market-shell mt-8">
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <section className="market-panel p-6" data-testid="cart-items">
              <div className="flex items-center justify-between">
                <h2 className="section-title text-xl text-slate-900">{strings.items}</h2>
                <span className="market-strip">{cart?.items?.length || 0} آیتم</span>
              </div>

              {isEmpty ? (
                <div className="market-panel-soft mt-6 p-5 text-sm text-slate-600">
                  {strings.empty}
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {(cart?.items || []).map((item) => (
                    <article
                      key={item.productId}
                      className="market-list-item flex flex-wrap items-center justify-between gap-4 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm text-slate-900">{item.productName}</p>
                        <p className="text-xs text-slate-600">{item.productSku}</p>
                      </div>
                      <div className="text-end text-sm text-slate-700">
                        <p>{formatter.format(item.price)}</p>
                        <div className="mt-2 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                            onClick={() =>
                              updateQuantity(item.productId, Math.max(1, item.quantity - 1))
                            }
                            disabled={busy}
                            aria-busy={busy}
                          >
                            -
                          </button>
                          <span className="text-xs">{item.quantity}</span>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            disabled={busy}
                            aria-busy={busy}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700"
                            onClick={() => removeItem(item.productId)}
                            disabled={busy}
                            aria-busy={busy}
                          >
                            حذف
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <div className="mt-8 border-t border-slate-200 pt-5">
                <h3 className="text-sm text-slate-700">{strings.quickAdd}</h3>
                <div className="market-banner-grid mt-3 sm:grid-cols-2 lg:grid-cols-3">
                  {catalog.map((product) => (
                    <div key={product.id} className="market-banner-card">
                      <Image
                        src={productImages[Math.abs(product.id.length) % productImages.length]}
                        alt={product.name}
                        width={640}
                        height={380}
                        className="h-28 w-full object-cover"
                      />
                      <div className="p-3">
                        <p className="text-sm text-slate-900">{product.name}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {formatter.format(product.price)}
                        </p>
                        <button
                          type="button"
                          className="btn btn-3d mt-3 text-xs"
                          onClick={() => addToCart(product.id)}
                          disabled={busy}
                          aria-busy={busy}
                        >
                          افزودن به سبد
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside
              className="market-panel h-fit p-6 lg:sticky lg:top-32"
              data-testid="cart-summary"
            >
              <h2 className="section-title text-xl text-slate-900">{strings.summary}</h2>
              <div className="mt-6 space-y-3 text-sm text-slate-700">
                <div className="market-kpi flex items-center justify-between">
                  <span>جمع کالاها</span>
                  <span>{formatter.format(cart?.subtotal || 0)}</span>
                </div>
                <div className="market-kpi flex items-center justify-between">
                  <span>تخفیف</span>
                  <span>{formatter.format(cart?.discount || 0)}</span>
                </div>
                <div className="market-kpi flex items-center justify-between">
                  <span>مالیات</span>
                  <span>{formatter.format(cart?.taxAmount || 0)}</span>
                </div>
                <div className="market-kpi flex items-center justify-between">
                  <span>ارسال</span>
                  <span>{formatter.format(cart?.shippingCost || 0)}</span>
                </div>
                <div className="market-panel-soft p-4 text-slate-900">
                  <div className="flex items-center justify-between">
                    <span>{strings.total}</span>
                    <span className="text-lg font-semibold">
                      {formatter.format(cart?.total || 0)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <Button
                  loading={false}
                  onClick={handleCheckout}
                  disabled={isEmpty}
                  className="btn-3d"
                  data-testid="cart-checkout-cta"
                >
                  {strings.checkout}
                </Button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
