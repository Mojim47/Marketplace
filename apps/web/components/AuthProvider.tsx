'use client';

import { initializeFlowState, transitionFlow } from '@/lib/marketplace-state-machine';
import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

type AuthUser = {
  id: string;
  email?: string | null;
  mobile?: string | null;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
};

type LoginInput = { mobile: string; password: string; totpCode?: string };
type RegisterInput = {
  email?: string;
  password: string;
  mobile: string;
  firstName?: string;
  lastName?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  // eslint-disable-next-line no-unused-vars
  login(input: LoginInput): Promise<{ ok: boolean; error?: string; code?: string }>;
  // eslint-disable-next-line no-unused-vars
  register(input: RegisterInput): Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function parseApiResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    const data = await parseApiResponse(response);
    if (response.ok && data.authenticated === true) {
      setUser((data.user ?? null) as AuthUser | null);
      transitionFlow('S1_AUTHENTICATED', { reason: 'session_valid' });
      return;
    }

    transitionFlow('S2_TOKEN_EXPIRED', { reason: 'session_invalid_or_expired' });
    const refreshResponse = await fetch('/api/auth/refresh', { method: 'POST' });
    if (!refreshResponse.ok) {
      transitionFlow('S3_SESSION_INVALID', {
        reason: 'refresh_failed',
        guard: 'auth_refresh_guard',
      });
      transitionFlow('S13_LOGGED_OUT', { reason: 'force_logout_after_refresh_fail' });
      setUser(null);
      return;
    }

    const recheck = await fetch('/api/auth/session', { cache: 'no-store' });
    const recheckData = await parseApiResponse(recheck);
    if (recheck.ok && recheckData.authenticated === true) {
      setUser((recheckData.user ?? null) as AuthUser | null);
      transitionFlow('S1_AUTHENTICATED', { reason: 'refresh_success' });
      return;
    }

    transitionFlow('S3_SESSION_INVALID', { reason: 'recheck_failed_after_refresh' });
    transitionFlow('S13_LOGGED_OUT', { reason: 'force_logout_after_recheck_fail' });
    setUser(null);
  };

  useEffect(() => {
    initializeFlowState('S0_ANON', { reason: 'provider_boot' });
    refresh().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const id = window.setInterval(
      () => {
        refresh().catch(() => undefined);
      },
      10 * 60 * 1000
    );

    return () => window.clearInterval(id);
  }, [user]);

  const login = async (input: LoginInput) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
    } catch {
      transitionFlow('S_ERR', { reason: 'login_network_timeout', guard: 'login_guard' });
      return { ok: false, error: 'network_timeout', code: 'network_timeout' };
    } finally {
      window.clearTimeout(timeout);
    }

    const data = await parseApiResponse(response);

    if (!response.ok) {
      transitionFlow('S_ERR', {
        reason: 'login_failed',
        guard: 'login_guard',
        details: { status: response.status },
      });
      return { ok: false, error: String(data.error ?? 'ورود ناموفق بود'), code: 'login_failed' };
    }

    setUser((data.user ?? null) as AuthUser | null);
    transitionFlow('S1_AUTHENTICATED', { reason: 'login_success' });
    return { ok: true };
  };

  const register = async (input: RegisterInput) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await parseApiResponse(response);

    if (!response.ok) {
      transitionFlow('S_ERR', {
        reason: 'register_failed',
        guard: 'register_guard',
        details: { status: response.status },
      });
      return { ok: false, error: String(data.error ?? 'ثبت نام ناموفق بود') };
    }

    setUser((data.user ?? null) as AuthUser | null);
    transitionFlow('S1_AUTHENTICATED', { reason: 'register_success' });
    return { ok: true };
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    transitionFlow('S13_LOGGED_OUT', { reason: 'user_logout' });
    transitionFlow('S0_ANON', { reason: 'return_to_anon_after_logout' });
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      loading,
      login,
      register,
      logout,
      refresh,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
