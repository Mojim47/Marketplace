'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { l1Categories } from '@/lib/aimarket-taxonomy';

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

function toSearchHref(text: string, categoryScope: string) {
  const query = encodeURIComponent(text);
  return categoryScope === 'all'
    ? `/categories?q=${query}`
    : `/categories?q=${query}&group=${encodeURIComponent(categoryScope)}`;
}

export function SearchBox({ compact = false, mega = false }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [categoryScope, setCategoryScope] = useState('all');
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setSuggestions([]);
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
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [query, categoryScope]);

  const trendingChips = useMemo(
    () =>
      suggestions
        .filter((item) => item.type === 'trending')
        .slice(0, compact ? 3 : 5),
    [compact, suggestions]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (!query.trim()) {
      event.preventDefault();
      return;
    }

    try {
      await fetch('/api/search/suggestions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query,
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

      {open && (isLoading || suggestions.length > 0) ? (
        <div className="absolute inset-x-0 z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          {isLoading ? <p className="px-2 py-2 text-xs text-slate-500">در حال پیشنهاد...</p> : null}

          <ul className="space-y-1">
            {suggestions.map((item) => (
              <li key={`${item.type}-${item.value}-${item.categorySlug ?? 'all'}`}>
                <Link
                  href={toSearchHref(item.value, item.categorySlug ?? categoryScope)}
                  className="flex items-center justify-between rounded-xl px-2 py-2 text-xs text-slate-800 transition hover:bg-slate-50"
                  onClick={() => {
                    setQuery(item.value);
                    setOpen(false);
                  }}
                >
                  <span>{item.label}</span>
                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500">
                    {item.type === 'history' ? 'History' : item.type === 'trending' ? 'Trending' : 'Category'}
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
