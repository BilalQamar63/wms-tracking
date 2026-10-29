'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ToastKind = 'success' | 'error';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, kind, message }]);
    setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 5000);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2" aria-live="polite">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-lg border bg-white p-3 text-sm shadow-lg',
              item.kind === 'success' ? 'border-emerald-200' : 'border-red-200',
            )}
          >
            {item.kind === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            )}
            <span className="text-slate-700">{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
