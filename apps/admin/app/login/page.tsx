'use client';

import { useRouter } from 'next/navigation';
import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { Button } from '@/components/ui/button';
import { useTraceId } from '@/hooks/use-trace-id';
import { emitUiEvent } from '@/lib/ui-telemetry';

type FormState = {
  email: string;
  password: string;
};

export default function AdminLoginPage() {
  const router = useRouter();
  const traceId = useTraceId();
  const [form, setForm] = useState<FormState>({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const locale = typeof document !== 'undefined' ? document.documentElement.lang : 'fa';
  const strings = useMemo(
    () =>
      locale === 'en'
        ? {
            title: 'Admin Sign In',
            subtitle: 'Use your admin account to access the control center.',
            email: 'Email',
            password: 'Password',
            submit: 'Sign in',
            error: 'Enter your credentials to continue.',
          }
        : {
            title: 'ورود مدیران',
            subtitle: 'لطفاً از حساب مدیریتی خود برای دسترسی به داشبورد استفاده کنید.',
            email: 'ایمیل',
            password: 'رمز عبور',
            submit: 'ورود',
            error: 'برای ادامه، ایمیل و رمز عبور را وارد کنید.',
          },
    [locale]
  );

  useEffect(() => {
    emitUiEvent('page_view', { path: '/login', locale }, traceId ?? undefined);
    emitUiEvent('flow_start', { flow: 'admin_login' }, traceId ?? undefined);
  }, [locale, traceId]);

  const handleChange = (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const reportError = (code: string) => {
    setError(strings.error);
    emitUiEvent('error_shown', { code }, traceId ?? undefined);
    emitUiEvent('flow_complete', { flow: 'admin_login', status: 'error' }, traceId ?? undefined);
  };

  const isFormValid = () => {
    if (!form.email || !form.password) {
      reportError('admin_login_missing_fields');
      return false;
    }
    return true;
  };

  const submitLogin = async () => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: form.email, password: form.password }),
      });

      if (!response.ok) {
        reportError('admin_login_failed');
        return false;
      }

      emitUiEvent(
        'flow_complete',
        { flow: 'admin_login', status: 'success' },
        traceId ?? undefined
      );
      return true;
    } catch {
      reportError('admin_login_failed');
      return false;
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isFormValid()) {
      return;
    }

    setLoading(true);
    emitUiEvent(
      'cta_click',
      { label: 'admin_login_submit', location: 'admin_login' },
      traceId ?? undefined
    );

    const ok = await submitLogin();
    if (ok) {
      router.push('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen" data-trace-id={traceId ?? undefined}>
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-300">Admin Control Center</p>
            <h1 className="admin-title mt-2 text-3xl text-white" data-testid="admin-login-title">
              {strings.title}
            </h1>
            <p className="mt-3 max-w-md text-sm text-slate-300">{strings.subtitle}</p>
          </div>
          <LocaleSwitch />
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="admin-card rounded-3xl p-8">
            <form
              className="space-y-5"
              data-error-state={error ? 'visible' : 'hidden'}
              data-empty-state={form.email || form.password ? 'filled' : 'empty'}
              onSubmit={handleSubmit}
              data-testid="admin-login-form"
            >
              <div>
                <label className="text-xs text-slate-300" htmlFor="admin-email">
                  {strings.email}
                </label>
                <input
                  id="admin-email"
                  className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white"
                  placeholder={strings.email}
                  type="email"
                  autoComplete="email"
                  data-testid="admin-login-email"
                  value={form.email}
                  onChange={handleChange('email')}
                  aria-invalid={Boolean(error)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-300" htmlFor="admin-password">
                  {strings.password}
                </label>
                <input
                  id="admin-password"
                  className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white"
                  placeholder={strings.password}
                  type="password"
                  autoComplete="current-password"
                  data-testid="admin-login-password"
                  value={form.password}
                  onChange={handleChange('password')}
                  aria-invalid={Boolean(error)}
                />
              </div>
              {error ? (
                <p
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-rose-200"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              <Button
                loading={loading}
                loadingText={strings.submit}
                className="bg-gradient-to-b from-amber-300 to-amber-500 text-slate-900 shadow-[0_8px_0_#a16207]"
                data-testid="admin-login-submit"
              >
                {strings.submit}
              </Button>
            </form>
          </div>

          <div className="space-y-4">
            <div className="admin-card overflow-hidden rounded-3xl p-0">
              <div className="relative h-44 bg-[radial-gradient(circle_at_20%_20%,rgba(255,215,0,.26),transparent_58%),radial-gradient(circle_at_80%_80%,rgba(59,130,246,.23),transparent_52%),linear-gradient(140deg,#0f172a,#020617)] p-6">
                <p className="text-xs text-amber-200">Privilege Access Layer</p>
                <h2 className="admin-title mt-2 text-2xl text-white">Command-grade Authentication</h2>
                <p className="mt-2 text-sm text-slate-300">کنترل ورود، هشدار امنیتی و بررسی رخدادهای حساس در یک مسیر.</p>
              </div>
            </div>
            <div className="grid gap-3">
              {[
                ['Access policies', 'Active'],
                ['Audit trail', 'Live'],
                ['Incident response', 'Ready'],
              ].map(([item, state]) => (
                <div key={item} className="admin-card rounded-2xl p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200">{item}</span>
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                      {state}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
