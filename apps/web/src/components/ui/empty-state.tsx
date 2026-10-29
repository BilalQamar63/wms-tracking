import type { ReactNode } from 'react';

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-14 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {children && <p className="text-sm text-slate-500">{children}</p>}
    </div>
  );
}
