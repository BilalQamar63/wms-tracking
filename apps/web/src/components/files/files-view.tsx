'use client';

import { Fragment, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { FileKind, FileRecordDTO, SessionUser } from '@wms/shared';
import { formatDisplayDate } from '@wms/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { useToast } from '@/components/ui/toast';
import { useFiles, type FileFilterState } from '@/hooks/use-files';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils/cn';

const TABS: ReadonlyArray<{ value: FileKind | ''; label: string }> = [
  { value: '', label: 'All' },
  { value: 'import', label: 'Imports' },
  { value: 'export', label: 'Exports' },
];

const dayLabel = (iso: string) => formatDisplayDate(iso);
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const sizeLabel = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function FilesView({ currentUser }: { currentUser: SessionUser }) {
  const toast = useToast();
  const [filters, setFilters] = useState<FileFilterState>({ kind: '', dateFrom: '', dateTo: '' });
  const [page, setPage] = useState(1);
  const { data, error, isLoading, mutate: refresh } = useFiles(filters, page);
  const [deleting, setDeleting] = useState<FileRecordDTO | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setPage(1), [filters]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiFetch(`/api/files/${deleting.id}`, { method: 'DELETE' });
      toast.success('File removed');
      setDeleting(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete the file');
    } finally {
      setBusy(false);
    }
  }

  const canDelete = currentUser.role === 'admin';

  return (
    <>
      <PageHeader
        title="Import / Export History"
        description="Import snapshots and export activity, grouped by date and recorded in the database."
      />

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilters((f) => ({ ...f, kind: tab.value }))}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium',
                  filters.kind === tab.value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              aria-label="From date"
              className="w-40"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            />
            <span className="text-xs text-slate-400">to</span>
            <Input
              type="date"
              aria-label="To date"
              className="w-40"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            />
          </div>
        </div>

        {error ? (
          <EmptyState title="Could not load history">{error.message}</EmptyState>
        ) : isLoading && !data ? (
          <EmptyState title="Loading…" />
        ) : data && data.items.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">File</th>
                    <th className="px-4 py-3">Rows</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3">By</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((file, index) => {
                    const newDay =
                      index === 0 ||
                      dayLabel(file.createdAt) !== dayLabel(data.items[index - 1]!.createdAt);
                    return (
                      <Fragment key={file.id}>
                        {newDay && (
                          <tr className="bg-slate-50/80">
                            <td
                              colSpan={7}
                              className="px-4 py-2 text-xs font-semibold text-slate-600"
                            >
                              {dayLabel(file.createdAt)}
                            </td>
                          </tr>
                        )}
                        <tr className="border-t border-slate-100 hover:bg-slate-50/70">
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500">
                            {timeLabel(file.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={file.kind === 'import' ? 'blue' : 'green'}>
                              {file.kind === 'import' ? 'Import' : 'Export'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">{file.originalName}</p>
                            <p className="text-xs text-slate-400">{sizeLabel(file.bytes)}</p>
                          </td>
                          <td className="px-4 py-3 tabular-nums">{file.rowCount}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {file.stats ? (
                              <span>
                                {file.stats.inserted} added · {file.stats.updated} updated
                                {file.stats.failed > 0 && (
                                  <span className="text-red-600">
                                    {' '}
                                    · {file.stats.failed} skipped
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {file.createdBy ? (
                              <span
                                className={cn(file.createdBy.isDeleted && 'italic text-slate-400')}
                              >
                                {file.createdBy.name}
                                {file.createdBy.isDeleted && ' (deleted)'}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleting(file)}
                                aria-label={`Delete ${file.originalName}`}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
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
          </>
        ) : (
          <EmptyState title="No activity yet">
            Import snapshots and export activity will appear here.
          </EmptyState>
        )}
      </section>

      <ConfirmDialog
        open={!!deleting}
        title="Delete file"
        loading={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      >
        Remove <b>{deleting?.originalName}</b> from history?
        {deleting?.kind === 'import' ? ' Its saved snapshot will also be deleted.' : ''}
      </ConfirmDialog>
    </>
  );
}
