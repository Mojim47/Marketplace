'use client';

import { Button } from '@/components/ui';
import { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service
    console.error('Application error:', error);
  }, [error]);

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4 text-center">
        <div className="text-6xl">âڑ ï¸ڈ</div>
        <h2 className="text-2xl font-bold text-gray-900">Something went wrong!</h2>
        <p className="text-gray-600">{error.message || 'An unexpected error occurred'}</p>
        {error.digest && <p className="text-sm text-gray-500">Error ID: {error.digest}</p>}
        <div className="flex gap-4 justify-center">
          <Button loading={false} onClick={reset} variant="primary">
            Try again
          </Button>
          <Button loading={false} onClick={handleGoHome} variant="secondary">
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
