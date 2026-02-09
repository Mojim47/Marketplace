'use client';

import { LocaleSwitch } from '@/components/LocaleSwitch';
import { Button } from '@/components/ui/Button';
import { useTraceId } from '@/hooks/use-trace-id';
import { emitUiEvent } from '@/lib/ui-telemetry';
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

type ProfileForm = {
  fullName: string;
  email: string;
  phone: string;
};

export default function ProfilePage() {
  const traceId = useTraceId();
  const locale = typeof document !== 'undefined' ? document.documentElement.lang : 'fa';
  const [form, setForm] = useState<ProfileForm>({ fullName: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const strings = useMemo(
    () =>
      locale === 'en'
        ? {
            title: 'Profile settings',
            subtitle: 'Update your account details and contact preferences.',
            infoTitle: 'Account status',
            infoBody: 'Your profile is secured with verified contact points.',
            fullName: 'Full name',
            email: 'Email address',
            phone: 'Phone number',
            submit: 'Save changes',
            error: 'Please complete all required fields.',
            success: 'Profile updated successfully.',
          }
        : {
            title: 'تنظیمات پروفایل',
            subtitle: 'جزئیات حساب و ترجیحات ارتباطی خود را به‌روزرسانی کنید.',
            infoTitle: 'وضعیت حساب',
            infoBody: 'پروفایل شما با مسیرهای ارتباطی تأییدشده ایمن است.',
            fullName: 'نام و نام خانوادگی',
            email: 'ایمیل',
            phone: 'شماره تماس',
            submit: 'ذخیره تغییرات',
            error: 'لطفاً تمام فیلدهای ضروری را تکمیل کنید.',
            success: 'پروفایل با موفقیت به‌روزرسانی شد.',
          },
    [locale]
  );

  useEffect(() => {
    emitUiEvent('page_view', { path: '/profile', locale }, traceId ?? undefined);
  }, [locale, traceId]);

  const handleChange = (key: keyof ProfileForm) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccess(false);
    setError(null);

    if (!form.fullName || !form.email || !form.phone) {
      setError(strings.error);
      emitUiEvent('error_shown', { code: 'profile_missing_fields' }, traceId ?? undefined);
      return;
    }

    setLoading(true);
    emitUiEvent('flow_start', { flow: 'profile_update' }, traceId ?? undefined);
    emitUiEvent('cta_click', { label: 'profile_save', location: 'profile' }, traceId ?? undefined);

    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      emitUiEvent(
        'flow_complete',
        { flow: 'profile_update', status: 'success' },
        traceId ?? undefined
      );
    }, 600);
  };

  return (
    <div className="min-h-screen" data-trace-id={traceId ?? undefined}>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-300">NextGen Marketplace</p>
            <h1 className="section-title mt-2 text-3xl text-white" data-testid="profile-title">
              {strings.title}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-slate-300">{strings.subtitle}</p>
          </div>
          <LocaleSwitch />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form
            className="glass-card rounded-3xl p-6"
            data-error-state={error ? 'visible' : 'hidden'}
            data-empty-state={form.fullName || form.email || form.phone ? 'filled' : 'empty'}
            onSubmit={handleSubmit}
            data-testid="profile-form"
          >
            <h2 className="section-title text-xl text-white">{strings.title}</h2>
            <div className="mt-6 space-y-4 text-sm">
              <div>
                <label htmlFor="profile-fullname" className="text-xs text-slate-300">
                  {strings.fullName}
                </label>
                <input
                  id="profile-fullname"
                  className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white"
                  placeholder={strings.fullName}
                  value={form.fullName}
                  onChange={handleChange('fullName')}
                  aria-invalid={Boolean(error)}
                  data-testid="profile-fullname"
                />
              </div>
              <div>
                <label htmlFor="profile-email" className="text-xs text-slate-300">
                  {strings.email}
                </label>
                <input
                  id="profile-email"
                  className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white"
                  placeholder={strings.email}
                  type="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  aria-invalid={Boolean(error)}
                  data-testid="profile-email"
                />
              </div>
              <div>
                <label htmlFor="profile-phone" className="text-xs text-slate-300">
                  {strings.phone}
                </label>
                <input
                  id="profile-phone"
                  className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white"
                  placeholder={strings.phone}
                  value={form.phone}
                  onChange={handleChange('phone')}
                  aria-invalid={Boolean(error)}
                  data-testid="profile-phone"
                />
              </div>
            </div>

            {error ? (
              <p
                className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-rose-200"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            {success ? (
              <output
                className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-emerald-300"
                aria-live="polite"
              >
                {strings.success}
              </output>
            ) : null}

            <div className="mt-8">
              <Button loading={loading} loadingText={strings.submit} data-testid="profile-submit">
                {strings.submit}
              </Button>
            </div>
          </form>

          <div className="glass-card rounded-3xl p-6" data-testid="profile-status">
            <h2 className="section-title text-xl text-white">{strings.infoTitle}</h2>
            <p className="mt-4 text-sm text-slate-300">{strings.infoBody}</p>
            <div className="mt-6 space-y-3 text-sm">
              {['Email verified', 'Phone verified', '2FA enabled'].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3"
                >
                  <span className="text-slate-200">{item}</span>
                  <span className="text-emerald-300">Active</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
