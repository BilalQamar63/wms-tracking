'use client';

import { useEffect, useState } from 'react';
import { formatDisplayDate, getPlanDaysRemaining } from '@wms/shared';

export function PlanCountdown({ endDate }: { endDate?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!endDate) return <span className="text-slate-400">No end date</span>;

  const days = getPlanDaysRemaining(endDate, now);
  if (days === null) return <span className="text-slate-400">Invalid end date</span>;
  if (days === 0) {
    return (
      <span className="inline-flex flex-col">
        <span className="font-semibold text-red-700">Expired</span>
        <span className="text-xs text-slate-500">Ended {formatDisplayDate(endDate)}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col">
      <span
        className={`font-semibold tabular-nums ${days <= 3 ? 'text-amber-700' : 'text-emerald-700'}`}
      >
        {days} {days === 1 ? 'day' : 'days'} left
      </span>
      <span className="text-xs text-slate-500">Ends {formatDisplayDate(endDate)}</span>
    </span>
  );
}
