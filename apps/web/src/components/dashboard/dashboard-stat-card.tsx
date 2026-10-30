import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const TONES = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  purple: 'bg-purple-50 text-purple-700 ring-purple-100',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  red: 'bg-red-50 text-red-700 ring-red-100',
} as const;

interface Props {
  label: string;
  value?: number;
  icon: LucideIcon;
  tone: keyof typeof TONES;
  active?: boolean;
  onClick?: () => void;
}

export function DashboardStatCard({
  label,
  value,
  icon: Icon,
  tone,
  active = false,
  onClick,
}: Props) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <span
          className={cn('flex h-9 w-9 items-center justify-center rounded-lg ring-1', TONES[tone])}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
        {value === undefined ? '—' : value.toLocaleString()}
      </p>
    </>
  );

  if (!onClick) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
        active ? 'border-brand-300 ring-2 ring-brand-100' : 'border-slate-200',
      )}
    >
      {content}
    </button>
  );
}
