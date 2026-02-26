'use client';

import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function AuthNavButton() {
  const router = useRouter();
  const { isAuthenticated, user, logout, loading } = useAuth();

  if (loading) {
    return (
      <Link
        href="/auth/login"
        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-orange-300 hover:bg-orange-50"
      >
        ورود
      </Link>
    );
  }

  if (!isAuthenticated) {
    return (
      <Link
        href="/auth/login"
        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-orange-300 hover:bg-orange-50"
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
      className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 transition hover:border-emerald-400"
    >
      خروج ({displayName})
    </button>
  );
}
