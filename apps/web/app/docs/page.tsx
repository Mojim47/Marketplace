import { Container, GlassCard, PageHeader } from '@/components/ui';

export default function DocsPage() {
  return (
    <Container className="py-12">
      <PageHeader eyebrow="Docs" title="مستندات محصول" subtitle="راهنمای عملیاتی برای تیم فنی، فروشنده و اپراتور." />
      <GlassCard className="mt-8 rounded-3xl p-6 text-sm text-slate-700">
        ساختار مستندات شامل API، جریان سفارش، امنیت نشست و اجرای پروداکشن.
      </GlassCard>
    </Container>
  );
}
