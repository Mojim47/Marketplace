'use client';

import { useTraceId } from '@/hooks/use-trace-id';
import type { CatalogProduct } from '@/lib/catalog-data';
import type { CategoryNode } from '@/lib/categories';
import { l1Categories } from '@/lib/aimarket-taxonomy';
import { emitCommerceEvent } from '@/lib/ui-telemetry';
import { Filter, SlidersHorizontal, Sparkles, Star, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

type SortMode = 'relevance' | 'price-asc' | 'price-desc' | 'rating-desc';

type CategorySearchExperienceProps = {
  cards: CategoryNode[];
  products: CatalogProduct[];
  initialQuery: string;
  initialGroup: string;
  initialLevel: string;
};

const PAGE_SIZE = 8;
const REFRESH_LATENCY_MS = 180;

const money = new Intl.NumberFormat('fa-IR');

function hashDiscount(seed: string) {
  let value = 0;
  for (const char of seed) {
    value += char.charCodeAt(0);
  }
  return 6 + (value % 20);
}

function highlightTerm(text: string, query: string) {
  const normalized = query.trim();
  if (normalized.length < 2) {
    return text;
  }
  const haystack = text.toLowerCase();
  const needle = normalized.toLowerCase();
  const index = haystack.indexOf(needle);
  if (index < 0) {
    return text;
  }

  const before = text.slice(0, index);
  const match = text.slice(index, index + normalized.length);
  const after = text.slice(index + normalized.length);

  return (
    <>
      {before}
      <mark className="rounded bg-amber-100 px-0.5 text-slate-900">{match}</mark>
      {after}
    </>
  );
}

function normalize(input: string) {
  return input.trim().toLowerCase();
}

export function CategorySearchExperience({
  cards,
  products,
  initialQuery,
  initialGroup,
  initialLevel,
}: CategorySearchExperienceProps) {
  const [query, setQuery] = useState(initialQuery);
  const [group, setGroup] = useState(initialGroup);
  const [level, setLevel] = useState(initialLevel);
  const [sortMode, setSortMode] = useState<SortMode>('relevance');
  const [selectedSellers, setSelectedSellers] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);
  const traceId = useTraceId();

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const productCardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const seenProductImpressions = useRef<Set<string>>(new Set());

  const priceBounds = useMemo(() => {
    const numbers = products.map((item) => item.priceIrr);
    if (numbers.length === 0) {
      return { min: 0, max: 0 };
    }
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    return { min, max };
  }, [products]);

  const [priceRange, setPriceRange] = useState({ min: priceBounds.min, max: priceBounds.max });

  useEffect(() => {
    setPriceRange({ min: priceBounds.min, max: priceBounds.max });
  }, [priceBounds.max, priceBounds.min]);

  const sellers = useMemo(
    () => Array.from(new Set(products.map((item) => item.seller))).sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const filteredCards = useMemo(() => {
    const q = normalize(query);

    return cards.filter((item) => {
      const matchesGroup = group ? item.slug === group : true;
      const matchesLevel = level ? item.slug === level : true;
      if (!matchesGroup || !matchesLevel) {
        return false;
      }
      if (!q) {
        return true;
      }
      const hay = `${item.name} ${item.slug} ${item.description ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [cards, group, level, query]);

  const filteredProducts = useMemo(() => {
    const q = normalize(query);
    const filtered = products.filter((item) => {
      if (group && item.category !== group) {
        return false;
      }
      if (selectedSellers.length > 0 && !selectedSellers.includes(item.seller)) {
        return false;
      }
      if (item.priceIrr < priceRange.min || item.priceIrr > priceRange.max) {
        return false;
      }
      if (!q) {
        return true;
      }
      const hay = `${item.name} ${item.seller} ${item.summary} ${item.category}`.toLowerCase();
      return hay.includes(q);
    });

    const ranked = [...filtered];
    switch (sortMode) {
      case 'price-asc':
        ranked.sort((a, b) => a.priceIrr - b.priceIrr);
        break;
      case 'price-desc':
        ranked.sort((a, b) => b.priceIrr - a.priceIrr);
        break;
      case 'rating-desc':
        ranked.sort((a, b) => b.rating - a.rating || a.priceIrr - b.priceIrr);
        break;
      default:
        ranked.sort((a, b) => {
          const aScore = a.rating * 2 + (a.stock > 0 ? 1 : 0);
          const bScore = b.rating * 2 + (b.stock > 0 ? 1 : 0);
          return bScore - aScore;
        });
        break;
    }

    return ranked;
  }, [group, priceRange.max, priceRange.min, products, query, selectedSellers, sortMode]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setRefreshing(true);
    const timer = window.setTimeout(() => setRefreshing(false), REFRESH_LATENCY_MS);
    return () => window.clearTimeout(timer);
  }, [
    query,
    group,
    level,
    sortMode,
    selectedSellers,
    priceRange.min,
    priceRange.max,
  ]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) {
          return;
        }
        setVisibleCount((prev) => {
          if (prev >= filteredProducts.length) {
            return prev;
          }
          return Math.min(filteredProducts.length, prev + PAGE_SIZE);
        });
      },
      { rootMargin: '320px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [filteredProducts.length]);

  useEffect(() => {
    if (refreshing || visibleProducts.length === 0) {
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
          const impressionKey = `${productId}:${group || 'all'}:${sortMode}:${query.trim() || 'all'}`;
          if (!productId || seenProductImpressions.current.has(impressionKey)) {
            continue;
          }

          seenProductImpressions.current.add(impressionKey);
          emitCommerceEvent(
            'impression',
            {
              surface: 'category_grid',
              productId,
              position,
              sortMode,
              query: query.trim() || null,
              group: group || null,
            },
            traceId ?? undefined
          );
        }
      },
      { threshold: [0.6] }
    );

    for (const product of visibleProducts) {
      const node = productCardRefs.current.get(product.id);
      if (node) {
        observer.observe(node);
      }
    }

    return () => observer.disconnect();
  }, [group, query, refreshing, sortMode, traceId, visibleProducts]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (query.trim()) {
      chips.push({
        key: 'query',
        label: `جست وجو: ${query}`,
        onRemove: () => setQuery(''),
      });
    }

    if (group) {
      const category = l1Categories.find((item) => item.slug === group);
      chips.push({
        key: 'group',
        label: `گروه: ${category?.name ?? group}`,
        onRemove: () => setGroup(''),
      });
    }

    if (level) {
      chips.push({
        key: 'level',
        label: `زیرگروه: ${level}`,
        onRemove: () => setLevel(''),
      });
    }

    for (const seller of selectedSellers) {
      chips.push({
        key: `seller-${seller}`,
        label: `فروشنده: ${seller}`,
        onRemove: () => {
          setSelectedSellers((prev) => prev.filter((item) => item !== seller));
        },
      });
    }

    if (priceRange.min !== priceBounds.min || priceRange.max !== priceBounds.max) {
      chips.push({
        key: 'price',
        label: `قیمت: ${money.format(priceRange.min)} تا ${money.format(priceRange.max)}`,
        onRemove: () => setPriceRange({ min: priceBounds.min, max: priceBounds.max }),
      });
    }

    return chips;
  }, [
    group,
    level,
    priceBounds.max,
    priceBounds.min,
    priceRange.max,
    priceRange.min,
    query,
    selectedSellers,
  ]);

  const clearAllFilters = () => {
    setQuery('');
    setGroup('');
    setLevel('');
    setSortMode('relevance');
    setSelectedSellers([]);
    setPriceRange({ min: priceBounds.min, max: priceBounds.max });
  };

  const renderFilterControls = (isBottomSheet: boolean) => (
    <div className={`space-y-5 ${isBottomSheet ? '' : 'rounded-3xl border border-slate-200 bg-white p-5'}`}>
      <div>
        <label className="mb-2 block text-xs text-slate-600" htmlFor={`query-${isBottomSheet ? 'sheet' : 'panel'}`}>
          جست وجو
        </label>
        <input
          id={`query-${isBottomSheet ? 'sheet' : 'panel'}`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
          placeholder="نام محصول، فروشنده یا دسته..."
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs text-slate-600" htmlFor={`group-${isBottomSheet ? 'sheet' : 'panel'}`}>
            گروه اصلی
          </label>
          <select
            id={`group-${isBottomSheet ? 'sheet' : 'panel'}`}
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800"
          >
            <option value="">همه گروه ها</option>
            {l1Categories.map((item) => (
              <option key={item.key} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs text-slate-600" htmlFor={`sort-${isBottomSheet ? 'sheet' : 'panel'}`}>
            مرتب سازی
          </label>
          <select
            id={`sort-${isBottomSheet ? 'sheet' : 'panel'}`}
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800"
          >
            <option value="relevance">مرتبط ترین</option>
            <option value="rating-desc">بیشترین امتیاز</option>
            <option value="price-asc">ارزان ترین</option>
            <option value="price-desc">گران ترین</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs text-slate-600" htmlFor={`level-${isBottomSheet ? 'sheet' : 'panel'}`}>
          اسلاگ زیرگروه (اختیاری)
        </label>
        <input
          id={`level-${isBottomSheet ? 'sheet' : 'panel'}`}
          type="text"
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
          placeholder="example: flagship"
        />
      </div>

      <div>
        <p className="mb-2 text-xs text-slate-600">فروشنده</p>
        <div className="grid max-h-36 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {sellers.map((seller) => {
            const checked = selectedSellers.includes(seller);
            return (
              <label key={seller} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setSelectedSellers((prev) => [...prev, seller]);
                      return;
                    }
                    setSelectedSellers((prev) => prev.filter((item) => item !== seller));
                  }}
                />
                <span>{seller}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
          <span>رنج قیمت</span>
          <span>
            {money.format(priceRange.min)} - {money.format(priceRange.max)} تومان
          </span>
        </div>

        <input
          type="range"
          min={priceBounds.min}
          max={priceBounds.max}
          step={100000}
          value={priceRange.min}
          onChange={(event) => {
            const nextMin = Number(event.target.value);
            setPriceRange((prev) => ({ min: Math.min(nextMin, prev.max), max: prev.max }));
          }}
          className="w-full"
          aria-label="حداقل قیمت"
        />

        <input
          type="range"
          min={priceBounds.min}
          max={priceBounds.max}
          step={100000}
          value={priceRange.max}
          onChange={(event) => {
            const nextMax = Number(event.target.value);
            setPriceRange((prev) => ({ min: prev.min, max: Math.max(nextMax, prev.min) }));
          }}
          className="mt-2 w-full"
          aria-label="حداکثر قیمت"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={clearAllFilters}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs text-slate-700 transition hover:border-orange-300 hover:text-orange-700"
        >
          حذف همه فیلترها
        </button>
        {isBottomSheet ? (
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            className="rounded-full bg-orange-500 px-4 py-2 text-xs text-white"
          >
            اعمال فیلترها
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-orange-700">
            <Sparkles size={12} /> Search-first Layout
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
            2026 UI Motion Budget
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
            Bottom Sheet + Chipbar
          </span>
        </div>

        <h1 className="section-title mt-4 text-3xl text-slate-900 sm:text-4xl">نتایج جست وجو و دسته بندی</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          فیلترهای چندلایه، مرتب سازی سریع، و تجربه لیست محصول با کنترل کامل روی نتایج.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            {filteredCards.length.toLocaleString('fa-IR')} دسته
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            {filteredProducts.length.toLocaleString('fa-IR')} محصول
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Timeout UX: 2.4s</span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="hidden lg:block">{renderFilterControls(false)}</aside>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 lg:hidden">
            <div className="inline-flex items-center gap-2 text-sm text-slate-700">
              <Filter size={16} className="text-orange-500" />
              فیلتر و مرتب سازی
            </div>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"
            >
              <SlidersHorizontal size={14} />
              باز کردن
            </button>
          </div>

          {activeChips.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 transition hover:border-orange-300"
                >
                  <X size={11} />
                  {chip.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              نمایش: {visibleProducts.length.toLocaleString('fa-IR')} /{' '}
              {filteredProducts.length.toLocaleString('fa-IR')}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              مرتب سازی: {sortMode}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              زمان واکنش UI: 180ms
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {refreshing
              ? Array.from({ length: 8 }).map((_, index) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: deterministic skeleton placeholders
                    key={index}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3"
                  >
                    <div className="aspect-[4/5] animate-pulse rounded-xl bg-slate-100" />
                    <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                    <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                    <div className="mt-4 h-8 animate-pulse rounded-xl bg-slate-100" />
                  </div>
                ))
              : visibleProducts.map((product, index) => {
                  const discount = hashDiscount(product.id);
                  return (
                    <article
                      key={product.id}
                      ref={(node) => {
                        if (node) {
                          productCardRefs.current.set(product.id, node);
                        } else {
                          productCardRefs.current.delete(product.id);
                        }
                      }}
                      data-product-id={product.id}
                      data-position={index + 1}
                      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 transition duration-150 hover:-translate-y-1 hover:border-orange-300"
                    >
                      <Link
                        href={`/product/${product.slug}`}
                        className="block"
                        onClick={() => {
                          emitCommerceEvent(
                            'click',
                            {
                              surface: 'category_grid',
                              productId: product.id,
                              productSlug: product.slug,
                              action: 'view_product',
                              position: index + 1,
                              sortMode,
                              query: query.trim() || null,
                              group: group || null,
                            },
                            traceId ?? undefined
                          );
                        }}
                      >
                        <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                          <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            loading="lazy"
                            className="object-cover transition duration-300 group-hover:scale-105"
                            sizes="(min-width: 1280px) 18vw, (min-width: 768px) 30vw, 46vw"
                          />
                          <span className="absolute right-2 top-2 rounded-full bg-rose-500 px-2 py-1 text-[10px] text-white">
                            {discount}% OFF
                          </span>
                        </div>
                      </Link>

                      <h2 className="mt-3 line-clamp-2 text-sm font-semibold text-slate-900">
                        {highlightTerm(product.name, query)}
                      </h2>
                      <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">
                        {highlightTerm(product.seller, query)}
                      </p>

                      <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                        <Star size={11} fill="currentColor" />
                        {product.rating.toFixed(1)}
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                        <p className="text-[10px] text-slate-500">قیمت</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {money.format(product.priceIrr)} تومان
                        </p>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <Link
                          href={`/product/${product.slug}`}
                          className="rounded-full bg-orange-500 px-2 py-2 text-center text-white"
                          onClick={() => {
                            emitCommerceEvent(
                              'click',
                              {
                                surface: 'category_grid',
                                productId: product.id,
                                productSlug: product.slug,
                                action: 'view_product',
                                position: index + 1,
                              },
                              traceId ?? undefined
                            );
                          }}
                        >
                          مشاهده
                        </Link>
                        <Link
                          href={`/checkout?sku=${encodeURIComponent(product.id)}`}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2 py-2 text-center text-slate-700"
                          onClick={() => {
                            emitCommerceEvent(
                              'click',
                              {
                                surface: 'category_grid',
                                productId: product.id,
                                productSlug: product.slug,
                                action: 'quick_buy',
                                position: index + 1,
                              },
                              traceId ?? undefined
                            );
                          }}
                        >
                          خرید سریع
                        </Link>
                      </div>
                    </article>
                  );
                })}
          </div>

          {!refreshing && filteredProducts.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="text-sm text-slate-600">نتیجه ای با این فیلترها پیدا نشد.</p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-4 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-700"
              >
                پاک کردن همه فیلترها
              </button>
            </div>
          ) : null}

          {!refreshing && filteredProducts.length > visibleCount ? (
            <div className="mt-6 flex items-center justify-center">
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((prev) => Math.min(filteredProducts.length, prev + PAGE_SIZE))
                }
                className="rounded-full border border-orange-300 bg-orange-50 px-5 py-2 text-sm text-orange-700 transition hover:bg-orange-100"
              >
                Load more
              </button>
            </div>
          ) : null}

          <div ref={sentinelRef} className="h-1" aria-hidden />
        </section>
      </div>

      <section>
        <h2 className="section-title text-2xl text-slate-900">خلاصه دسته ها</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCards.slice(0, 9).map((category) => (
            <article key={category.id} className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="section-title text-xl text-slate-900">{category.name}</h3>
                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
                  L{category.level}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                {category.description ?? 'بدون توضیح'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {category.children.slice(0, 3).map((child) => (
                  <span
                    key={child.id}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700"
                  >
                    {child.name}
                  </span>
                ))}
              </div>
              <Link
                href={`/categories/${category.slug}`}
                className="mt-4 inline-flex rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs text-slate-700 transition hover:border-orange-300 hover:text-orange-700"
              >
                مشاهده جزئیات
              </Link>
            </article>
          ))}
        </div>
      </section>

      {sheetOpen ? (
        <div className="fixed inset-0 z-[120] bg-black/45 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="بستن پنل فیلتر"
            className="absolute inset-0"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-4 pb-8 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="section-title text-xl text-slate-900">فیلترهای موبایل</h3>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-600"
              >
                <X size={14} />
              </button>
            </div>
            {renderFilterControls(true)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

