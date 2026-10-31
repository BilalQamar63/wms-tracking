'use client';

import { formatDisplayDate, getPlanDurationDays, getTodayYmd, toDateInputValue } from '@wms/shared';

export function PlanCountdown({
  startDate,
  endDate,
  today = getTodayYmd(),
}: {
  startDate?: string;
  endDate?: string;
  today?: string;
}) {
  if (!startDate || !endDate) return <span className="text-slate-400">No date range</span>;

  const start = toDateInputValue(startDate);
  const end = toDateInputValue(endDate);
  const days = start && end ? getPlanDurationDays(start, end) : null;
  if (days === null) return <span className="text-slate-400">Invalid date range</span>;
  if (end < today) {
    return (
      <span className="inline-flex flex-col">
        <span className="font-semibold text-red-700">Expired</span>
        <span className="text-xs text-slate-500">Ended {formatDisplayDate(end)}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col">
      <span className="font-semibold tabular-nums text-emerald-700">
        {days} {days === 1 ? 'day' : 'days'} validity
      </span>
      <span className="text-xs text-slate-500">Ends {formatDisplayDate(end)}</span>
    </span>
  );
}
