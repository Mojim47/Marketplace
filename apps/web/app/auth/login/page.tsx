'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Button, Container, GlassCard, PageHeader, SectionTitle } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { login, isAuthenticated } = useAuth();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = search.get('next') || '/cart';

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isAuthenticated) {
      router.push(next);
      router.refresh();
      return;
    }
    setSubmitting(true);
    setError(null);

    const result = await login({ mobile, password });
    setSubmitting(false);

    if (!result.ok) {
      if (result.code === 'network_timeout' && isAuthenticated) {
        router.push(next);
        router.refresh();
        return;
      }
      setError(result.error || 'ورود ناموفق بود');
      return;
    }

    router.push(next);
    router.refresh();
  };

  return (
    <Container className="py-12">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow="Authentication"
          title="ورود به حساب کاربری"
          subtitle="نشست کاربر با کوکی امن ایجاد می‌شود و مسیر خرید بدون وقفه ادامه پیدا می‌کند."
          chips={['Secure Cookie Session', 'Token Refresh', 'Trace-enabled']}
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <GlassCard className="rounded-3xl p-8">
            <SectionTitle className="text-2xl text-slate-900">فرم ورود</SectionTitle>

            <form
              className="mt-6 space-y-4"
              onSubmit={onSubmit}
              data-error-state={error ? 'true' : 'false'}
              data-empty-state={!mobile || !password ? 'true' : 'false'}
            >
              <div>
                <label htmlFor="login-identifier" className="text-xs text-slate-600">شماره موبایل</label>
                <input
                  id="login-identifier"
                  type="tel"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900"
                  placeholder="09123456789"
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  pattern="09[0-9]{9}"
                  required
                />
              </div>

              <div>
                <label htmlFor="login-password" className="text-xs text-slate-600">رمز عبور</label>
                <input
                  id="login-password"
                  type="password"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900"
                  placeholder="********"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              {error ? (
                <p className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</p>
              ) : null}

              <Button loading={submitting} loadingText="در حال ورود..." type="submit">
                ورود
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
              <Link href="/auth/forgot-password" className="text-slate-600 transition hover:text-orange-700">
                فراموشی رمز عبور
              </Link>
              <Link href="/auth/register" className="text-slate-600 transition hover:text-orange-700">
                حساب ندارید؟ ثبت‌نام
              </Link>
            </div>
          </GlassCard>

          <GlassCard className="rounded-3xl p-8">
            <SectionTitle className="text-2xl text-slate-900">چرا ورود امن مهم است؟</SectionTitle>
            <ul className="mt-5 space-y-3 text-sm text-slate-600">
              <li className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">حفظ سبد خرید و تاریخچه سفارش بین نشست‌ها</li>
              <li className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">تشخیص 401 و ریکاوری خودکار نشست</li>
              <li className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">اتصال مستقیم به checkout و مسیر پرداخت</li>
            </ul>
          </GlassCard>
        </div>
      </div>
    </Container>
  );
}
