import { Container, GlassCard, PageHeader } from '@/components/ui';

export default function BlogPage() {
  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Blog"
        title="بلاگ محصول"
        subtitle="انتشار آپدیت‌های نسخه، الگوهای UX و گزارش بهبود عملکرد."
      />
      <div className="mt-8 grid gap-4">
        <GlassCard className="rounded-3xl p-6 text-sm text-slate-200">
          یادداشت انتشار 2026-Q1
        </GlassCard>
        <GlassCard className="rounded-3xl p-6 text-sm text-slate-200">
          بهبود جریان Checkout
        </GlassCard>
      </div>
    </Container>
  );
}
