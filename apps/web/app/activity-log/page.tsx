import { Container, GlassCard, PageHeader } from '@/components/ui';

export default function ActivityLogPage() {
  return (
    <Container className="py-12">
      <PageHeader eyebrow="Audit" title="لاگ فعالیت" subtitle="تغییرات کلیدی پروفایل، نشست و عملیات سفارش با trace ثبت می‌شود." />
      <GlassCard className="mt-8 rounded-3xl p-6 text-sm text-slate-700">
        این صفحه نمای خلاصه‌ای از رخدادهای مهم کاربر را نمایش می‌دهد.
      </GlassCard>
    </Container>
  );
}
