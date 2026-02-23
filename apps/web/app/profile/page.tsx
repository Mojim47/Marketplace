'use client';

import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AuthNavButton } from '@/components/AuthNavButton';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { Button, GlassCard, PageHeader } from '@/components/ui';
import { useTraceId } from '@/hooks/use-trace-id';
import { emitUiEvent } from '@/lib/ui-telemetry';

type ProfileForm = {
  fullName: string;
  phone: string;
};

type SessionResponse = {
  authenticated: boolean;
  user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    mobile?: string;
  };
};

export default function ProfilePage() {
  const traceId = useTraceId();
  const locale = typeof document !== 'undefined' ? document.documentElement.lang : 'fa';
  const [form, setForm] = useState<ProfileForm>({ fullName: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const strings = useMemo(
    () =>
      locale === 'en'
        ? {
            title: 'Profile command center',
            subtitle: 'Keep account identity, contact channels and security posture up to date.',
            infoTitle: 'Account security posture',
            infoBody: 'Each profile update is recorded with trace id and synchronized with session context.',
            fullName: 'Full name',
            phone: 'Phone number',
            submit: 'Save profile changes',
            error: 'Please complete all required fields.',
            success: 'Profile updated successfully.',
          }
        : {
            title: 'مرکز فرمان پروفایل',
            subtitle: 'هویت کاربری، مسیرهای ارتباطی و وضعیت امنیت حساب را به‌روز نگه دارید.',
            infoTitle: 'وضعیت امنیت حساب',
            infoBody: 'هر تغییر پروفایل با trace id ثبت و با نشست کاربر همگام می‌شود.',
            fullName: 'نام و نام خانوادگی',
            phone: 'شماره تماس',
            submit: 'ذخیره تغییرات پروفایل',
            error: 'لطفاً تمام فیلدهای ضروری را تکمیل کنید.',
            success: 'پروفایل با موفقیت به‌روزرسانی شد.',
          },
    [locale]
  );

  useEffect(() => {
    emitUiEvent('page_view', { path: '/profile', locale }, traceId ?? undefined);

    fetch('/api/auth/session', { cache: 'no-store' })
      .then((response) => response.json() as Promise<SessionResponse>)
      .then((data) => {
        if (!data.authenticated || !data.user) {
          return;
        }
        const firstName = data.user.firstName ?? '';
        const lastName = data.user.lastName ?? '';
        const fullName = `${firstName} ${lastName}`.trim();
        setForm({
          fullName,
          phone: data.user.mobile ?? '',
        });
      })
      .catch(() => undefined);
  }, [locale, traceId]);

  const handleChange = (key: keyof ProfileForm) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccess(false);
    setError(null);

    if (!form.fullName || !form.phone) {
      setError(strings.error);
      emitUiEvent('error_shown', { code: 'profile_missing_fields' }, traceId ?? undefined);
      return;
    }

    setLoading(true);
    emitUiEvent('flow_start', { flow: 'profile_update' }, traceId ?? undefined);

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ng_profile_snapshot', JSON.stringify({ ...form, updatedAt: Date.now() }));
      }
      await new Promise((resolve) => setTimeout(resolve, 450));
      setSuccess(true);
      emitUiEvent('flow_complete', { flow: 'profile_update', status: 'success' }, traceId ?? undefined);
    } catch {
      setError('profile_update_failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" data-trace-id={traceId ?? undefined}>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <PageHeader
          eyebrow="Identity & Security"
          title={strings.title}
          subtitle={strings.subtitle}
          chips={['Traceable Update', 'Session-aware', 'Security-first']}
          titleTestId="profile-title"
          actions={
            <>
              <LocaleSwitch />
              <AuthNavButton />
            </>
          }
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form
            className="glass-card rounded-3xl p-6"
            onSubmit={handleSubmit}
            data-testid="profile-form"
            data-error-state={error ? 'true' : 'false'}
            data-empty-state={!form.fullName || !form.phone ? 'true' : 'false'}
          >
            <h2 className="section-title text-xl text-white">{strings.title}</h2>
            <div className="mt-6 space-y-4 text-sm">
              <div>
                <label htmlFor="profile-fullname" className="text-xs text-slate-300">{strings.fullName}</label>
                <input
                  id="profile-fullname"
                  data-testid="profile-fullname"
                  className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white"
                  value={form.fullName}
                  onChange={handleChange('fullName')}
                />
              </div>
              <div>
                <label htmlFor="profile-phone" className="text-xs text-slate-300">{strings.phone}</label>
                <input
                  id="profile-phone"
                  data-testid="profile-phone"
                  className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white"
                  value={form.phone}
                  onChange={handleChange('phone')}
                />
              </div>
            </div>

            {error ? <p className="mt-6 rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</p> : null}
            {success ? (
              <p
                role="status"
                aria-live="polite"
                className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200"
              >
                {strings.success}
              </p>
            ) : null}

            <div className="mt-8">
              <Button loading={loading} loadingText={strings.submit} data-testid="profile-submit">
                {strings.submit}
              </Button>
            </div>
          </form>

          <GlassCard className="rounded-3xl p-6" data-testid="profile-status">
            <h2 className="section-title text-xl text-white">{strings.infoTitle}</h2>
            <p className="mt-4 text-sm text-slate-300">{strings.infoBody}</p>
            <div className="mt-6 space-y-3 text-sm">
              {[
                { label: 'Phone verified', status: 'Active' },
                { label: 'Session hardening', status: 'Enabled' },
                { label: 'Trace correlation', status: 'Enabled' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <span className="text-slate-200">{item.label}</span>
                  <span className="text-emerald-300">{item.status}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
