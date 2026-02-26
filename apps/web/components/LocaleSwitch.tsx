'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTraceId } from '../hooks/use-trace-id';
import { emitUiEvent } from '../lib/ui-telemetry';

export function LocaleSwitch() {
  const pathname = usePathname() || '/';
  const traceId = useTraceId();

  const onClick = (label: string) => {
    emitUiEvent('cta_click', { label, location: 'locale_switch' }, traceId ?? undefined);
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <Link
        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition hover:border-orange-300 hover:bg-orange-50"
        href={`/locale?lang=fa&next=${encodeURIComponent(pathname)}`}
        onClick={() => onClick('fa')}
      >
        فارسی
      </Link>
      <Link
        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition hover:border-orange-300 hover:bg-orange-50"
        href={`/locale?lang=en&next=${encodeURIComponent(pathname)}`}
        onClick={() => onClick('en')}
      >
        English
      </Link>
    </div>
  );
}
