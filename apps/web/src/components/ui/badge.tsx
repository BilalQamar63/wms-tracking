import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type Tone = 'green' | 'amber' | 'blue' | 'slate' | 'red' | 'purple';

const TONES: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  purple: 'bg-purple-50 text-purple-700 ring-purple-600/20',
};

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONES[tone])}>
      {children}
    </span>
  );
}
