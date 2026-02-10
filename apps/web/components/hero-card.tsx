 "use client";

import { useMemo } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { HeroAssetSchema, type HeroAsset } from "../../../libs/common/src/contracts/hero.contract";
import clsx from "clsx";

const fetcher = async (url: string): Promise<HeroAsset> => {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error("Failed to load hero asset");
  const data = await res.json();
  return HeroAssetSchema.parse({
    id: data.id,
    name: data.name ?? data.title ?? "Untitled Asset",
    version: data.version ?? data.metadata?.version ?? "1.0.0",
    spatialData: data.spatialData ?? data.metadata ?? {},
  });
};

const useHeroAsset = () =>
  useSWR<HeroAsset>("/v1/marketplace/hero", fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: true,
  });

const glass =
  "relative overflow-hidden rounded-3xl border border-glassBorder/80 bg-glass/40 backdrop-blur-glass shadow-glow";

export function HeroCard() {
  const { data, isLoading, error } = useHeroAsset();

  const asset = useMemo<HeroAsset>(
    () =>
      data ?? {
        id: "stub-hero",
        name: "Lazarus Stub Asset",
        version: "1.0.0",
        spatialData: { status: "stub" },
      },
    [data],
  );

  if (isLoading) {
    return (
      <div className="relative isolate grid gap-6 lg:grid-cols-5">
        <div
          className={clsx(
            glass,
            "lg:col-span-3 p-8 animate-pulse bg-white/5 text-transparent"
          )}
        >
          <div className="h-6 w-32 rounded-full bg-white/10 mb-4" />
          <div className="h-12 w-3/4 rounded-full bg-white/10 mb-6" />
          <div className="h-4 w-full rounded-full bg-white/10 mb-2" />
          <div className="h-4 w-5/6 rounded-full bg-white/10 mb-2" />
          <div className="h-12 w-40 mt-8 rounded-full bg-white/10" />
        </div>
        <div className={clsx(glass, "lg:col-span-2 h-full min-h-[260px] animate-pulse bg-white/5")} />
      </div>
    );
  }

  return (
    <section className="relative isolate">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-neon-radial blur-3xl opacity-80 animate-orb" />
      <div className="absolute inset-0 -z-10 bg-noise mix-blend-soft-light opacity-30" />

      <div className="relative grid gap-6 lg:grid-cols-5">
        <div className={clsx(glass, "lg:col-span-3 p-8 bg-obsidian/60")}>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80">
            <Sparkles size={16} className="text-neon-fuchsia" />
            <span>Version {asset.version}</span>
          </div>

          <h1 className="section-title text-4xl font-semibold text-white mb-4">
            {asset.name}
          </h1>

          <p className="text-white/80 leading-relaxed max-w-2xl">
            Immersive spatial assets, precision-priced and verified on-chain.
            Experience hyper-luxury commerce with realtime AR previews and atomic settlement.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              className="relative overflow-hidden rounded-full border border-white/15 bg-neon-gradient px-6 py-3 text-sm font-semibold text-white shadow-glow"
            >
              <span className="relative z-10 flex items-center gap-2">
                Explore Asset
                <ArrowRight size={18} />
              </span>
              <motion.span
                aria-hidden
                className="absolute inset-0 bg-white/30"
                initial={{ x: "-120%" }}
                animate={{ x: "120%" }}
                transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
              />
            </motion.button>

            {error && (
              <div className="flex items-center gap-2 text-sm text-amber-200/90">
                <Loader2 size={16} className="animate-spin" />
                Fallback data active
              </div>
            )}
          </div>
        </div>

        <div className={clsx(glass, "lg:col-span-2 bg-obsidian/60")}>
          <div className="relative h-full min-h-[260px] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-white/10">
            <div className="absolute inset-0 bg-noise opacity-40 mix-blend-soft-light" />
            <div className="absolute inset-0 animate-orb bg-neon-radial blur-3xl opacity-70" />
            <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4 text-white/80">
              <div className="flex items-center gap-3 text-sm uppercase tracking-[0.2em]">
                <Loader2 size={18} className="animate-spin" />
                Spatial Preview
              </div>
              <p className="text-center text-lg font-medium">
                Real-time AR viewer placeholder
              </p>
              <p className="text-xs text-white/60 max-w-sm text-center">
                Optimized for neon-lit showrooms, tuned with spring physics for fluid interaction.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroCard;
