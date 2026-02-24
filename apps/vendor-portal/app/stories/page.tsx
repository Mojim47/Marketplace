'use client';

import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { VendorShell } from '../../components/VendorShell';

type StoryCapability = {
  vendorId: string;
  storiesEnabled: boolean;
};

type VendorStory = {
  id: string;
  title: string;
  media_url: string;
  caption?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  expires_at: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const DEFAULT_VENDOR_ID = process.env.NEXT_PUBLIC_VENDOR_ID || 'vendor-techhub';

export default function VendorStoriesPage() {
  const [vendorId] = useState(DEFAULT_VENDOR_ID);
  const [capability, setCapability] = useState<StoryCapability | null>(null);
  const [stories, setStories] = useState<VendorStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    mediaUrl: '',
    caption: '',
    ctaLabel: '',
    ctaUrl: '',
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [capabilityRes, storiesRes] = await Promise.all([
        fetch(`${API_BASE}/v1/vendors/${vendorId}/story-capability`, { cache: 'no-store' }),
        fetch(`${API_BASE}/v1/vendors/${vendorId}/stories`, { cache: 'no-store' }),
      ]);

      if (!capabilityRes.ok || !storiesRes.ok) {
        throw new Error('fetch_failed');
      }

      const capabilityJson = (await capabilityRes.json()) as StoryCapability;
      const storiesJson = (await storiesRes.json()) as VendorStory[];
      setCapability(capabilityJson);
      setStories(storiesJson);
    } catch {
      setError('اتصال به API برقرار نشد یا داده Story در دسترس نیست.');
      setCapability({ vendorId, storiesEnabled: false });
      setStories([]);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeCount = useMemo(
    () =>
      stories.filter((story) => {
        const expiresAt = new Date(story.expires_at).getTime();
        return Number.isFinite(expiresAt) && expiresAt > Date.now();
      }).length,
    [stories]
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!capability?.storiesEnabled) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/v1/vendors/${vendorId}/stories`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        throw new Error(`http_${response.status}`);
      }

      setForm({ title: '', mediaUrl: '', caption: '', ctaLabel: '', ctaUrl: '' });
      await refresh();
    } catch {
      setError('ثبت Story انجام نشد. دسترسی یا ورودی را بررسی کنید.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <VendorShell
      title="استوری فروشنده"
      subtitle="Storyهای کوتاه برای اعلام کمپین، موجودی جدید و CTA مستقیم به مخاطب."
    >
      <section className="vendor-grid cols-3">
        <article className="vendor-card vendor-item">
          <div className="vendor-muted">Vendor ID</div>
          <p className="vendor-kpi story-mini">{vendorId}</p>
        </article>
        <article className="vendor-card vendor-item">
          <div className="vendor-muted">Story فعال</div>
          <p className="vendor-kpi">{activeCount}</p>
        </article>
        <article className="vendor-card vendor-item">
          <div className="vendor-muted">وضعیت دسترسی</div>
          <p className="vendor-kpi">
            {loading ? '...' : capability?.storiesEnabled ? 'روشن' : 'خاموش'}
          </p>
        </article>
      </section>

      {error ? <div className="story-alert">{error}</div> : null}

      <section className="vendor-grid cols-2">
        <article className="vendor-card vendor-item story-composer">
          <h2 className="story-title">ایجاد Story جدید</h2>
          <p className="vendor-muted">حداکثر 24 ساعت نمایش در پنل فروشنده.</p>

          <form className="story-form" onSubmit={onSubmit}>
            <label>
              عنوان
              <input
                required
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="مثلا: تخفیف ویژه پایان هفته"
              />
            </label>

            <label>
              لینک تصویر/ویدیو
              <input
                required
                value={form.mediaUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, mediaUrl: event.target.value }))}
                placeholder="https://cdn.example.com/story-cover.jpg"
              />
            </label>

            <label>
              کپشن
              <textarea
                value={form.caption}
                onChange={(event) => setForm((prev) => ({ ...prev, caption: event.target.value }))}
                placeholder="متن کوتاه برای Story..."
                rows={3}
              />
            </label>

            <div className="story-form-row">
              <label>
                CTA Label
                <input
                  value={form.ctaLabel}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, ctaLabel: event.target.value }))
                  }
                  placeholder="مشاهده محصول"
                />
              </label>
              <label>
                CTA URL
                <input
                  value={form.ctaUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, ctaUrl: event.target.value }))}
                  placeholder="/products/sku-123"
                />
              </label>
            </div>

            <button
              type="submit"
              className="story-submit"
              disabled={submitting || !capability?.storiesEnabled}
            >
              {submitting ? 'در حال انتشار...' : 'انتشار Story'}
            </button>
          </form>
        </article>

        <article className="vendor-card vendor-item">
          <h2 className="story-title">لیست Storyها</h2>
          <div className="story-list">
            {stories.length === 0 ? (
              <p className="vendor-muted">Story فعالی ثبت نشده است.</p>
            ) : (
              stories.map((story) => (
                <div key={story.id} className="story-item">
                  <div className="story-thumb">
                    <Image
                      src={story.media_url}
                      alt={story.title}
                      width={92}
                      height={92}
                      loading="lazy"
                      unoptimized
                    />
                  </div>
                  <div>
                    <p className="story-item-title">{story.title}</p>
                    <p className="vendor-muted">{story.caption || 'بدون کپشن'}</p>
                    <p className="vendor-muted">
                      انقضا: {new Date(story.expires_at).toLocaleString('fa-IR')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </VendorShell>
  );
}
