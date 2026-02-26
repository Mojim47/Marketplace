'use client';

import { useTraceId } from '@/hooks/use-trace-id';
import type { CatalogProduct } from '@/lib/catalog-data';
import { assignExperimentVariant, emitCommerceEvent, emitExperimentExposure } from '@/lib/ui-telemetry';
import { Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef } from 'react';

type ProductRailProps = {
  title: string;
  subtitle: string;
  products: CatalogProduct[];
};

function Rail({ title, subtitle, products }: ProductRailProps) {
  const money = new Intl.NumberFormat('fa-IR');
  const traceId = useTraceId();
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const seenImpressions = useRef<Set<string>>(new Set());
  const rankingVariant = useMemo(
    () => assignExperimentVariant('home_rail_ranking_v1', ['control', 'balanced'], title),
    [title]
  );

  useEffect(() => {
    emitExperimentExposure(
      'home_rail_ranking_v1',
      rankingVariant,
      {
        surface: 'home_rail',
        rail: title,
      },
      traceId ?? undefined
    );
  }, [rankingVariant, title, traceId]);

  useEffect(() => {
    if (products.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) {
            continue;
          }

          const productId = entry.target.getAttribute('data-product-id');
          const position = Number(entry.target.getAttribute('data-position') || '0');
          if (!productId || seenImpressions.current.has(`${title}:${productId}`)) {
            continue;
          }

          seenImpressions.current.add(`${title}:${productId}`);
          emitCommerceEvent(
            'impression',
            {
              surface: 'home_rail',
              productId,
              rail: title,
              rankingVariant,
              position,
            },
            traceId ?? undefined
          );
        }
      },
      { threshold: [0.6] }
    );

    for (const product of products) {
      const node = cardRefs.current.get(product.id);
      if (node) {
        observer.observe(node);
      }
    }

    return () => observer.disconnect();
  }, [products, rankingVariant, title, traceId]);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="section-title text-2xl text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        <Link href="/categories" className="text-xs text-orange-600 hover:text-orange-700">
          مشاهده همه
        </Link>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {products.map((product, index) => (
          <article
            key={product.id}
            ref={(node) => {
              if (node) {
                cardRefs.current.set(product.id, node);
              } else {
                cardRefs.current.delete(product.id);
              }
            }}
            data-product-id={product.id}
            data-position={index + 1}
            className="group min-w-[220px] max-w-[220px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 transition duration-150 hover:-translate-y-1 hover:border-orange-300"
          >
            <Link
              href={`/product/${product.slug}`}
              onClick={() => {
                emitCommerceEvent(
                  'click',
                  {
                    surface: 'home_rail',
                    productId: product.id,
                    productSlug: product.slug,
                    rail: title,
                    rankingVariant,
                    position: index + 1,
                  },
                  traceId ?? undefined
                );
              }}
            >
              <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  loading="lazy"
                  className="object-cover transition duration-300 group-hover:scale-105"
                  sizes="220px"
                />
              </div>
            </Link>

            <h4 className="mt-3 line-clamp-2 text-sm font-semibold text-slate-900">{product.name}</h4>
            <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">{product.seller}</p>

            <div className="mt-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                <Star size={11} fill="currentColor" />
                {product.rating.toFixed(1)}
              </span>
              <span className="text-xs font-semibold text-slate-900">
                {money.format(product.priceIrr)} تومان
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ProductRails({ products }: { products: CatalogProduct[] }) {
  const forYou = products.slice(0, 6);
  const popularInCity = [...products].sort((a, b) => b.rating - a.rating).slice(0, 6);
  const newFromSellers = [...products].reverse().slice(0, 6);

  return (
    <div className="mt-14 space-y-10">
      <Rail title="پیشنهاد برای تو" subtitle="براساس رفتار مرور و خرید اخیر" products={forYou} />
      <Rail
        title="محبوب در شهر تو"
        subtitle="انتخاب کاربرهای هم‌منطقه با امتیاز بالا"
        products={popularInCity}
      />
      <Rail
        title="جدیدترین از فروشنده‌های محبوب"
        subtitle="محصولات تازه اضافه شده از فروشندگان قابل اعتماد"
        products={newFromSellers}
      />
    </div>
  );
}
