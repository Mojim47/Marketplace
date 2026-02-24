'use client';

import { AdminPanelShell } from '@/components/AdminPanelShell';
import { buildApiUrl } from '@/lib/api';
import { useEffect, useMemo, useState } from 'react';

type VendorStoryCapability = {
  vendorId: string;
  vendorName: string;
  active: boolean;
  storiesEnabled: boolean;
  createdAt: string;
};

const fallbackVendors: VendorStoryCapability[] = [
  {
    vendorId: 'vendor-techhub',
    vendorName: 'TechHub',
    active: true,
    storiesEnabled: true,
    createdAt: new Date().toISOString(),
  },
  {
    vendorId: 'vendor-smarthomex',
    vendorName: 'SmartHomeX',
    active: true,
    storiesEnabled: false,
    createdAt: new Date().toISOString(),
  },
  {
    vendorId: 'vendor-audiopro',
    vendorName: 'AudioPro',
    active: false,
    storiesEnabled: false,
    createdAt: new Date().toISOString(),
  },
];

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<VendorStoryCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadVendors() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(buildApiUrl('/admin/vendors/story-capabilities'), {
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`http_${response.status}`);
        }

        const data = (await response.json()) as VendorStoryCapability[];
        if (!cancelled) {
          setVendors(Array.isArray(data) && data.length > 0 ? data : fallbackVendors);
        }
      } catch {
        if (!cancelled) {
          setError('ارتباط با API برقرار نشد؛ داده نمونه نمایش داده می‌شود.');
          setVendors(fallbackVendors);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadVendors();
    return () => {
      cancelled = true;
    };
  }, []);

  const enabledCount = useMemo(
    () => vendors.filter((vendor) => vendor.storiesEnabled && vendor.active).length,
    [vendors]
  );

  async function toggleVendor(vendorId: string, nextValue: boolean) {
    const previous = vendors;
    setSaving((prev) => ({ ...prev, [vendorId]: true }));
    setVendors((prev) =>
      prev.map((vendor) =>
        vendor.vendorId === vendorId ? { ...vendor, storiesEnabled: nextValue } : vendor
      )
    );

    try {
      const response = await fetch(buildApiUrl(`/admin/vendors/${vendorId}/story-capability`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: nextValue }),
      });

      if (!response.ok) {
        throw new Error(`http_${response.status}`);
      }
    } catch {
      setVendors(previous);
      setError('ثبت تنظیمات انجام نشد. لطفا دوباره تلاش کنید.');
    } finally {
      setSaving((prev) => ({ ...prev, [vendorId]: false }));
    }
  }

  return (
    <AdminPanelShell
      title="مدیریت Stories فروشندگان"
      subtitle="روشن/خاموش کردن قابلیت Story به‌صورت مستقل برای هر فروشنده."
    >
      <section className="mb-4 grid gap-3 md:grid-cols-3">
        <article className="admin-card rounded-2xl p-4">
          <p className="text-xs text-slate-400">کل فروشندگان</p>
          <p className="mt-2 text-2xl font-semibold text-white">{vendors.length}</p>
        </article>
        <article className="admin-card rounded-2xl p-4">
          <p className="text-xs text-slate-400">Story فعال</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">{enabledCount}</p>
        </article>
        <article className="admin-card rounded-2xl p-4">
          <p className="text-xs text-slate-400">وضعیت بارگذاری</p>
          <p className="mt-2 text-sm text-slate-200">
            {loading ? 'در حال همگام سازی...' : 'همگام'}
          </p>
        </article>
      </section>

      {error ? (
        <div className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-200/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {vendors.map((vendor) => {
          const isSaving = Boolean(saving[vendor.vendorId]);
          return (
            <article
              key={vendor.vendorId}
              className="admin-card relative overflow-hidden rounded-2xl border border-white/10 p-5"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-300 via-cyan-300 to-emerald-300" />
              <h2 className="text-lg font-semibold text-white">{vendor.vendorName}</h2>
              <p className="mt-2 text-xs text-slate-400">Vendor ID: {vendor.vendorId}</p>
              <div className="mt-4 flex items-center justify-between">
                <span
                  className={`rounded-full border px-3 py-1 text-xs ${
                    vendor.active
                      ? 'border-emerald-400/30 bg-emerald-300/10 text-emerald-200'
                      : 'border-slate-400/20 bg-slate-300/10 text-slate-300'
                  }`}
                >
                  {vendor.active ? 'فعال' : 'غیرفعال'}
                </span>
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={vendor.storiesEnabled}
                    disabled={isSaving}
                    onChange={(event) => {
                      void toggleVendor(vendor.vendorId, event.target.checked);
                    }}
                  />
                  Story
                </label>
              </div>
              <p className="mt-4 text-xs text-slate-400">
                {vendor.storiesEnabled
                  ? 'این فروشنده می‌تواند Story منتشر کند.'
                  : 'Story برای این فروشنده توسط ادمین خاموش است.'}
              </p>
            </article>
          );
        })}
      </div>
    </AdminPanelShell>
  );
}
