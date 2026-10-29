'use client';

import { useEffect, useState } from 'react';
import { formatDisplayDate, getCalendarDaysUntil, getPlanDaysRemaining } from '@wms/shared';

export function PlanCountdown({ startDate, endDate }: { startDate?: string; endDate?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!startDate && !endDate) return <span className="text-slate-400">No plan dates</span>;

  if (startDate) {
    const daysUntilStart = getCalendarDaysUntil(startDate, now);
    if (daysUntilStart === null) return <span className="text-slate-400">Invalid start date</span>;
    if (daysUntilStart > 0) {
      return (
        <span className="inline-flex flex-col">
          <span className="font-semibold tabular-nums text-blue-700">
            Starts in {daysUntilStart} {daysUntilStart === 1 ? 'day' : 'days'}
          </span>
          <span className="text-xs text-slate-500">Starts {formatDisplayDate(startDate)}</span>
        </span>
      );
    }
  }

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
