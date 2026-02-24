import Link from 'next/link';
import { AuthExperiencePanel } from '@/components/AuthExperiencePanel';
import { Container, GlassCard, PageHeader, SectionTitle } from '@/components/ui';

export default function AuthHubPage() {
  return (
    <Container className="py-12">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow="Identity Gateway"
          title="مرکز احراز هویت"
          subtitle="ورود، ثبت‌نام و بازیابی رمز در یک مسیر یکپارچه و امن."
          chips={['Session-safe', 'Recovery-ready', 'Checkout-integrated']}
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <GlassCard className="rounded-3xl p-8 text-center">
            <SectionTitle className="text-3xl text-slate-900">مسیر مورد نظر را انتخاب کنید</SectionTitle>
            <p className="mt-4 text-sm text-slate-600">برای ادامه خرید یا مدیریت حساب، یکی از گزینه‌های زیر را انتخاب کنید.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/auth/login" className="btn btn-3d">ورود</Link>
              <Link href="/auth/register" className="btn btn-outline">ثبت‌نام</Link>
              <Link href="/auth/forgot-password" className="btn btn-ghost">بازیابی رمز عبور</Link>
            </div>
          </GlassCard>
          <div>
            <AuthExperiencePanel heading="Identity Gateway با ظاهر کمپینی" />
          </div>
        </div>
      </div>
    </Container>
  );
}
