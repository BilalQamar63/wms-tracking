'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { ChevronDown, Eye } from 'lucide-react';
import {
  DAILY_REGISTER_FIELDS,
  formatDisplayDate,
  formatPlanValidity,
  getDailyRegisterWorkHours,
  type DailyRegisterDTO,
  type DailyRegisterDashboardFiltersDTO,
  type DailyRegisterDashboardFilterOptionsDTO,
  type DailyRegisterDateGroupDTO,
  type DailyRegisterSummaryDTO,
  type Paginated,
} from '@wms/shared';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { useDebounce } from '@/hooks/use-debounce';
import { swrFetcher, toQueryString } from '@/lib/api-client';

const DASHBOARD_FIELD_KEYS = new Set([
  'shiftDayNight',
  'subContractor',
  'ptwNumber',
  'plannedStartDate',
  'plannedEndDate',
  'ptwValidity',
  'shiftValidity',
  'workStartTime',
  'workEndTime',
  'extendedHours',
  'workHours',
  'permitIssuer',
  'permitIssuerTime',
  'jobPerformer1',
  'jobPerformer1Time',
  'jobPerformer2',
  'jobPerformer2Time',
  'ptwStatus',
  'remarks',
]);

const DASHBOARD_FIELD_ORDER = [
  'subContractor',
  'ptwNumber',
  'plannedStartDate',
  'plannedEndDate',
  'ptwValidity',
  'shiftValidity',
  'shiftDayNight',
  'workStartTime',
  'workEndTime',
  'extendedHours',
  'workHours',
  'permitIssuer',
  'permitIssuerTime',
  'jobPerformer1',
  'jobPerformer1Time',
  'jobPerformer2',
  'jobPerformer2Time',
  'ptwStatus',
  'remarks',
] as const;

const DASHBOARD_FIELDS = DAILY_REGISTER_FIELDS
  .filter((field) => DASHBOARD_FIELD_KEYS.has(field.key))
  .sort(
    (left, right) =>
      DASHBOARD_FIELD_ORDER.indexOf(left.key as (typeof DASHBOARD_FIELD_ORDER)[number]) -
      DASHBOARD_FIELD_ORDER.indexOf(right.key as (typeof DASHBOARD_FIELD_ORDER)[number]),
  );

function displayFieldValue(entry: DailyRegisterDTO, field: (typeof DAILY_REGISTER_FIELDS)[number]) {
  if (field.type === 'computed') {
    return field.key === 'ptwValidity'
      ? formatPlanValidity(entry.plannedStartDate, entry.plannedEndDate)
      : (getDailyRegisterWorkHours(
          entry.workStartTime,
          entry.workEndTime,
          entry.extendedHours,
        )?.toFixed(2) ?? '');
  }
  const value = entry[field.key as keyof DailyRegisterDTO];
  if (field.type === 'date' && typeof value === 'string') return formatDisplayDate(value);
  return typeof value === 'string' ? value : '';
}

