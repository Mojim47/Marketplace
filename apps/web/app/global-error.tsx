'use client';

import { Button } from '@/components/ui';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--app-ink)]">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
          <h2 className="text-3xl font-semibold">Critical Error</h2>
          <p className="text-sm text-[color:var(--app-ink-muted)]">
            {error.message || 'Application failed to load'}
          </p>
          {error.digest && (
            <p className="text-xs text-[color:var(--app-ink-muted)]">Error ID: {error.digest}</p>
          )}
          <Button loading={false} onClick={reset} className="mt-2">
            Try again
          </Button>
        </div>
      </body>
    </html>
  );
}
