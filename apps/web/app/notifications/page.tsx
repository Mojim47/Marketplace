import { Container, GlassCard, PageHeader } from '@/components/ui';

export default function NotificationsPage() {
  return (
    <Container className="py-12">
      <PageHeader eyebrow="Notifications" title="اعلان‌ها" subtitle="رویدادهای کلیدی سفارش، پرداخت و امنیت حساب را دنبال کنید." />
      <GlassCard className="mt-8 rounded-3xl p-6 text-sm text-slate-200">
        اعلان‌های بلادرنگ برای تغییرات وضعیت سفارش و نشست‌های مشکوک.
      </GlassCard>
    </Container>
  );
}
