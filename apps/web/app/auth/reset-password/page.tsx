'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { AuthExperiencePanel } from '@/components/AuthExperiencePanel';
import { Button, Container, GlassCard, PageHeader, SectionTitle } from '@/components/ui';

export default function ResetPasswordPage() {
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const response = await fetch('/api/backend/auth/sms/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mobile, code, newPassword }),
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    setLoading(false);

    if (!response.ok) {
      setError(String(data.message ?? data.error ?? 'بازنشانی ناموفق بود'));
      return;
    }

    setMessage(String(data.message ?? 'رمز عبور با موفقیت تغییر کرد'));
  };

  return (
    <Container className="py-12">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          eyebrow="Credential Recovery"
          title="ثبت رمز جدید"
          subtitle="پس از دریافت کد پیامکی کاوه‌نگار، رمز جدید را امن ثبت کنید."
          chips={['Code Verification', 'Password Policy', 'Account Recovery']}
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <GlassCard className="rounded-3xl p-8">
            <SectionTitle className="text-2xl text-slate-900">بازنشانی رمز عبور</SectionTitle>

            <form
              className="mt-6 space-y-4"
              onSubmit={onSubmit}
              data-error-state={error ? 'true' : 'false'}
              data-empty-state={!mobile || !code || !newPassword ? 'true' : 'false'}
            >
            <div>
              <label htmlFor="reset-mobile" className="text-xs text-slate-600">شماره موبایل</label>
              <input
                id="reset-mobile"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900"
                placeholder="09123456789"
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="reset-code" className="text-xs text-slate-600">کد پیامکی</label>
              <input
                id="reset-code"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900"
                placeholder="1234"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="reset-password" className="text-xs text-slate-600">رمز عبور جدید</label>
              <input
                id="reset-password"
                type="password"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900"
                placeholder="حداقل 8 کاراکتر"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                minLength={8}
              />
            </div>

            {error ? <p className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</p> : null}
            {message ? <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">{message}</p> : null}

            <Button loading={loading} loadingText="در حال ثبت..." type="submit" className="btn-3d">
              ثبت رمز جدید
            </Button>
            </form>

            <div className="mt-6 text-sm">
              <Link href="/auth/login" className="text-slate-600 transition hover:text-orange-700">بازگشت به صفحه ورود</Link>
            </div>
          </GlassCard>
          <div>
            <AuthExperiencePanel heading="ثبت رمز جدید با مسیر امن و کوتاه" />
          </div>
        </div>
      </div>
    </Container>
  );
}
