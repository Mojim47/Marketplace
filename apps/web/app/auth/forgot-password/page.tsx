'use client';

import { AuthExperiencePanel } from '@/components/AuthExperiencePanel';
import { Button, Container, GlassCard, PageHeader, SectionTitle } from '@/components/ui';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function ForgotPasswordPage() {
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const response = await fetch('/api/backend/auth/sms/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mobile }),
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    setLoading(false);

    if (!response.ok) {
      setError(String(data.message ?? data.error ?? 'ارسال کد ناموفق بود'));
      return;
    }

    setMessage(String(data.message ?? 'کد بازیابی ارسال شد'));
  };

  return (
    <Container className="py-12">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          eyebrow="Recovery"
          title="بازیابی رمز عبور"
          subtitle="شماره موبایل را وارد کنید تا کد تایید بازیابی از طریق سرویس پیامکی کاوه‌نگار ارسال شود."
          chips={['SMS Verification', 'Secure Recovery', 'Rate-limited']}
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <GlassCard className="rounded-3xl p-8">
            <SectionTitle className="text-2xl text-slate-900">ارسال کد بازیابی</SectionTitle>

            <form
              className="mt-6 space-y-4"
              onSubmit={onSubmit}
              data-error-state={error ? 'true' : 'false'}
              data-empty-state={!mobile ? 'true' : 'false'}
            >
              <div>
                <label htmlFor="forgot-mobile" className="text-xs text-slate-600">
                  شماره موبایل
                </label>
                <input
                  id="forgot-mobile"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900"
                  placeholder="09123456789"
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  required
                />
              </div>

              {error ? (
                <p className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                  {error}
                </p>
              ) : null}
              {message ? (
                <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                  {message}
                </p>
              ) : null}

              <Button
                loading={loading}
                loadingText="در حال ارسال..."
                type="submit"
                className="btn-3d"
              >
                ارسال کد
              </Button>
            </form>

            <div className="mt-6 text-sm">
              <Link href="/auth/login" className="text-slate-600 transition hover:text-orange-700">
                بازگشت به ورود
              </Link>
            </div>
          </GlassCard>

          <div>
            <AuthExperiencePanel heading="بازیابی حساب با تجربه ساده و سریع" />
          </div>
        </div>
      </div>
    </Container>
  );
}
