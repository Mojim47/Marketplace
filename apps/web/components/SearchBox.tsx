'use client';

import { l1Categories } from '@/lib/aimarket-taxonomy';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';

type SuggestionItem = {
  type: 'history' | 'trending' | 'category';
  value: string;
  label: string;
  score: number;
  categorySlug?: string | null;
};

type SearchBoxProps = {
  compact?: boolean;
  mega?: boolean;
};

const SEARCH_HISTORY_KEY = 'ng_search_history_v1';
const MAX_HISTORY = 8;
const FALLBACK_TRENDING = [
  'گوشی پرچمدار',
  'لپ‌تاپ سبک',
  'روشنایی هوشمند',
  'هدفون نویزکنسلینگ',
  'سنسور امنیتی',
];

function toSearchHref(text: string, categoryScope: string) {
  const query = encodeURIComponent(text);
  return categoryScope === 'all'
    ? `/categories?q=${query}`
    : `/categories?q=${query}&group=${encodeURIComponent(categoryScope)}`;
}

export function SearchBox({ compact = false, mega = false }: SearchBoxProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [categoryScope, setCategoryScope] = useState('all');
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [historyItems, setHistoryItems] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const saveHistory = (value: string) => {
    const normalized = value.trim();
    if (normalized.length < 2 || typeof window === 'undefined') {
      return;
    }
    const next = [normalized, ...historyItems.filter((item) => item !== normalized)].slice(
      0,
      MAX_HISTORY
    );
    setHistoryItems(next);
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) {
        setHistoryItems(
          parsed.filter((item) => typeof item === 'string' && item.length > 1).slice(0, MAX_HISTORY)
        );
      }
    } catch {
      // Ignore malformed local history.
    }
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };

    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          q: normalized,
          limit: '10',
        });
        if (categoryScope !== 'all') {
          params.set('category', categoryScope);
        }

        const response = await fetch(`/api/search/suggestions?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
        });

        if (!response.ok) {
          setSuggestions([]);
          return;
        }

        const payload = (await response.json()) as { suggestions?: SuggestionItem[] };
        setSuggestions(payload.suggestions ?? []);
        setActiveIndex(-1);
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [query, categoryScope]);

  const offlineSuggestions = useMemo<SuggestionItem[]>(() => {
    const normalized = query.trim().toLowerCase();
    const history = historyItems
      .filter((item) => (normalized ? item.toLowerCase().includes(normalized) : true))
      .slice(0, 4)
      .map((item, index) => ({
        type: 'history' as const,
        value: item,
        label: item,
        score: 1 - index * 0.1,
        categorySlug: categoryScope === 'all' ? null : categoryScope,
      }));

    const trending = FALLBACK_TRENDING.filter((item) =>
      normalized ? item.toLowerCase().includes(normalized) : true
    )
      .slice(0, 4)
      .map((item, index) => ({
        type: 'trending' as const,
        value: item,
        label: item,
        score: 0.7 - index * 0.05,
        categorySlug: categoryScope === 'all' ? null : categoryScope,
      }));

    const taxonomy = l1Categories
      .filter((item) => (normalized ? item.name.toLowerCase().includes(normalized) : true))
      .slice(0, 3)
      .map((item, index) => ({
        type: 'category' as const,
        value: item.name,
        label: `${item.name} • دسته`,
        score: 0.6 - index * 0.05,
        categorySlug: item.slug,
      }));

    return [...history, ...trending, ...taxonomy];
  }, [categoryScope, historyItems, query]);

  const visibleSuggestions = useMemo(() => {
    const combined = [...suggestions, ...offlineSuggestions];
    const deduped = new Map<string, SuggestionItem>();
    for (const item of combined) {
      const key = `${item.value}|${item.categorySlug ?? 'all'}`;
      if (!deduped.has(key)) {
        deduped.set(key, item);
      }
    }
    return Array.from(deduped.values()).slice(0, 10);
  }, [offlineSuggestions, suggestions]);

  const trendingChips = useMemo(
    () => visibleSuggestions.filter((item) => item.type === 'trending').slice(0, compact ? 3 : 5),
    [compact, visibleSuggestions]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    const normalized = query.trim();
    if (!normalized) {
      event.preventDefault();
      return;
    }
    saveHistory(normalized);

    try {
      await fetch('/api/search/suggestions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: normalized,
          categorySlug: categoryScope === 'all' ? null : categoryScope,
        }),
      });
    } catch {
      // Ignore tracking failures.
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <form
        action="/categories"
        className={`flex items-center gap-2 rounded-2xl border border-slate-200 bg-white shadow-sm ${
          mega ? 'px-4 py-3' : 'px-3 py-2'
        }`}
        method="get"
        onSubmit={handleSubmit}
        data-error-state="false"
        data-empty-state={query.trim().length === 0 ? 'true' : 'false'}
      >
        <Search size={16} className="text-slate-500" />
        <input
          className={`w-full rounded-lg bg-white px-2 text-slate-900 outline-none placeholder:text-slate-400 ${
            mega ? 'py-2 text-base' : 'py-1.5 text-sm'
          }`}
          name="q"
          placeholder="جست‌وجوی محصول، برند، فروشنده یا کد دسته‌بندی..."
          type="search"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={(event) => {
            if (!open || visibleSuggestions.length === 0) {
              return;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((prev) => (prev + 1) % visibleSuggestions.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((prev) => (prev <= 0 ? visibleSuggestions.length - 1 : prev - 1));
            } else if (event.key === 'Escape') {
              setOpen(false);
              setActiveIndex(-1);
            } else if (event.key === 'Enter' && activeIndex >= 0) {
              event.preventDefault();
              const current = visibleSuggestions[activeIndex];
              if (current) {
                saveHistory(current.value);
                setOpen(false);
                router.push(toSearchHref(current.value, current.categorySlug ?? categoryScope));
              }
            }
          }}
          autoComplete="off"
        />
        <select
          aria-label="محدوده دسته بندی"
          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
          name="group"
          value={categoryScope}
          onChange={(event) => setCategoryScope(event.target.value)}
        >
          <option value="all">همه</option>
          {l1Categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </form>

      {!compact && trendingChips.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
          {trendingChips.map((keyword) => (
            <Link
              key={`${keyword.label}-${keyword.categorySlug ?? 'all'}`}
              href={toSearchHref(keyword.value, keyword.categorySlug ?? categoryScope)}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 transition hover:border-orange-300 hover:text-orange-600"
            >
              {keyword.label}
            </Link>
          ))}
        </div>
      ) : null}

      {open && (isLoading || visibleSuggestions.length > 0) ? (
        <div className="absolute inset-x-0 z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          {isLoading ? <p className="px-2 py-2 text-xs text-slate-500">در حال پیشنهاد...</p> : null}

          <ul className="space-y-1">
            {visibleSuggestions.map((item, index) => (
              <li key={`${item.type}-${item.value}-${item.categorySlug ?? 'all'}`}>
                <Link
                  href={toSearchHref(item.value, item.categorySlug ?? categoryScope)}
                  className={`flex items-center justify-between rounded-xl px-2 py-2 text-xs text-slate-800 transition hover:bg-slate-50 ${
                    activeIndex === index ? 'bg-slate-100' : ''
                  }`}
                  onClick={() => {
                    setQuery(item.value);
                    saveHistory(item.value);
                    setOpen(false);
                    setActiveIndex(-1);
                  }}
                >
                  <span>{item.label}</span>
                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500">
                    {item.type === 'history'
                      ? 'History'
                      : item.type === 'trending'
                        ? 'Trending'
                        : 'Category'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
