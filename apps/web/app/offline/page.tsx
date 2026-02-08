"use client";

import { Button, Container, GlassCard, SectionTitle } from "@/components/ui";

export default function OfflinePage() {
  return (
    <div className="min-h-screen">
      <Container className="py-16">
        <GlassCard className="rounded-3xl p-10 text-center">
          <div className="mx-auto mb-6 h-20 w-20 rounded-full border border-white/20 bg-white/5" />
          <SectionTitle className="text-3xl text-white">اتصال اینترنت قطع شده است</SectionTitle>
          <p className="mt-3 text-sm text-slate-300">
            اتصال خود را بررسی کنید. اطلاعات مهم شما محفوظ است و پس از اتصال دوباره همگام‌سازی می‌شود.
          </p>
          <Button onClick={() => window.location.reload()} className="mt-6">
            تلاش مجدد
          </Button>
        </GlassCard>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {[
            "برخی صفحات ذخیره شده و قابل مشاهده‌اند.",
            "سبد خرید و علاقه‌مندی‌ها حفظ می‌شوند.",
            "پس از اتصال، داده‌ها به‌روزرسانی می‌شوند.",
          ].map((item) => (
            <GlassCard key={item} className="rounded-2xl p-4 text-sm text-slate-300">
              {item}
            </GlassCard>
          ))}
        </div>
      </Container>
    </div>
  );
}
