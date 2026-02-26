'use client';

import { AdminPanelShell } from '@/components/AdminPanelShell';
import { buildApiUrl } from '@/lib/api';
import { useEffect, useMemo, useState } from 'react';

type VendorStoryCapability = {
  vendorId: string;
  vendorName: string;
  active: boolean;
  storiesEnabled: boolean;
  storyRolloutPercent: number;
  createdAt: string;
};

type VendorStoryAnalytics = {
  vendorId: string;
  vendorName: string;
  active: boolean;
  storiesEnabled: boolean;
  storyRolloutPercent: number;
  activeStories: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cvr: number;
  freshness: number;
  rankScore: number;
  windowDays: number;
};

type UiFunnelAnalytics = {
  surface: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cvr: number;
  uniqueSessions: number;
  windowDays: number;
};

type UiFunnelTrendPoint = {
  date: string;
  surface: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cvr: number;
};

const fallbackVendors: VendorStoryCapability[] = [
  {
    vendorId: 'vendor-techhub',
    vendorName: 'TechHub',
    active: true,
    storiesEnabled: true,
    storyRolloutPercent: 100,
    createdAt: new Date().toISOString(),
  },
  {
    vendorId: 'vendor-smarthomex',
    vendorName: 'SmartHomeX',
    active: true,
    storiesEnabled: false,
    storyRolloutPercent: 40,
    createdAt: new Date().toISOString(),
  },
  {
    vendorId: 'vendor-audiopro',
    vendorName: 'AudioPro',
    active: false,
    storiesEnabled: false,
    storyRolloutPercent: 0,
    createdAt: new Date().toISOString(),
  },
];

const fallbackAnalytics: VendorStoryAnalytics[] = [
  {
    vendorId: 'vendor-techhub',
    vendorName: 'TechHub',
    active: true,
    storiesEnabled: true,
    storyRolloutPercent: 100,
    activeStories: 4,
    impressions: 1260,
    clicks: 176,
    conversions: 38,
    ctr: 0.1397,
    cvr: 0.2159,
    freshness: 0.78,
    rankScore: 1.8181,
    windowDays: 14,
  },
  {
    vendorId: 'vendor-smarthomex',
    vendorName: 'SmartHomeX',
    active: true,
    storiesEnabled: false,
    storyRolloutPercent: 40,
    activeStories: 2,
    impressions: 540,
    clicks: 44,
    conversions: 7,
    ctr: 0.0815,
    cvr: 0.1591,
    freshness: 0.62,
    rankScore: 1.0438,
    windowDays: 14,
  },
  {
    vendorId: 'vendor-audiopro',
    vendorName: 'AudioPro',
    active: false,
    storiesEnabled: false,
    storyRolloutPercent: 0,
    activeStories: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    ctr: 0,
    cvr: 0,
    freshness: 0,
    rankScore: 0,
    windowDays: 14,
  },
];

const fallbackUiFunnel: UiFunnelAnalytics[] = [
  {
    surface: 'home_rail',
    impressions: 0,
    clicks: 0,
    conversions: 0,
    ctr: 0,
    cvr: 0,
    uniqueSessions: 0,
    windowDays: 14,
  },
  {
    surface: 'category_grid',
    impressions: 0,
    clicks: 0,
    conversions: 0,
    ctr: 0,
    cvr: 0,
    uniqueSessions: 0,
    windowDays: 14,
  },
  {
    surface: 'product_detail',
    impressions: 0,
    clicks: 0,
    conversions: 0,
    ctr: 0,
    cvr: 0,
    uniqueSessions: 0,
    windowDays: 14,
  },
  {
    surface: 'product_related',
    impressions: 0,
    clicks: 0,
    conversions: 0,
    ctr: 0,
    cvr: 0,
    uniqueSessions: 0,
    windowDays: 14,
  },
];

const fallbackUiFunnelTrend: UiFunnelTrendPoint[] = [];

