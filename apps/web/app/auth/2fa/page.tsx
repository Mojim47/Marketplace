import { Container, GlassCard, PageHeader } from '@/components/ui';

export default function TwoFactorPage() {
  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Security"
        title="تایید دومرحله‌ای (2FA)"
        subtitle="کد یک‌بارمصرف را وارد کنید تا نشست امن شما تکمیل شود."
      />
      <GlassCard className="mt-8 rounded-3xl p-6 text-sm text-slate-700">
        این صفحه برای سخت‌سازی نشست و کاهش ریسک تصاحب حساب فعال است.
      </GlassCard>
    </Container>
  );
}
