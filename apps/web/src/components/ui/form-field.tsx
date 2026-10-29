import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, error, required, className, children }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export const controlClass = (invalid?: boolean) =>
  cn(
    'h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400',
    'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500',
    'disabled:bg-slate-100 disabled:text-slate-500',
    invalid ? 'border-red-400' : 'border-slate-300',
  );