function DailyRegisterDateSection({
  date,
  total,
  day,
  night,
  isOpen,
  onToggle,
  onView,
}: {
  date: string;
  total: number;
  day: number;
  night: number;
  isOpen: boolean;
  onToggle: () => void;
  onView: (entry: DailyRegisterDTO) => void;
}) {
  const [page, setPage] = useState(1);
  const [ptwNumber, setPtwNumber] = useState('');
  const [ptwType, setPtwType] = useState('');
  const [subContractor, setSubContractor] = useState('');
  const [shiftDayNight, setShiftDayNight] = useState('');
  const [ptwStatus, setPtwStatus] = useState('');
  const debouncedPtwNumber = useDebounce(ptwNumber);
  const filters: DailyRegisterDashboardFiltersDTO = {
    ptwNumber: debouncedPtwNumber.trim() || undefined,
    ptwType: ptwType || undefined,
    subContractor: subContractor || undefined,
    shiftDayNight: shiftDayNight || undefined,
    ptwStatus: ptwStatus || undefined,
  };
  const filterQuery = toQueryString({
    ptwNumber: filters.ptwNumber,
    ptwType: filters.ptwType,
    subContractor: filters.subContractor,
    shiftDayNight: filters.shiftDayNight,
    ptwStatus: filters.ptwStatus,
  });
  useEffect(() => setPage(1), [filterQuery]);
  const query = toQueryString({ date, page, ...filters });
  const { data: filterOptions, error: filterOptionsError } =
    useSWR<DailyRegisterDashboardFilterOptionsDTO>(
      isOpen ? '/api/daily-register/dashboard/filter-options' : null,
      swrFetcher,
    );
  const { data, error, isLoading } = useSWR<Paginated<DailyRegisterDTO>>(
    isOpen ? `/api/daily-register/history${query}` : null,
    swrFetcher,
  );

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
      >
        <span className="flex items-center gap-2">
          <ChevronDown
            className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            {formatDisplayDate(date)}
          </span>
        </span>
        <span className="text-sm text-slate-500">
          {total} {total === 1 ? 'permit' : 'permits'}
        </span>
      </button>

      {isOpen ? (
        <>
          <div className="grid gap-3 border-b border-slate-300 bg-white p-4 sm:grid-cols-3">
            {[
              { label: 'Total permits', value: total },
              { label: 'Day shift', value: day },
              { label: 'Night shift', value: night },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="border-b border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Filter permits for {formatDisplayDate(date)}
            </h3>
            {filterOptionsError ? (
              <p role="alert" className="mb-3 text-sm text-red-600">
                Could not load permit filter options: {filterOptionsError.message}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">PTW Number</span>
                <Input
                  type="search"
                  placeholder="Search PTW number"
                  value={ptwNumber}
                  onChange={(event) => setPtwNumber(event.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">PTW Type</span>
                <Select
                  value={ptwType}
                  onChange={(event) => setPtwType(event.target.value)}
                  options={filterOptions?.ptwTypes ?? []}
                  placeholder="All PTW types"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Sub Contractor</span>
                <Select
                  value={subContractor}
                  onChange={(event) => setSubContractor(event.target.value)}
                  options={filterOptions?.subContractors ?? []}
                  placeholder="All sub contractors"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Shift</span>
                <Select
                  value={shiftDayNight}
                  onChange={(event) => setShiftDayNight(event.target.value)}
                  options={filterOptions?.shifts ?? []}
                  placeholder="Day and night"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">PTW Status</span>
                <Select
                  value={ptwStatus}
                  onChange={(event) => setPtwStatus(event.target.value)}
                  options={filterOptions?.ptwStatuses ?? []}
                  placeholder="All statuses"
                />
              </label>
            </div>
          </div>
          {error ? (
            <EmptyState title="Could not load permits for this date">{error.message}</EmptyState>
          ) : isLoading && !data ? (
            <EmptyState title={`Loading permits for ${formatDisplayDate(date)}…`} />
          ) : data?.items.length ? (
            <>
              <div className="overflow-auto">
                <table className="min-w-max border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="border border-slate-300 px-3 py-2">Sr No</th>
                      {DASHBOARD_FIELDS.map((field) => (
                        <th key={field.key} className="border border-slate-300 px-3 py-2">
                          {field.header}
                        </th>
                      ))}
                      <th className="sticky right-0 z-20 border border-slate-300 bg-slate-50 px-3 py-2">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((entry) => (
                      <tr key={entry.id} className="group hover:bg-slate-50">
                        <td className="border border-slate-200 px-3 py-2 font-medium">
                          {entry.srNo}
                        </td>
                        {DASHBOARD_FIELDS.map((field) => {
                          const display = displayFieldValue(entry, field);
                          return (
                            <td
                              key={field.key}
                              className="max-w-72 truncate border border-slate-300 px-3 py-2"
                              title={display || undefined}
                            >
                              {display || <span className="text-slate-300">—</span>}
                            </td>
                          );
                        })}
                        <td className="sticky right-0 z-10 border border-slate-300 bg-white px-3 py-1 group-hover:bg-slate-50">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`View all details for permit ${entry.ptwNumber || entry.srNo}`}
                            onClick={() => onView(entry)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
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
            </>
          ) : (
            <EmptyState title="No daily permit entries">
              No permits were found for {formatDisplayDate(date)}.
            </EmptyState>
          )}
        </>
      ) : null}
    </section>
  );
}

export function DailyRegisterDashboardView({ initialDate }: { initialDate: string }) {
  const [selectedEntry, setSelectedEntry] = useState<DailyRegisterDTO | null>(null);
  const [openDate, setOpenDate] = useState<string | null>(initialDate);
  const {
    data: dateGroups,
    error: entriesError,
    isLoading: entriesLoading,
  } = useSWR<DailyRegisterDateGroupDTO[]>('/api/daily-register/dashboard', swrFetcher);
  const {
    data: allTimeSummary,
    error: allTimeSummaryError,
  } = useSWR<DailyRegisterSummaryDTO>('/api/daily-register/summary', swrFetcher);
  return (
    <>
      <PageHeader
        title="Daily Permit Tracking Dashboard"
        description="View total permit counts and daily register entries across all companies. This dashboard is read-only."
      />

      {allTimeSummaryError ? (
        <p role="alert" className="mb-3 text-sm text-red-600">
          Could not load overall dashboard totals: {allTimeSummaryError.message}
        </p>
      ) : null}
      <section className="mb-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          All daily tracking records
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total permits</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {allTimeSummary?.total ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Day shift</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {allTimeSummary?.day ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Night shift</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {allTimeSummary?.night ?? 0}
            </p>
          </div>
        </div>
      </section>

      {entriesError ? (
        <EmptyState title="Could not load daily register history">
          {entriesError.message}
        </EmptyState>
      ) : entriesLoading && !dateGroups ? (
        <EmptyState title="Loading daily register history…" />
      ) : dateGroups?.length ? (
        <div className="space-y-4">
          {dateGroups.map(({ date, total, day, night }) => (
            <DailyRegisterDateSection
              key={date}
              date={date}
              total={total}
              day={day}
              night={night}
              isOpen={openDate === date}
              onToggle={() => setOpenDate((current) => (current === date ? null : date))}
              onView={setSelectedEntry}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No daily permit entries">
          Daily tracking records will appear here grouped by their register date.
        </EmptyState>
      )}

      <Modal
        open={!!selectedEntry}
        title={`Permit details${selectedEntry?.ptwNumber ? ` · ${selectedEntry.ptwNumber}` : ''}`}
        description={
          selectedEntry
            ? `Register date: ${formatDisplayDate(selectedEntry.date)} · Sr No ${selectedEntry.srNo}`
            : undefined
        }
        onClose={() => setSelectedEntry(null)}
        size="xl"
        footer={
          <Button variant="secondary" onClick={() => setSelectedEntry(null)}>
            Close
          </Button>
        }
      >
        {selectedEntry ? (
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {DAILY_REGISTER_FIELDS.map((field) => {
              const value = displayFieldValue(selectedEntry, field);
              return (
                <div key={field.key} className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">
                    {field.header.replace(/\s+/g, ' ')}
                  </p>
                  <p className="mt-1 break-words text-sm text-slate-900">{value || '—'}</p>
                </div>
              );
            })}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
