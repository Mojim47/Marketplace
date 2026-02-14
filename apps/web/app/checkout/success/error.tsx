'use client';

import { Button } from '@/components/ui/Button';
import { useTraceId } from '@/hooks/use-trace-id';
import { emitUiEvent } from '@/lib/ui-telemetry';
import { useEffect } from 'react';

export default function CheckoutSuccessError({
  error,
  reset,
}: { error: Error; reset: () => void }) {
  const traceId = useTraceId();

  useEffect(() => {
    emitUiEvent('error_shown', { code: 'checkout_success_error' }, traceId ?? undefined);
  }, [traceId]);

  return (
    <div className="min-h-screen px-6 py-16">
      <div className="glass-card mx-auto max-w-xl rounded-3xl p-8 text-center">
        <h1 className="section-title text-2xl text-white">مشکل در تایید سفارش</h1>
        <p className="mt-3 text-sm text-slate-300">
          خطایی هنگام نمایش وضعیت سفارش رخ داد. لطفاً دوباره تلاش کنید.
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
