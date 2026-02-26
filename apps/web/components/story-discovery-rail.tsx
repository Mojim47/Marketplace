'use client';

import { ArrowLeft, ArrowRight, ArrowUpRight, X } from 'lucide-react';
import NextImage from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type StoryManifestItem = {
  storyId: string;
  vendorId: string;
  vendorName: string;
  title: string;
  caption?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  expiresAt: string;
  signedMediaUrl: string;
  rankScore: number;
  freshnessScore: number;
  ctr: number;
  conversionRate: number;
  palette: {
    bg: string;
    accent: string;
    text: string;
  };
};

type StoryManifestResponse = {
  generatedAt: string;
  ttlSeconds: number;
  sessionId: string;
  items: StoryManifestItem[];
};

type StoryEventPayload = {
  type: 'impression' | 'click' | 'conversion';
  storyId?: string;
  vendorId?: string;
  sessionId?: string;
  traceId?: string;
  meta?: Record<string, unknown>;
};

function emitStoryEvent(payload: StoryEventPayload) {
  const body = JSON.stringify(payload);
  if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon('/api/stories/events', blob);
    return;
  }
  if (typeof fetch !== 'undefined') {
    fetch('/api/stories/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }
}

function withStoryAttribution(
  url: string | null | undefined,
  story: StoryManifestItem
): string | null {
  if (!url) {
    return null;
  }
  if (typeof window === 'undefined') {
    return url;
  }
  try {
    const target = url.startsWith('/') ? new URL(url, window.location.origin) : new URL(url);
    if (target.origin === window.location.origin) {
      target.searchParams.set('storyId', story.storyId);
      target.searchParams.set('storyVendor', story.vendorId);
      return `${target.pathname}${target.search}${target.hash}`;
    }
    return target.toString();
  } catch {
    return null;
  }
}

export function StoryDiscoveryRail() {
  const [stories, setStories] = useState<StoryManifestItem[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const seenStories = useRef<Set<string>>(new Set());
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const tone = useMemo(() => {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18 ? 'day' : 'night';
  }, []);

  const activeStory = activeIndex === null ? null : stories[activeIndex] || null;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadManifest() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/stories/manifest?limit=14', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`http_${response.status}`);
        }
        const data = (await response.json()) as StoryManifestResponse;
        if (cancelled) {
          return;
        }
        setStories(Array.isArray(data.items) ? data.items : []);
        setSessionId(data.sessionId);
      } catch {
        if (!cancelled) {
          setError('Storyها فعلا در دسترس نیستند.');
          setStories([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadManifest();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (stories.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) {
            continue;
          }
          const storyId = entry.target.getAttribute('data-story-id');
          if (!storyId || seenStories.current.has(storyId)) {
            continue;
          }
          const story = stories.find((item) => item.storyId === storyId);
          if (!story) {
            continue;
          }
          seenStories.current.add(storyId);
          emitStoryEvent({
            type: 'impression',
            storyId: story.storyId,
            vendorId: story.vendorId,
            sessionId,
            meta: { surface: 'home_story_rail' },
          });
        }
      },
      { threshold: [0.6] }
    );

    for (const story of stories) {
      const node = cardRefs.current.get(story.storyId);
      if (node) {
        observer.observe(node);
      }
    }

    return () => observer.disconnect();
  }, [sessionId, stories]);

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }
    const nextStory = stories[activeIndex + 1];
    if (!nextStory || typeof window === 'undefined') {
      return;
    }
    const preload = new window.Image();
    preload.src = nextStory.signedMediaUrl;
  }, [activeIndex, stories]);

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveIndex(null);
        return;
      }
      if (event.key === 'ArrowRight') {
        setActiveIndex((prev) => {
          if (prev === null) {
            return null;
          }
          return Math.min(stories.length - 1, prev + 1);
        });
      }
      if (event.key === 'ArrowLeft') {
        setActiveIndex((prev) => {
          if (prev === null) {
            return null;
          }
          return Math.max(0, prev - 1);
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, stories.length]);

  const handleCta = useCallback(
    (story: StoryManifestItem) => {
      const targetUrl = withStoryAttribution(story.ctaUrl, story);
      if (!targetUrl || typeof window === 'undefined') {
        return;
      }
      emitStoryEvent({
        type: 'click',
        storyId: story.storyId,
        vendorId: story.vendorId,
        sessionId,
        meta: { surface: 'home_story_viewer', ctaUrl: story.ctaUrl || null },
      });
      window.location.assign(targetUrl);
    },
    [sessionId]
  );

  return (
    <section
      className={`mt-10 rounded-3xl border p-5 sm:p-6 ${
        tone === 'day'
          ? 'border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-100'
          : 'border-slate-700 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950'
      }`}
      aria-label="Stories Discovery"
    >
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className={`text-xs ${tone === 'day' ? 'text-orange-700' : 'text-amber-200'}`}>
            Story Discovery
          </p>
          <h2
            className={`mt-1 text-2xl font-bold ${tone === 'day' ? 'text-slate-900' : 'text-white'}`}
          >
            استوری فروشنده‌ها
          </h2>
        </div>
        <p className={`text-xs ${tone === 'day' ? 'text-slate-600' : 'text-slate-300'}`}>
          رتبه‌بندی براساس تازگی + CTR + Conversion
        </p>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: deterministic skeleton rows
              key={idx}
              className="h-44 min-w-[220px] animate-pulse rounded-2xl bg-white/40"
            />
          ))}
        </div>
      ) : null}

      {!loading && error ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            tone === 'day'
              ? 'border-amber-300 bg-amber-50 text-amber-700'
              : 'border-amber-300/30 bg-amber-400/10 text-amber-200'
          }`}
        >
          {error}
        </div>
      ) : null}

      {!loading && !error && stories.length === 0 ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            tone === 'day'
              ? 'border-slate-200 bg-white text-slate-600'
              : 'border-slate-600 bg-slate-900/40 text-slate-300'
          }`}
        >
          Story فعالی برای نمایش وجود ندارد.
        </div>
      ) : null}

      {!loading && !error && stories.length > 0 ? (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {stories.map((story) => (
            <button
              key={story.storyId}
              ref={(node) => {
                if (node) {
                  cardRefs.current.set(story.storyId, node);
                } else {
                  cardRefs.current.delete(story.storyId);
                }
              }}
              type="button"
              data-story-id={story.storyId}
              className="group relative min-h-[190px] min-w-[232px] overflow-hidden rounded-2xl border border-white/50 text-left transition-transform duration-150 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              style={{ background: story.palette.bg }}
              onClick={() => {
                const index = stories.findIndex((item) => item.storyId === story.storyId);
                if (index >= 0) {
                  setActiveIndex(index);
                }
              }}
            >
              <NextImage
                src={story.signedMediaUrl}
                alt={story.title}
                fill
                unoptimized
                className="object-cover"
                loading="lazy"
                sizes="(min-width: 1024px) 240px, 70vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 space-y-1 p-3 text-white">
                <p className="text-[11px] uppercase tracking-[0.18em] text-orange-200">
                  {story.vendorName}
                </p>
                <p className="line-clamp-2 text-sm font-semibold">{story.title}</p>
                <div className="flex items-center justify-between text-[11px] text-white/80">
                  <span>Fresh {Math.round(story.freshnessScore * 100)}%</span>
                  <span>CTR {Math.round(story.ctr * 100)}%</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {activeStory ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 sm:p-6">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-slate-950">
            <NextImage
              src={activeStory.signedMediaUrl}
              alt={activeStory.title}
              width={1600}
              height={1200}
              unoptimized
              className="h-[74vh] w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
            <button
              type="button"
              onClick={() => setActiveIndex(null)}
              className="absolute right-4 top-4 rounded-full border border-white/40 bg-black/40 p-2 text-white transition-colors duration-150 hover:bg-black/65"
              aria-label="بستن استوری"
            >
              <X size={18} />
            </button>

            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
              <div className="mb-3 flex items-center gap-2 text-xs text-orange-200">
                <span>{activeStory.vendorName}</span>
                <span>•</span>
                <span>Rank {activeStory.rankScore.toFixed(2)}</span>
              </div>
              <h3 className="text-2xl font-bold text-white sm:text-3xl">{activeStory.title}</h3>
              {activeStory.caption ? (
                <p className="mt-2 max-w-2xl text-sm text-slate-100 sm:text-base">
                  {activeStory.caption}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {activeStory.ctaUrl ? (
                  <button
                    type="button"
                    onClick={() => handleCta(activeStory)}
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90"
                    style={{
                      backgroundColor: activeStory.palette.accent,
                      color: activeStory.palette.text,
                    }}
                  >
                    {activeStory.ctaLabel || 'مشاهده محصول'}
                    <ArrowUpRight size={14} />
                  </button>
                ) : null}
                <span className="rounded-full border border-white/25 bg-black/30 px-3 py-1 text-xs text-white/80">
                  Conversion {Math.round(activeStory.conversionRate * 100)}%
                </span>
              </div>
            </div>

            <div className="absolute left-0 right-0 top-1/2 flex -translate-y-1/2 justify-between px-2">
              <button
                type="button"
                onClick={() =>
                  setActiveIndex((prev) => (prev === null ? 0 : Math.max(0, prev - 1)))
                }
                className="rounded-full border border-white/40 bg-black/40 p-2 text-white disabled:opacity-40"
                disabled={activeIndex === 0}
                aria-label="استوری قبلی"
              >
                <ArrowLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveIndex((prev) =>
                    prev === null ? 0 : Math.min(stories.length - 1, prev + 1)
                  )
                }
                className="rounded-full border border-white/40 bg-black/40 p-2 text-white disabled:opacity-40"
                disabled={activeIndex === stories.length - 1}
                aria-label="استوری بعدی"
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
