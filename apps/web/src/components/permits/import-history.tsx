'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock3 } from 'lucide-react';
import useSWR from 'swr';
import type { PermitImportDayDTO } from '@wms/shared';
import { formatDisplayDate } from '@wms/shared';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { swrFetcher } from '@/lib/api-client';
import { cn } from '@/lib/utils/cn';

interface Props {
  selectedBatchId: string | null;
  onSelect: (batchId: string | null) => void;
}

export function ImportHistory({ selectedBatchId, onSelect }: Props) {
  const {
    data: days,
    error,
    isLoading,
  } = useSWR<PermitImportDayDTO[]>('/api/permits/batches', swrFetcher);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Clock3 className="h-4 w-4 text-brand-700" />
          Imported register history
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Select an import date and upload to edit its saved data, then export the updated register.
          Closed counts reflect rows whose Status is set to Closed in those uploads.
        </p>
      </header>

      <div className="space-y-2 p-3">
        {error ? (
          <EmptyState title="Could not load import history">{error.message}</EmptyState>
        ) : isLoading ? (
          <p className="px-2 py-3 text-sm text-slate-500">Loading import dates…</p>
        ) : !days?.length ? (
          <p className="px-2 py-3 text-sm text-slate-500">Imported Excel files will appear here.</p>
        ) : (
          days.map((day) => {
            const isExpanded = expanded === day.date;
            return (
              <div key={day.date} className="overflow-hidden rounded-lg border border-slate-200">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => {
                    const availableBatches = day.batches.filter((batch) => batch.available);
                    if (availableBatches.length === 1) {
                      setExpanded(day.date);
                      onSelect(availableBatches[0]!.id);
                    } else {
                      setExpanded(isExpanded ? null : day.date);
                    }
                  }}
                  className="flex w-full flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {formatDisplayDate(day.date)}
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <Badge tone="blue">{day.total} permits</Badge>
                    <Badge tone="green">{day.closed} closed</Badge>
                  </span>
                </button>

                {isExpanded && (
                  <div className="divide-y divide-slate-100">
                    {day.batches.map((batch) => (
                      <button
                        key={batch.id}
                        type="button"
                        disabled={!batch.available}
                        onClick={() => onSelect(batch.id)}
                        className={cn(
                          'flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition',
                          selectedBatchId === batch.id
                            ? 'bg-brand-50 ring-1 ring-inset ring-brand-200'
                            : 'hover:bg-slate-50',
                          !batch.available && 'cursor-not-allowed opacity-60',
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-800">
                            {batch.originalName}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {new Date(batch.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {!batch.available &&
                              ' · Detailed history unavailable for this older import'}
                          </span>
                        </span>
                        {batch.available && (
                          <span className="flex gap-2">
                            <Badge tone="blue">{batch.total} permits</Badge>
                            <Badge tone="green">{batch.closed} closed</Badge>
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {selectedBatchId && (
        <div className="border-t border-slate-100 px-4 py-3 text-right">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-xs font-medium text-brand-700 hover:text-brand-900"
          >
            Return to current register
          </button>
        </div>
      )}
    </section>
  );
}
