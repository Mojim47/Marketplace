'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

type Campaign = {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  tone: string;
};

const campaigns: Campaign[] = [
  {
    id: 'norooz-2026',
    title: 'کمپین نوروز 2026',
    subtitle: 'پیشنهادهای محدود با ارسال سریع و امتیاز وفاداری ویژه.',
    cta: 'مشاهده کمپین',
    href: '/categories?campaign=norooz-2026',
    tone: 'from-cyan-500/25 via-sky-500/15 to-transparent',
  },
  {
    id: 'ai-gadgets',
    title: 'هفته ابزارهای AI',
    subtitle: 'انتخاب هوشمند با فیلترهای مبتنی بر رفتار خرید واقعی.',
    cta: 'کشف محصولات',
    href: '/categories?campaign=ai-week',
    tone: 'from-emerald-500/20 via-cyan-500/15 to-transparent',
  },
  {
    id: 'seller-boost',
    title: 'رشد فروشندگان حرفه‌ای',
    subtitle: 'طرح‌های تشویقی برای فروشندگان با پاسخ‌دهی سریع و رضایت بالا.',
    cta: 'ورود فروشنده',
    href: '/auth/register?as=seller',
    tone: 'from-amber-500/20 via-orange-500/15 to-transparent',
  },
];

export function CampaignCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [automationMode, setAutomationMode] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setAutomationMode(Boolean(window.navigator.webdriver));
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || automationMode) {
      return;
    }
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % campaigns.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [paused, reducedMotion, automationMode]);

  const active = useMemo(() => campaigns[index], [index]);

  return (
    <section
      role="region"
      aria-label="کمپین های ویژه"
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/65 p-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          setIndex((prev) => (prev - 1 + campaigns.length) % campaigns.length);
        } else if (event.key === 'ArrowLeft') {
          setIndex((prev) => (prev + 1) % campaigns.length);
        }
      }}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current;
        const end = event.changedTouches[0]?.clientX ?? null;
        if (start == null || end == null) {
          return;
        }
        const delta = end - start;
        if (delta > 40) {
          setIndex((prev) => (prev - 1 + campaigns.length) % campaigns.length);
        } else if (delta < -40) {
          setIndex((prev) => (prev + 1) % campaigns.length);
        }
      }}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${active.tone}`} />

      <div className="relative z-10 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-h-[9.5rem] sm:min-h-[8rem]">
          <p className="text-xs text-cyan-200">Campaign Engine</p>
          <h3 className="section-title mt-2 text-2xl text-white">{active.title}</h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">{active.subtitle}</p>
          <Link href={active.href} className="btn btn-primary mt-5 inline-flex">
            {active.cta}
          </Link>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            aria-label={paused ? 'ادامه چرخش خودکار' : 'توقف چرخش خودکار'}
            className="rounded-full border border-white/20 bg-white/5 p-2 text-slate-100"
            onClick={() => setPaused((prev) => !prev)}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button
            type="button"
            aria-label="کمپین قبلی"
            className="rounded-full border border-white/20 bg-white/5 p-2 text-slate-100"
            onClick={() => setIndex((prev) => (prev - 1 + campaigns.length) % campaigns.length)}
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            aria-label="کمپین بعدی"
            className="rounded-full border border-white/20 bg-white/5 p-2 text-slate-100"
            onClick={() => setIndex((prev) => (prev + 1) % campaigns.length)}
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      <div className="relative z-10 mt-5 flex items-center gap-2">
        {campaigns.map((item, i) => (
          <button
            key={item.id}
            type="button"
            aria-label={`نمایش کمپین ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${i === index ? 'w-8 bg-cyan-300' : 'w-3 bg-white/30'}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  );
}
