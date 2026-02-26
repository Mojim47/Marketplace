'use client';

import { Button } from '@/components/ui';
import { useTraceId } from '@/hooks/use-trace-id';
import { emitCommerceEvent } from '@/lib/ui-telemetry';
import Link from 'next/link';
import { useEffect } from 'react';

type ProductActionPanelProps = {
  productId: string;
  productSlug: string;
  category: string;
};

export function ProductActionPanel({ productId, productSlug, category }: ProductActionPanelProps) {
  const traceId = useTraceId();

  useEffect(() => {
    emitCommerceEvent(
      'impression',
      {
        surface: 'product_detail',
        productId,
        productSlug,
        category,
      },
      traceId ?? undefined
    );
  }, [category, productId, productSlug, traceId]);

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Link
        href={`/checkout?sku=${encodeURIComponent(productId)}`}
        className="btn btn-primary inline-flex items-center justify-center"
        onClick={() => {
          emitCommerceEvent(
            'click',
            {
              surface: 'product_detail',
              productId,
              productSlug,
              action: 'add_to_cart',
            },
            traceId ?? undefined
          );
        }}
      >
        افزودن به سبد
      </Link>

      <Button
        variant="outline"
        loading={false}
        onClick={() => {
          emitCommerceEvent(
            'click',
            {
              surface: 'product_detail',
              productId,
              productSlug,
              action: 'request_invoice',
            },
            traceId ?? undefined
          );
        }}
      >
        درخواست پیش‌فاکتور
      </Button>

      <Link
        href={`/categories?group=${encodeURIComponent(category)}`}
        className="btn btn-ghost inline-flex items-center justify-center"
        onClick={() => {
          emitCommerceEvent(
            'click',
            {
              surface: 'product_detail',
              productId,
              productSlug,
              action: 'view_similar',
            },
            traceId ?? undefined
          );
        }}
      >
        محصولات مشابه
      </Link>
    </div>
  );
}