'use client';

import { useState } from 'react';
import useSWR from 'swr';
import type { ApprovalContactHistoryDTO, Paginated } from '@wms/shared';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { swrFetcher, toQueryString } from '@/lib/api-client';

const PAGE_SIZE = 20;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ApprovalContactHistoryView() {
  const [page, setPage] = useState(1);
  const { data, error, isLoading } = useSWR<Paginated<ApprovalContactHistoryDTO>>(
    `/api/approval-contacts/history${toQueryString({ page, limit: PAGE_SIZE })}`,
    swrFetcher,
  );

  return (
    <>
      <PageHeader
        title="Authorized People Import / Export History"
        description="Review authorization workbook imports and exports, including the user and result."
      />
      {error ? (
        <EmptyState title="Could not load authorization history">{error.message}</EmptyState>
      ) : isLoading && !data ? (
        <EmptyState title="Loading authorization history…" />
      ) : data?.items.length ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date / time</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Rows</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={entry.kind === 'import' ? 'blue' : 'green'}>
                        {entry.kind === 'import' ? 'Import' : 'Export'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{entry.fileName}</p>
                      <p className="text-xs text-slate-500">{formatBytes(entry.bytes)}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{entry.rowCount}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {entry.kind === 'import'
                        ? `${entry.added ?? 0} added · ${entry.updated ?? 0} updated · ${entry.unchanged ?? 0} unchanged · ${entry.skipped ?? 0} skipped`
                        : `${entry.rowCount} exported`}
                    </td>
                    <td className="px-4 py-3">{entry.createdBy?.name ?? 'Unknown user'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            limit={data.limit}
            onChange={setPage}
          />
        </section>
      ) : (
        <EmptyState title="No authorization file history">
          Imports and exports will appear here after they are completed.
        </EmptyState>
      )}
    </>
  );
}
