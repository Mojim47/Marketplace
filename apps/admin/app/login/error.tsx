'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { emitUiEvent } from '@/lib/ui-telemetry';
import { useTraceId } from '@/hooks/use-trace-id';

export default function LoginError({ error, reset }: { error: Error; reset: () => void }) {
  const traceId = useTraceId();

  useEffect(() => {
    emitUiEvent('error_shown', { code: 'admin_login_error' }, traceId ?? undefined);
  }, [traceId]);

  return (
    <div className="min-h-screen px-6 py-16">
      <div className="admin-card mx-auto max-w-xl rounded-3xl p-8 text-center">
        <h1 className="admin-title text-2xl text-white">خطا در ورود</h1>
        <p className="mt-3 text-sm text-slate-300">
          مشکلی در بارگذاری پنل ورود رخ داد. لطفاً دوباره تلاش کنید.
        </p>
        <p className="mt-2 text-xs text-slate-400">{error.message}</p>
        <div className="mt-6">
          <Button loading={false} onClick={() => reset()}>
            تلاش مجدد
          </Button>
        </div>
      </div>
    </div>
  );
}
