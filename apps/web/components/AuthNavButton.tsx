'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export function AuthNavButton() {
  const router = useRouter();
  const { isAuthenticated, user, logout, loading } = useAuth();

  if (loading) {
    return (
      <Link
        href="/auth/login"
        className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/5"
      >
        ورود
      </Link>
    );
  }

  if (!isAuthenticated) {
    return (
      <Link
        href="/auth/login"
        className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/5"
      >
        ورود
      </Link>
    );
  }

  const displayName = user?.firstName || user?.mobile || user?.email || 'حساب من';

  return (
    <button
      type="button"
      aria-busy="false"
      onClick={async () => {
        await logout();
        router.push('/auth/login');
        router.refresh();
      }}
      className="rounded-full border border-emerald-300/40 px-3 py-1.5 text-sm text-emerald-200 transition hover:border-emerald-200"
    >
      خروج ({displayName})
    </button>
  );
}
