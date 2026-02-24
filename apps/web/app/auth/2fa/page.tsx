import { AuthExperiencePanel } from '@/components/AuthExperiencePanel';
import { Container, GlassCard, PageHeader } from '@/components/ui';
import Link from 'next/link';

export default function TwoFactorPage() {
  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Security"
        title="تایید دومرحله‌ای (2FA)"
        subtitle="کد یک‌بارمصرف را وارد کنید تا نشست امن شما تکمیل شود."
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <GlassCard className="rounded-3xl p-6 text-sm text-slate-700">
          این صفحه برای سخت‌سازی نشست و کاهش ریسک تصاحب حساب فعال است.
          <div className="mt-5 flex gap-2">
            <button type="button" className="btn btn-3d" aria-busy="false">
              ارسال مجدد کد
            </button>
            <Link href="/auth/login" className="btn btn-outline">
              بازگشت به ورود
            </Link>
          </div>
        </GlassCard>
        <AuthExperiencePanel heading="امنیت چندمرحله‌ای با UX روان" />
      </div>
    </Container>
  );
}
