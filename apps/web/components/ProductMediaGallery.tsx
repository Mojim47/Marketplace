'use client';

import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import Image from 'next/image';
import { useMemo, useState } from 'react';

type GalleryItem = {
  src: string;
  alt: string;
};

type ProductMediaGalleryProps = {
  items: GalleryItem[];
};

export function ProductMediaGallery({ items }: ProductMediaGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const active = useMemo(() => items[activeIndex] ?? items[0], [activeIndex, items]);

  const goPrev = () => setActiveIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
  const goNext = () => setActiveIndex((prev) => (prev >= items.length - 1 ? 0 : prev + 1));

  if (!active) {
    return null;
  }

  return (
    <>
      <div className="space-y-3">
        <div
          className="group relative h-[390px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
          onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
          onTouchEnd={(event) => {
            const endX = event.changedTouches[0]?.clientX ?? null;
            if (touchStartX === null || endX === null) {
              return;
            }
            const delta = endX - touchStartX;
            if (delta > 45) {
              goPrev();
            } else if (delta < -45) {
              goNext();
            }
          }}
        >
          <Image
            src={active.src}
            alt={active.alt}
            fill
            priority={activeIndex === 0}
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
            sizes="(min-width: 1024px) 48vw, 95vw"
          />

          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
            <span className="rounded-full border border-white/40 bg-black/40 px-3 py-1 text-xs text-white">
              {activeIndex + 1} / {items.length}
            </span>
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-white/40 bg-black/40 px-3 py-1 text-xs text-white transition hover:bg-black/60"
            >
              <ZoomIn size={13} />
              زوم
            </button>
          </div>

          {items.length > 1 ? (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-black/40 p-2 text-white transition hover:bg-black/60"
                aria-label="تصویر قبلی"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-black/40 p-2 text-white transition hover:bg-black/60"
                aria-label="تصویر بعدی"
              >
                <ChevronLeft size={16} />
              </button>
            </>
          ) : null}
        </div>

        {items.length > 1 ? (
          <div className="grid grid-cols-5 gap-2">
            {items.map((item, index) => (
              <button
                key={`${item.src}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`relative overflow-hidden rounded-xl border ${
                  index === activeIndex
                    ? 'border-orange-400 ring-2 ring-orange-200'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                aria-label={`نمایش تصویر ${index + 1}`}
              >
                <div className="relative aspect-[4/3] bg-slate-100">
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    loading="lazy"
                    className="object-cover"
                    sizes="120px"
                  />
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {zoomOpen ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setZoomOpen(false)}
            aria-label="بستن حالت زوم"
          />
          <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-white/20">
            <Image
              src={active.src}
              alt={active.alt}
              width={1800}
              height={1200}
              className="max-h-[84vh] w-full object-contain bg-black"
            />

            <button
              type="button"
              onClick={() => setZoomOpen(false)}
              className="absolute right-3 top-3 rounded-full border border-white/40 bg-black/40 p-2 text-white"
              aria-label="بستن"
            >
              <X size={16} />
            </button>

            {items.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-black/40 p-2 text-white"
                  aria-label="تصویر قبلی"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-black/40 p-2 text-white"
                  aria-label="تصویر بعدی"
                >
                  <ChevronLeft size={18} />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

