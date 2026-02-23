'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Button, Container, GlassCard, PageHeader, SectionTitle } from '@/components/ui';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await register({
      password,
      mobile,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.error || 'ثبت‌نام ناموفق بود');
      return;
    }

    router.push('/cart');
    router.refresh();
  };

  return (
    <Container className="py-12">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow="Onboarding"
          title="ایجاد حساب جدید"
          subtitle="ثبت‌نام سریع، نشست امن و ورود مستقیم به جریان خرید."
          chips={['Fast Onboarding', 'Validated Identity', 'Checkout-ready']}
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <GlassCard className="rounded-3xl p-8">
            <SectionTitle className="text-2xl text-white">فرم ثبت‌نام</SectionTitle>

            <form
              className="mt-6 grid gap-4"
              onSubmit={onSubmit}
              data-error-state={error ? 'true' : 'false'}
              data-empty-state={!mobile || !password ? 'true' : 'false'}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="register-first-name" className="text-xs text-slate-300">نام</label>
                  <input
                    id="register-first-name"
                    className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white"
                    placeholder="نام"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="register-last-name" className="text-xs text-slate-300">نام خانوادگی</label>
                  <input
                    id="register-last-name"
                    className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white"
                    placeholder="نام خانوادگی"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="register-mobile" className="text-xs text-slate-300">شماره موبایل</label>
                <input
                  id="register-mobile"
                  type="tel"
                  className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white"
                  placeholder="09123456789"
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  pattern="09[0-9]{9}"
                  required
                />
              </div>

              <div>
                <label htmlFor="register-password" className="text-xs text-slate-300">رمز عبور</label>
                <input
                  id="register-password"
                  type="password"
                  className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white"
                  placeholder="حداقل 8 کاراکتر"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                />
              </div>

              {error ? (
                <p className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</p>
              ) : null}

              <Button loading={loading} loadingText="در حال ثبت‌نام..." type="submit">
                ایجاد حساب
              </Button>
            </form>

            <div className="mt-6 text-sm">
              <Link href="/auth/login" className="text-slate-300 transition hover:text-white">
                حساب دارید؟ ورود
              </Link>
            </div>
          </GlassCard>

          <GlassCard className="rounded-3xl p-8">
            <SectionTitle className="text-2xl text-white">مزایای حساب کاربری</SectionTitle>
            <ul className="mt-5 space-y-3 text-sm text-slate-300">
              <li className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">ردیابی سفارش و اعلان لحظه‌ای وضعیت</li>
              <li className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">تسویه سریع با اطلاعات ذخیره‌شده</li>
              <li className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">پیشنهادهای شخصی‌سازی‌شده مبتنی بر رفتار خرید</li>
            </ul>
          </GlassCard>
        </div>
      </div>
    </Container>
  );
}
