'use client';

import { Clock3, Trash2 } from 'lucide-react';
import useSWR from 'swr';
import type { PermitRegisterSummaryDTO } from '@wms/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { swrFetcher } from '@/lib/api-client';

export function RegisterSummary({
  canManage,
  onDelete,
}: {
  canManage: boolean;
  onDelete: () => void;
}) {
  const { data, error, isLoading } = useSWR<PermitRegisterSummaryDTO>(
    '/api/permits/summary',
    swrFetcher,
  );

  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Clock3 className="h-4 w-4 text-brand-700" />
            PTW Tracking Register
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Last updated:{' '}
            {data?.updatedAt
              ? new Date(data.updatedAt).toLocaleString([], {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : 'No updates yet'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data && (
            <div className="flex flex-wrap gap-2">
              <Badge tone="blue">Total {data.total}</Badge>
              <Badge tone="amber">Active {data.active}</Badge>
              <Badge tone="green">Closed {data.closed}</Badge>
              <Badge tone="slate">Not Closed {data.notClosed}</Badge>
            </div>
          )}
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Delete current register"
              title="Delete current register"
              disabled={!data || data.total === 0}
              onClick={onDelete}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {error && (
        <div className="border-t border-slate-100 px-5 py-3">
          <EmptyState title="Could not load register summary">{error.message}</EmptyState>
        </div>
      )}
      {isLoading && !data && (
        <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
          Loading register summary…
        </p>
      )}
    </section>
  );
}