function toAnalyticsMap(rows: VendorStoryAnalytics[]): Record<string, VendorStoryAnalytics> {
  return rows.reduce<Record<string, VendorStoryAnalytics>>((acc, row) => {
    acc[row.vendorId] = row;
    return acc;
  }, {});
}

function roundPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<VendorStoryCapability[]>([]);
  const [analyticsMap, setAnalyticsMap] = useState<Record<string, VendorStoryAnalytics>>({});
  const [uiFunnelRows, setUiFunnelRows] = useState<UiFunnelAnalytics[]>([]);
  const [uiFunnelTrendRows, setUiFunnelTrendRows] = useState<UiFunnelTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState(14);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [capabilityResult, analyticsResult, uiFunnelResult, uiTrendResult] =
          await Promise.allSettled([
          fetch(buildApiUrl('/admin/vendors/story-capabilities'), {
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            cache: 'no-store',
          }),
          fetch(buildApiUrl(`/admin/vendors/story-analytics?windowDays=${windowDays}`), {
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            cache: 'no-store',
          }),
          fetch(buildApiUrl(`/admin/ui-funnel-analytics?windowDays=${windowDays}`), {
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            cache: 'no-store',
          }),
          fetch(buildApiUrl(`/admin/ui-funnel-trend?windowDays=${Math.min(windowDays, 30)}`), {
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            cache: 'no-store',
          }),
        ]);

        let nextVendors = fallbackVendors;
        let nextAnalytics = fallbackAnalytics.map((item) => ({ ...item, windowDays }));
        let nextUiFunnel = fallbackUiFunnel.map((item) => ({ ...item, windowDays }));
        let nextUiTrend = fallbackUiFunnelTrend;
        let hasFallback = false;

        if (capabilityResult.status === 'fulfilled' && capabilityResult.value.ok) {
          const payload = (await capabilityResult.value.json()) as VendorStoryCapability[];
          if (Array.isArray(payload) && payload.length > 0) {
            nextVendors = payload;
          } else {
            hasFallback = true;
          }
        } else {
          hasFallback = true;
        }

        if (analyticsResult.status === 'fulfilled' && analyticsResult.value.ok) {
          const payload = (await analyticsResult.value.json()) as VendorStoryAnalytics[];
          if (Array.isArray(payload) && payload.length > 0) {
            nextAnalytics = payload;
          } else {
            hasFallback = true;
          }
        } else {
          hasFallback = true;
        }

        if (uiFunnelResult.status === 'fulfilled' && uiFunnelResult.value.ok) {
          const payload = (await uiFunnelResult.value.json()) as UiFunnelAnalytics[];
          if (Array.isArray(payload) && payload.length > 0) {
            nextUiFunnel = payload;
          } else {
            hasFallback = true;
          }
        } else {
          hasFallback = true;
        }

        if (uiTrendResult.status === 'fulfilled' && uiTrendResult.value.ok) {
          const payload = (await uiTrendResult.value.json()) as UiFunnelTrendPoint[];
          if (Array.isArray(payload)) {
            nextUiTrend = payload;
          } else {
            hasFallback = true;
          }
        } else {
          hasFallback = true;
        }

        if (!cancelled) {
          setVendors(nextVendors);
          setAnalyticsMap(toAnalyticsMap(nextAnalytics));
          setUiFunnelRows(nextUiFunnel);
          setUiFunnelTrendRows(nextUiTrend);
          if (hasFallback) {
            setError('بخشی از داده‌های analytics از fallback بارگذاری شد.');
          }
        }
      } catch {
        if (!cancelled) {
          setVendors(fallbackVendors);
          setAnalyticsMap(
            toAnalyticsMap(fallbackAnalytics.map((item) => ({ ...item, windowDays })))
          );
          setUiFunnelRows(fallbackUiFunnel.map((item) => ({ ...item, windowDays })));
          setUiFunnelTrendRows(fallbackUiFunnelTrend);
          setError('ارتباط با API برقرار نشد؛ داده نمونه نمایش داده می‌شود.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [windowDays]);

  const enabledCount = useMemo(
    () => vendors.filter((vendor) => vendor.storiesEnabled && vendor.active).length,
    [vendors]
  );

  const analyticsRows = useMemo(
    () =>
      vendors.map((vendor) => {
        const analytics = analyticsMap[vendor.vendorId];
        if (analytics) {
          return analytics;
        }
        return {
          vendorId: vendor.vendorId,
          vendorName: vendor.vendorName,
          active: vendor.active,
          storiesEnabled: vendor.storiesEnabled,
          storyRolloutPercent: vendor.storyRolloutPercent,
          activeStories: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          ctr: 0,
          cvr: 0,
          freshness: 0,
          rankScore: 0,
          windowDays,
        } satisfies VendorStoryAnalytics;
      }),
    [analyticsMap, vendors, windowDays]
  );

  const overview = useMemo(() => {
    if (analyticsRows.length === 0) {
      return {
        avgCtr: 0,
        avgCvr: 0,
        avgFreshness: 0,
        totalImpressions: 0,
        totalActiveStories: 0,
      };
    }
    const total = analyticsRows.reduce(
      (acc, row) => {
        acc.avgCtr += row.ctr;
        acc.avgCvr += row.cvr;
        acc.avgFreshness += row.freshness;
        acc.totalImpressions += row.impressions;
        acc.totalActiveStories += row.activeStories;
        return acc;
      },
      { avgCtr: 0, avgCvr: 0, avgFreshness: 0, totalImpressions: 0, totalActiveStories: 0 }
    );

    return {
      avgCtr: total.avgCtr / analyticsRows.length,
      avgCvr: total.avgCvr / analyticsRows.length,
      avgFreshness: total.avgFreshness / analyticsRows.length,
      totalImpressions: total.totalImpressions,
      totalActiveStories: total.totalActiveStories,
    };
  }, [analyticsRows]);

  const uiFunnelOverview = useMemo(() => {
    if (uiFunnelRows.length === 0) {
      return {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        ctr: 0,
        cvr: 0,
      };
    }

    const totals = uiFunnelRows.reduce(
      (acc, row) => {
        acc.impressions += row.impressions;
        acc.clicks += row.clicks;
        acc.conversions += row.conversions;
        return acc;
      },
      { impressions: 0, clicks: 0, conversions: 0 }
    );

    return {
      ...totals,
      ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
      cvr: totals.clicks > 0 ? totals.conversions / totals.clicks : 0,
    };
  }, [uiFunnelRows]);

  const uiTrendRowsSorted = useMemo(
    () =>
      uiFunnelTrendRows
        .slice()
        .sort((a, b) => {
          if (a.date === b.date) {
            return a.surface.localeCompare(b.surface);
          }
          return a.date < b.date ? 1 : -1;
        }),
    [uiFunnelTrendRows]
  );

  const uiTrendMaxConversions = useMemo(() => {
    if (uiFunnelTrendRows.length === 0) {
      return 1;
    }
    const max = uiFunnelTrendRows.reduce((acc, row) => Math.max(acc, row.conversions), 0);
    return Math.max(1, max);
  }, [uiFunnelTrendRows]);

  async function saveVendorCapability(
    vendorId: string,
    nextValue: boolean,
    rolloutPercent: number
  ) {
    const previousVendors = vendors;
    const previousAnalytics = analyticsMap;
    setSaving((prev) => ({ ...prev, [vendorId]: true }));
    setVendors((prev) =>
      prev.map((vendor) =>
        vendor.vendorId === vendorId
          ? { ...vendor, storiesEnabled: nextValue, storyRolloutPercent: rolloutPercent }
          : vendor
      )
    );
    setAnalyticsMap((prev) => {
      const current = prev[vendorId];
      if (!current) {
        return prev;
      }
      return {
        ...prev,
        [vendorId]: {
          ...current,
          storiesEnabled: nextValue,
          storyRolloutPercent: rolloutPercent,
        },
      };
    });

    try {
      const response = await fetch(buildApiUrl(`/admin/vendors/${vendorId}/story-capability`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: nextValue, rolloutPercent }),
      });

      if (!response.ok) {
        throw new Error(`http_${response.status}`);
      }
    } catch {
      setVendors(previousVendors);
      setAnalyticsMap(previousAnalytics);
      setError('ثبت تنظیمات انجام نشد. لطفا دوباره تلاش کنید.');
    } finally {
      setSaving((prev) => ({ ...prev, [vendorId]: false }));
    }
  }

  async function toggleVendor(vendorId: string, nextValue: boolean) {
    const current = vendors.find((item) => item.vendorId === vendorId);
    await saveVendorCapability(vendorId, nextValue, current?.storyRolloutPercent ?? 100);
  }

  return (
    <AdminPanelShell
      title="مدیریت Stories فروشندگان"
      subtitle="کنترل قابلیت Story و مشاهده analytics واقعی CTR/CVR/Freshness برای هر فروشنده."
    >
      <section className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <article className="admin-card rounded-2xl p-4">
          <p className="text-xs text-slate-400">کل فروشندگان</p>
          <p className="mt-2 text-2xl font-semibold text-white">{vendors.length}</p>
        </article>
        <article className="admin-card rounded-2xl p-4">
          <p className="text-xs text-slate-400">Story فعال</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">{enabledCount}</p>
        </article>
        <article className="admin-card rounded-2xl p-4">
          <p className="text-xs text-slate-400">Impressions</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-200">
            {overview.totalImpressions.toLocaleString('en-US')}
          </p>
        </article>
        <article className="admin-card rounded-2xl p-4">
          <p className="text-xs text-slate-400">Avg CTR</p>
          <p className="mt-2 text-2xl font-semibold text-amber-200">
            {roundPercent(overview.avgCtr)}
          </p>
        </article>
        <article className="admin-card rounded-2xl p-4">
          <p className="text-xs text-slate-400">Avg CVR</p>
          <p className="mt-2 text-2xl font-semibold text-violet-200">
            {roundPercent(overview.avgCvr)}
          </p>
        </article>
        <article className="admin-card rounded-2xl p-4">
          <p className="text-xs text-slate-400">Avg Freshness</p>
          <p className="mt-2 text-2xl font-semibold text-orange-200">
            {roundPercent(overview.avgFreshness)}
          </p>
        </article>
      </section>

      <section className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
        <p className="text-xs text-slate-300">
          پنجره تحلیل: {windowDays} روز اخیر • Active Stories: {overview.totalActiveStories}
        </p>
        <select
          value={windowDays}
          className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-200"
          onChange={(event) => setWindowDays(Number(event.target.value))}
        >
          <option value={7}>7 روز</option>
          <option value={14}>14 روز</option>
          <option value={30}>30 روز</option>
        </select>
      </section>

      {error ? (
        <div className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-200/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {vendors.map((vendor) => {
          const isSaving = Boolean(saving[vendor.vendorId]);
          const metrics = analyticsMap[vendor.vendorId] || {
            vendorId: vendor.vendorId,
            vendorName: vendor.vendorName,
            active: vendor.active,
            storiesEnabled: vendor.storiesEnabled,
            storyRolloutPercent: vendor.storyRolloutPercent,
            activeStories: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            ctr: 0,
            cvr: 0,
            freshness: 0,
            rankScore: 0,
            windowDays,
          };

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
              <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                  <span>Rollout درصدی Story</span>
                  <span>{vendor.storyRolloutPercent}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={vendor.storyRolloutPercent}
                  disabled={isSaving}
                  onChange={(event) => {
                    const nextPercent = Number(event.target.value);
                    setVendors((prev) =>
                      prev.map((item) =>
                        item.vendorId === vendor.vendorId
                          ? { ...item, storyRolloutPercent: nextPercent }
                          : item
                      )
                    );
                  }}
                  onMouseUp={(event) => {
                    const nextPercent = Number((event.target as HTMLInputElement).value);
                    void saveVendorCapability(vendor.vendorId, vendor.storiesEnabled, nextPercent);
                  }}
                  onTouchEnd={(event) => {
                    const nextPercent = Number((event.target as HTMLInputElement).value);
                    void saveVendorCapability(vendor.vendorId, vendor.storiesEnabled, nextPercent);
                  }}
                  className="w-full"
                />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-200">
                  <p className="text-[10px] text-cyan-100/70">CTR</p>
                  <p className="mt-1 font-semibold">{roundPercent(metrics.ctr)}</p>
                </div>
                <div className="rounded-lg border border-violet-400/20 bg-violet-400/10 p-2 text-violet-200">
                  <p className="text-[10px] text-violet-100/70">CVR</p>
                  <p className="mt-1 font-semibold">{roundPercent(metrics.cvr)}</p>
                </div>
                <div className="rounded-lg border border-orange-400/20 bg-orange-400/10 p-2 text-orange-200">
                  <p className="text-[10px] text-orange-100/70">Fresh</p>
                  <p className="mt-1 font-semibold">{roundPercent(metrics.freshness)}</p>
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    Impressions: {metrics.impressions.toLocaleString('en-US')} • Active Stories:{' '}
                    {metrics.activeStories}
                  </span>
                  <span>Score: {metrics.rankScore.toFixed(2)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-400 via-cyan-400 to-emerald-400"
                    style={{
                      width: `${Math.max(4, Math.min(100, Math.round(metrics.freshness * 100)))}%`,
                    }}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/10">
        <div className="border-b border-white/10 px-4 py-3 text-sm text-slate-200">
          Story Analytics Leaderboard
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/70 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">Vendor</th>
                <th className="px-4 py-2">Impressions</th>
                <th className="px-4 py-2">Clicks</th>
                <th className="px-4 py-2">Conversions</th>
                <th className="px-4 py-2">CTR</th>
                <th className="px-4 py-2">CVR</th>
                <th className="px-4 py-2">Freshness</th>
                <th className="px-4 py-2">Rank</th>
              </tr>
            </thead>
            <tbody>
              {analyticsRows
                .slice()
                .sort((a, b) => b.rankScore - a.rankScore)
                .map((row) => (
                  <tr key={row.vendorId} className="border-t border-white/5">
                    <td className="px-4 py-2 text-slate-200">{row.vendorName}</td>
                    <td className="px-4 py-2">{row.impressions.toLocaleString('en-US')}</td>
                    <td className="px-4 py-2">{row.clicks.toLocaleString('en-US')}</td>
                    <td className="px-4 py-2">{row.conversions.toLocaleString('en-US')}</td>
                    <td className="px-4 py-2">{roundPercent(row.ctr)}</td>
                    <td className="px-4 py-2">{roundPercent(row.cvr)}</td>
                    <td className="px-4 py-2">{roundPercent(row.freshness)}</td>
                    <td className="px-4 py-2 font-mono text-emerald-200">
                      {row.rankScore.toFixed(2)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/10">
        <div className="border-b border-white/10 px-4 py-3 text-sm text-slate-200">
          Storefront Funnel Analytics (Rail / Category / Product)
        </div>

        <div className="grid gap-3 border-b border-white/10 px-4 py-4 md:grid-cols-5">
          <article className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-cyan-200">
            <p className="text-[10px] text-cyan-100/70">Impressions</p>
            <p className="mt-1 text-lg font-semibold">
              {uiFunnelOverview.impressions.toLocaleString('en-US')}
            </p>
          </article>
          <article className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-amber-200">
            <p className="text-[10px] text-amber-100/70">Clicks</p>
            <p className="mt-1 text-lg font-semibold">
              {uiFunnelOverview.clicks.toLocaleString('en-US')}
            </p>
          </article>
          <article className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-emerald-200">
            <p className="text-[10px] text-emerald-100/70">Conversions</p>
            <p className="mt-1 text-lg font-semibold">
              {uiFunnelOverview.conversions.toLocaleString('en-US')}
            </p>
          </article>
          <article className="rounded-xl border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-violet-200">
            <p className="text-[10px] text-violet-100/70">CTR</p>
            <p className="mt-1 text-lg font-semibold">{roundPercent(uiFunnelOverview.ctr)}</p>
          </article>
          <article className="rounded-xl border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-orange-200">
            <p className="text-[10px] text-orange-100/70">CVR</p>
            <p className="mt-1 text-lg font-semibold">{roundPercent(uiFunnelOverview.cvr)}</p>
          </article>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/70 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">Surface</th>
                <th className="px-4 py-2">Impressions</th>
                <th className="px-4 py-2">Clicks</th>
                <th className="px-4 py-2">Conversions</th>
                <th className="px-4 py-2">CTR</th>
                <th className="px-4 py-2">CVR</th>
                <th className="px-4 py-2">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {uiFunnelRows
                .slice()
                .sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks)
                .map((row) => (
                  <tr key={row.surface} className="border-t border-white/5">
                    <td className="px-4 py-2 text-slate-200">{row.surface}</td>
                    <td className="px-4 py-2">{row.impressions.toLocaleString('en-US')}</td>
                    <td className="px-4 py-2">{row.clicks.toLocaleString('en-US')}</td>
                    <td className="px-4 py-2">{row.conversions.toLocaleString('en-US')}</td>
                    <td className="px-4 py-2">{roundPercent(row.ctr)}</td>
                    <td className="px-4 py-2">{roundPercent(row.cvr)}</td>
                    <td className="px-4 py-2">{row.uniqueSessions.toLocaleString('en-US')}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/10">
        <div className="border-b border-white/10 px-4 py-3 text-sm text-slate-200">
          Rolling Trend (Daily CTR/CVR)
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/70 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Surface</th>
                <th className="px-4 py-2">Impressions</th>
                <th className="px-4 py-2">Clicks</th>
                <th className="px-4 py-2">Conversions</th>
                <th className="px-4 py-2">CTR</th>
                <th className="px-4 py-2">CVR</th>
                <th className="px-4 py-2">Conv Trend</th>
              </tr>
            </thead>
            <tbody>
              {uiTrendRowsSorted.length === 0 ? (
                <tr className="border-t border-white/5">
                  <td className="px-4 py-3 text-slate-400" colSpan={8}>
                    داده trend هنوز ثبت نشده است.
                  </td>
                </tr>
              ) : (
                uiTrendRowsSorted.slice(0, 70).map((row) => (
                  <tr key={`${row.date}:${row.surface}`} className="border-t border-white/5">
                    <td className="px-4 py-2 font-mono text-slate-200">{row.date}</td>
                    <td className="px-4 py-2 text-slate-200">{row.surface}</td>
                    <td className="px-4 py-2">{row.impressions.toLocaleString('en-US')}</td>
                    <td className="px-4 py-2">{row.clicks.toLocaleString('en-US')}</td>
                    <td className="px-4 py-2">{row.conversions.toLocaleString('en-US')}</td>
                    <td className="px-4 py-2">{roundPercent(row.ctr)}</td>
                    <td className="px-4 py-2">{roundPercent(row.cvr)}</td>
                    <td className="px-4 py-2">
                      <div className="h-2 w-28 rounded-full bg-slate-700/40">
                        <div
                          className="h-2 rounded-full bg-emerald-400"
                          style={{
                            width: `${Math.max(
                              4,
                              Math.round((row.conversions / uiTrendMaxConversions) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-4 text-xs text-slate-400">
        {loading
          ? 'در حال همگام سازی داده‌ها...'
          : 'Analytics آماده است و به‌صورت دوره‌ای با پنجره زمانی انتخاب‌شده محاسبه می‌شود.'}
      </p>
    </AdminPanelShell>
  );
}
