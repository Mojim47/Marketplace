import { Container, GlassCard, PageHeader } from '@/components/ui';

export default function MaintenancePage() {
  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="System"
        title="در حال نگهداری"
        subtitle="سرویس موقتاً برای به‌روزرسانی زیرساخت متوقف است."
      />
      <GlassCard className="mt-8 rounded-3xl p-6 text-sm text-slate-200">
        لطفاً چند دقیقه دیگر مجدداً تلاش کنید.
      </GlassCard>
    </Container>
  );
}
