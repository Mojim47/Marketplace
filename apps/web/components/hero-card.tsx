'use client';

import clsx from 'clsx';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import useSWR from 'swr';
import { type HeroAsset, HeroAssetSchema } from '../../../libs/common/src/contracts/hero.contract';

const fetcher = async (url: string): Promise<HeroAsset> => {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Failed to load hero asset');
  const data = await res.json();
  return HeroAssetSchema.parse({
    id: data.id,
    name: data.name ?? data.title ?? 'Untitled Asset',
    version: data.version ?? data.metadata?.version ?? '1.0.0',
    spatialData: data.spatialData ?? data.metadata ?? {},
  });
};

const useHeroAsset = () =>
  useSWR<HeroAsset>('/v1/marketplace/hero', fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: true,
  });

const glass =
  'relative overflow-hidden rounded-3xl border border-semantic-border-subtle bg-semantic-surface-glass/40 backdrop-blur-glass shadow-2xl';

export function HeroCard() {
  const { data, isLoading, error } = useHeroAsset();

  const asset = useMemo<HeroAsset>(
    () =>
      data ?? {
        id: 'fallback-hero',
        name: 'Elite Showcase Asset',
        version: '1.0.0',
        spatialData: { status: 'fallback' },
      },
    [data]
  );

  if (isLoading) {
    return (
      <div className="relative isolate grid gap-6 lg:grid-cols-5">
        <div
          className={clsx(
            glass,
            'animate-pulse bg-semantic-surface-glass text-transparent lg:col-span-3 p-8'
          )}
        >
          <div className="mb-4 h-6 w-32 rounded-full bg-semantic-surface-elevated" />
          <div className="mb-6 h-12 w-3/4 rounded-full bg-semantic-surface-elevated" />
          <div className="mb-2 h-4 w-full rounded-full bg-semantic-surface-elevated" />
          <div className="mb-2 h-4 w-5/6 rounded-full bg-semantic-surface-elevated" />
          <div className="mt-8 h-12 w-40 rounded-full bg-semantic-surface-elevated" />
        </div>
        <div
          className={clsx(
            glass,
            'h-full min-h-64 animate-pulse bg-semantic-surface-glass lg:col-span-2'
          )}
        />
      </div>
    );
  }

  return (
    <section className="relative isolate">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-neon-radial blur-3xl opacity-80 animate-orb" />
      <div className="absolute inset-0 -z-10 bg-noise mix-blend-soft-light opacity-30" />

      <div className="relative grid gap-6 lg:grid-cols-5">
        <div className={clsx(glass, 'bg-semantic-surface-default/80 lg:col-span-3 p-8')}>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-semantic-border-subtle bg-semantic-surface-glass px-4 py-2 text-xs font-semibold uppercase tracking-wide text-semantic-text-secondary">
            <Sparkles size={16} className="text-semantic-accent-secondary" />
            <span>Asset Version {asset.version}</span>
          </div>

          <h2 className="section-title mb-4 text-3xl font-semibold text-semantic-text-primary sm:text-4xl">
            {asset.name}
          </h2>

          <p className="max-w-2xl leading-relaxed text-semantic-text-secondary">
            ویترین AR محصول با کیفیت عملیاتی: پیش‌نمایش فضایی، ارزیابی ایمنی تجربه، و آمادگی
            مستقیم برای مسیر خرید.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-200">
              دقت هم‌ترازی: <strong className="text-cyan-300">97%</strong>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-200">
              تاخیر پایپ‌لاین: <strong className="text-emerald-300">&lt;50ms</strong>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-200">
              نرخ موفقیت رندر: <strong className="text-amber-300">99.1%</strong>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="relative overflow-hidden rounded-full border border-semantic-border-strong bg-gradient-to-r from-semantic-accent-primary via-semantic-highlight to-semantic-accent-secondary px-6 py-3 text-sm font-semibold text-semantic-text-primary shadow-2xl"
            >
              <span className="relative z-10 flex items-center gap-2">
                اجرای پیش‌نمایش AR
                <ArrowRight size={18} />
              </span>
              <motion.span
                aria-hidden
                className="absolute inset-0 bg-semantic-highlight/30"
                initial={{ x: '-120%' }}
                animate={{ x: '120%' }}
                transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
              />
            </motion.button>

            {error && (
              <div className="flex items-center gap-2 text-sm text-semantic-warning">
                <Loader2 size={16} className="animate-spin" />
                داده نمونه جایگزین شد
              </div>
            )}
          </div>
        </div>

        <div className={clsx(glass, 'bg-semantic-surface-default/80 lg:col-span-2')}>
          <div className="relative h-full min-h-64 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-semantic-surface-elevated via-semantic-surface-glass to-semantic-surface-elevated">
            <div className="absolute inset-0 bg-noise opacity-40 mix-blend-soft-light" />
            <div className="absolute inset-0 animate-orb bg-neon-radial blur-3xl opacity-70" />
            <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4 text-semantic-text-secondary">
              <div className="flex items-center gap-3 text-sm uppercase tracking-widest">
                <Loader2 size={18} className="animate-spin" />
                Spatial Preview
              </div>
              <p className="text-center text-lg font-medium text-semantic-text-primary">
                موتور نمایش AR برای صفحه محصول آماده است
              </p>
              <p className="max-w-sm text-center text-xs text-semantic-text-muted">
                در صفحه جزئیات محصول فعال می‌شود و با معیارهای تاخیر/پایداری پایش می‌گردد.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroCard;
