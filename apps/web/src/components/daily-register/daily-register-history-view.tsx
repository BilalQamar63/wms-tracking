'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import type { DailyRegisterDTO, DailyRegisterSummaryDTO, Paginated } from '@wms/shared';
import { formatDisplayDate, getDailyRegisterWorkHours } from '@wms/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { useToast } from '@/components/ui/toast';
import { apiFetch, swrFetcher, toQueryString } from '@/lib/api-client';

const PAGE_SIZE = 20;

export function DailyRegisterHistoryView() {
  const toast = useToast();
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<DailyRegisterDTO | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const query = toQueryString({ date: date || undefined, page });
  const { data, error, isLoading, mutate } = useSWR<Paginated<DailyRegisterDTO>>(
    `/api/daily-register/history${query}`,
    swrFetcher,
  );
  const summaryQuery = toQueryString({ date: date || undefined });
  const { data: summary, error: summaryError } = useSWR<DailyRegisterSummaryDTO>(
    `/api/daily-register/summary${summaryQuery}`,
    swrFetcher,
  );

  function changeDate(value: string) {
    setDate(value);
    setPage(1);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiFetch(`/api/daily-register/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      toast.success('Daily register entry deleted');
      await mutate();
      await globalMutate((key) => typeof key === 'string' && key.startsWith('/api/daily-register/dashboard'));
      await globalMutate((key) => typeof key === 'string' && key.startsWith('/api/daily-register/summary'));
      await globalMutate((key) => typeof key === 'string' && key.startsWith('/api/files'));
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Could not delete entry');
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Daily Permit Entry History"
        description="Review daily permit records, including imported and manually entered entries. Filter by one date or browse all entries."
      />
      {summaryError ? (
        <p role="alert" className="mb-3 text-sm text-red-600">
          Could not load permit totals: {summaryError.message}
        </p>
      ) : null}
      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">{date ? 'Permits on selected date' : 'Total permits'}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{summary?.total ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Day shift</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{summary?.day ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Night shift</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{summary?.night ?? 0}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Filter by date</span>
            <Input type="date" value={date} onChange={(event) => changeDate(event.target.value)} />
          </label>
          {date ? (
            <Button variant="secondary" onClick={() => changeDate('')}>Show all dates</Button>
          ) : null}
          <p className="text-sm text-slate-600">{data?.total ?? 0} matching entries</p>
        </div>

        {error ? (
          <EmptyState title="Could not load permit history">{error.message}</EmptyState>
        ) : isLoading && !data ? (
          <EmptyState title="Loading permit history…" />
        ) : data?.items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-max border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    {[
                      'Date', 'Sr No', 'Shift', 'PTW Number', 'Shift Validity',
                      'Work Start', 'Work End', 'Extended Hours', 'Work Hours',
                      'Permit Issuer', 'Issuer Time', 'Job Performer 1', 'Time',
                      'Job Performer 2', 'Time', 'PTW Status', 'Remarks', 'Actions',
                    ].map((heading) => (
                      <th
                        key={heading}
                        className={`whitespace-nowrap border border-slate-300 px-3 py-2 ${
                          heading === 'Actions'
                            ? 'sticky right-0 z-20 bg-slate-50'
                            : ''
                        }`}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((entry) => {
                    const hours = getDailyRegisterWorkHours(
                      entry.workStartTime,
                      entry.workEndTime,
                      entry.extendedHours,
                    );
                    const editUrl = `/daily-register?date=${encodeURIComponent(entry.date)}&edit=${encodeURIComponent(entry.id)}`;
                    return (
                      <tr key={entry.id} className="group hover:bg-slate-50/70">
                        <td className="whitespace-nowrap border border-slate-300 px-3 py-2">{formatDisplayDate(entry.date)}</td>
                        <td className="border border-slate-300 px-3 py-2 tabular-nums">{entry.srNo}</td>
                        <td className="border border-slate-300 px-3 py-2">{entry.shiftDayNight || '—'}</td>
                        <td className="border border-slate-300 px-3 py-2">{entry.ptwNumber || '—'}</td>
                        <td className="border border-slate-300 px-3 py-2">{entry.shiftValidity || '—'}</td>
                        <td className="border border-slate-300 px-3 py-2">{entry.workStartTime || '—'}</td>
                        <td className="border border-slate-300 px-3 py-2">{entry.workEndTime || '—'}</td>
                        <td className="border border-slate-300 px-3 py-2">{entry.extendedHours || '—'}</td>
                        <td className="border border-slate-300 px-3 py-2">{hours === undefined ? '—' : hours.toFixed(2)}</td>
                        <td className="border border-slate-300 px-3 py-2">{entry.permitIssuer || '—'}</td>
                        <td className="border border-slate-300 px-3 py-2">{entry.permitIssuerTime || '—'}</td>
                        <td className="border border-slate-300 px-3 py-2">{entry.jobPerformer1 || '—'}</td>
                        <td className="border border-slate-300 px-3 py-2">{entry.jobPerformer1Time || '—'}</td>
                        <td className="border border-slate-300 px-3 py-2">{entry.jobPerformer2 || '—'}</td>
                        <td className="border border-slate-300 px-3 py-2">{entry.jobPerformer2Time || '—'}</td>
                        <td className="sticky right-0 z-10 border border-slate-300 bg-white px-3 py-2 group-hover:bg-slate-50">
                          {entry.ptwStatus ? (
                            <Badge tone={entry.ptwStatus.toLowerCase().startsWith('liv') ? 'green' : 'amber'}>
                              {entry.ptwStatus}
                            </Badge>
                          ) : '—'}
                        </td>
                        <td className="max-w-64 border border-slate-300 px-3 py-2">{entry.remarks || '—'}</td>
                        <td className="border border-slate-300 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Link href={editUrl} className="font-medium text-brand-700 hover:underline">Edit</Link>
                            <Button variant="danger" size="sm" onClick={() => setDeleting(entry)}>Delete</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              limit={PAGE_SIZE}
              onChange={setPage}
            />
          </>
        ) : (
          <EmptyState title="No daily permit entries">
            Choose another date or add entries from the Daily Register.
          </EmptyState>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete daily permit entry?"
        loading={deleteBusy}
        onConfirm={confirmDelete}
        onClose={() => !deleteBusy && setDeleting(null)}
      >
        This will permanently remove PTW {deleting?.ptwNumber || 'entry'} from the daily register.
      </ConfirmDialog>
    </>
  );
}
