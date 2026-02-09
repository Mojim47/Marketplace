"use client";

import { useState } from "react";
import { Button, Container, GlassCard, Pill, SectionTitle } from "@/components/ui";

export default function AIDemandPage() {
  const [history, setHistory] = useState("1200000,1500000,1800000,2100000");
  const [importIndex, setImportIndex] = useState("0.9,0.92,0.95,0.97");
  const [inflation, setInflation] = useState("0.45");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function runPrediction() {
    setError("");
    setOutput("");
    setLoading(true);

    const sales = history
      .split(",")
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n));
    const imports = importIndex
      .split(",")
      .map((s) => Number.parseFloat(s.trim()))
      .filter((n) => Number.isFinite(n));
    const inflationRate = Number.parseFloat(inflation);

    if (sales.length === 0) {
      setError("حداقل یک مقدار فروش معتبر وارد کنید.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/ai/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesHistoryIrr: sales,
          importIndex: imports,
          inflationRate: Number.isFinite(inflationRate) ? inflationRate : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "خطای ناشناخته");
      }
      setOutput(data.localizedText || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای ناشناخته");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container className="space-y-10 py-12">
      <GlassCard className="rounded-3xl p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-300">AI Demand Studio</p>
            <SectionTitle className="text-3xl text-white">پیش‌بینی تقاضا با مدل ترکیبی</SectionTitle>
          </div>
          <Pill>AI Verified</Pill>
        </div>
        <p className="mt-4 text-sm text-slate-300">
          این محاسبه با پردازش امن و کنترل‌شده انجام می‌شود و خروجی قابل اتکا برای تصمیم‌گیری فروشنده ارائه می‌دهد.
        </p>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <GlassCard className="rounded-3xl p-6 space-y-5">
          <label className="block text-sm text-slate-200">
            تاریخچه فروش (ریال، جداشده با کاما)
            <input
              className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900/60 p-3 text-sm text-white"
              value={history}
              onChange={(e) => setHistory(e.target.value)}
            />
          </label>

          <label className="block text-sm text-slate-200">
            شاخص واردات (اختیاری)
            <input
              className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900/60 p-3 text-sm text-white"
              value={importIndex}
              onChange={(e) => setImportIndex(e.target.value)}
            />
          </label>

          <label className="block text-sm text-slate-200">
            نرخ تورم (مثلاً 0.45)
            <input
              className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900/60 p-3 text-sm text-white"
              value={inflation}
              onChange={(e) => setInflation(e.target.value)}
            />
          </label>

          <Button loading={loading} onClick={runPrediction}>محاسبه هوشمند</Button>

          {error ? <div className="text-sm text-red-300">{error}</div> : null}
        </GlassCard>

        <GlassCard className="rounded-3xl p-6">
          <SectionTitle className="text-xl text-white">خروجی مدل</SectionTitle>
          <p className="mt-2 text-xs text-slate-400">تحلیل لحظه‌ای با فیلترهای اقتصادی</p>
          <div className="mt-4 rounded-2xl bg-slate-900/60 p-4 text-sm text-slate-100">
            {output ? <pre className="whitespace-pre-wrap">{output}</pre> : "برای مشاهده نتایج، داده‌ها را وارد کنید."}
          </div>
        </GlassCard>
      </div>
    </Container>
  );
}
