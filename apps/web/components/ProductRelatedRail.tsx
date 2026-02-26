'use client';

import type { CatalogProduct } from '@/lib/catalog-data';
import { useTraceId } from '@/hooks/use-trace-id';
import { emitCommerceEvent } from '@/lib/ui-telemetry';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

type ProductRelatedRailProps = {
  products: CatalogProduct[];
};

export function ProductRelatedRail({ products }: ProductRelatedRailProps) {
  const traceId = useTraceId();
  const cardRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const seen = useRef<Set<string>>(new Set());
  const money = new Intl.NumberFormat('fa-IR');

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
          if (!productId || seen.current.has(productId)) {
            continue;
          }
          seen.current.add(productId);
          emitCommerceEvent(
            'impression',
            {
              surface: 'product_related',
              productId,
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
  }, [products, traceId]);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {products.map((item, index) => (
        <Link
          key={item.id}
          href={`/product/${item.slug}`}
          ref={(node) => {
            if (node) {
              cardRefs.current.set(item.id, node);
            } else {
              cardRefs.current.delete(item.id);
            }
          }}
          data-product-id={item.id}
          data-position={index + 1}
          className="rounded-2xl border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5"
          onClick={() => {
            emitCommerceEvent(
              'click',
              {
                surface: 'product_related',
                productId: item.id,
                productSlug: item.slug,
                action: 'view_product',
                position: index + 1,
              },
              traceId ?? undefined
            );
          }}
        >
          <div className="relative h-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            <Image
              src={item.image}
              alt={item.name}
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 20vw, 45vw"
            />
          </div>
          <p className="mt-2 line-clamp-1 text-xs font-semibold text-slate-900">{item.name}</p>
          <p className="mt-1 text-[11px] text-slate-500">{money.format(item.priceIrr)} تومان</p>
        </Link>
      ))}
    </div>
  );
}