import Link from 'next/link';
import { AuthExperiencePanel } from '@/components/AuthExperiencePanel';
import { Container, GlassCard, PageHeader } from '@/components/ui';

export default function VerifyEmailPage() {
  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Identity"
        title="تایید ایمیل"
        subtitle="برای فعال‌سازی کامل حساب، لینک تایید ارسال‌شده به ایمیل را بررسی کنید."
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <GlassCard className="rounded-3xl p-6 text-sm text-slate-700">
          پس از تایید ایمیل، دسترسی به مسیرهای حساس حساب فعال می‌شود.
          <div className="mt-5 flex gap-2">
            <button type="button" className="btn btn-3d">ارسال مجدد لینک</button>
            <Link href="/auth/login" className="btn btn-outline">رفتن به ورود</Link>
          </div>
        </GlassCard>
        <AuthExperiencePanel heading="تکمیل هویت برای فعال‌سازی کامل" />
      </div>
    </Container>
  );
}
