'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: ReactNode;
  footer?: ReactNode;
}

const WIDTHS = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const;

export function Modal({ open, title, description, onClose, size = 'md', children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-slate-900/50" onClick={onClose} aria-hidden />
      <div className={cn('relative w-full rounded-xl bg-white shadow-xl', WIDTHS[size])}>
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3 rounded-b-xl">{footer}</footer>}
      </div>
    </div>
  );
}
