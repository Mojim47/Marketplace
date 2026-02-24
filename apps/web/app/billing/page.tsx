import { Container, GlassCard, PageHeader } from '@/components/ui';

export default function BillingPage() {
  return (
    <Container className="py-12">
      <PageHeader eyebrow="Billing" title="مالی و پرداخت" subtitle="مدیریت فاکتورها، پرداخت‌ها و تاریخچه تسویه." />
      <GlassCard className="mt-8 rounded-3xl p-6 text-sm text-slate-700">
        صورتحساب‌ها و وضعیت پرداخت سفارش‌ها در این بخش ارائه می‌شود.
      </GlassCard>
    </Container>
  );
}
