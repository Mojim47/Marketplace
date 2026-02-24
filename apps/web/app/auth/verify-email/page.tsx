import { Container, GlassCard, PageHeader } from '@/components/ui';

export default function VerifyEmailPage() {
  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Identity"
        title="تایید ایمیل"
        subtitle="برای فعال‌سازی کامل حساب، لینک تایید ارسال‌شده به ایمیل را بررسی کنید."
      />
      <GlassCard className="mt-8 rounded-3xl p-6 text-sm text-slate-700">
        پس از تایید ایمیل، دسترسی به مسیرهای حساس حساب فعال می‌شود.
      </GlassCard>
    </Container>
  );
}
