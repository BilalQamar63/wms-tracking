'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  DAILY_PTW_STATUSES,
  DAILY_REGISTER_FIELDS,
  DAILY_SHIFTS,
  MAX_PTW_VALIDITY_DAYS,
  addDaysToYmd,
  dailyRegisterInputSchema,
  formatDisplayDate,
  getDailyRegisterShift,
  getExtendedHoursValue,
  getDailyRegisterWorkHours,
  getPlanDurationDays,
  formatPlanValidity,
  getTodayYmd,
  type DailyRegisterDTO,
  type DailyRegisterDateNavigationDTO,
  type DailyRegisterInput,
  type DailyRegisterPermitOptionDTO,
} from '@wms/shared';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useApprovalContactOptions } from '@/hooks/use-approval-contact-options';
import { useDebounce } from '@/hooks/use-debounce';
import { apiFetch, downloadFromApi, swrFetcher, toQueryString } from '@/lib/api-client';

const EMPTY_INPUT: DailyRegisterInput = {};
const DAILY_REGISTER_TABLE_HIDDEN_FIELDS = new Set([
  'plantDivision',
  'mainContractor',
  'department',
  'discipline',
  'ptwTitle',
  'equipmentTagNo',
  'ptwType',
  'certificateTypes',
]);
const DAILY_REGISTER_TABLE_ORDER = [
  'subContractor',
  'workLocation',
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
const DAILY_REGISTER_TABLE_FIELDS = DAILY_REGISTER_FIELDS
  .filter((field) => !DAILY_REGISTER_TABLE_HIDDEN_FIELDS.has(field.key))
  .sort(
    (left, right) =>
      DAILY_REGISTER_TABLE_ORDER.indexOf(
        left.key as (typeof DAILY_REGISTER_TABLE_ORDER)[number],
      ) -
      DAILY_REGISTER_TABLE_ORDER.indexOf(
        right.key as (typeof DAILY_REGISTER_TABLE_ORDER)[number],
      ),
  );

function getLocalCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function entryInput(entry: DailyRegisterDTO | null, date: string): DailyRegisterInput {
  const result: Record<string, string> = {};
  for (const field of DAILY_REGISTER_FIELDS) {
    if (field.type === 'computed') continue;
    const value = entry?.[field.key as keyof DailyRegisterDTO];
    const storedValue =
      typeof value === 'string'
        ? field.key === 'extendedHours'
          ? String(getExtendedHoursValue(value) || '')
          : value
        : field.key === 'plannedStartDate'
          ? date
          : field.key === 'plannedEndDate'
            ? addDaysToYmd(date, MAX_PTW_VALIDITY_DAYS - 1)
            : '';
    result[field.key] =
      field.key === 'shiftDayNight' || field.key === 'shiftValidity'
        ? storedValue.toLowerCase().startsWith('day')
          ? 'Day'
          : storedValue.toLowerCase().startsWith('night')
            ? 'Night'
            : ''
        : field.key === 'ptwStatus' && storedValue.toLowerCase().startsWith('liv')
          ? 'Live'
          : storedValue;
  }
  return result as DailyRegisterInput;
}

export function DailyRegisterView({
  isAdmin,
  assignedSubContractor,
  appTimeZone,
  initialDate,
  initialEditId,
}: {
  isAdmin: boolean;
  assignedSubContractor?: string;
  appTimeZone: string;
  initialDate?: string;
  initialEditId?: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const {
    data: authorizedPeople,
    error: authorizedPeopleError,
    isLoading: authorizedPeopleLoading,
  } = useApprovalContactOptions();
  const [date, setDate] = useState(() => initialDate ?? getTodayYmd(new Date(), appTimeZone));
  const [handledEditId, setHandledEditId] = useState('');
  const [liveTime, setLiveTime] = useState(getLocalCurrentTime);
  const [editing, setEditing] = useState<DailyRegisterDTO | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<DailyRegisterInput>(EMPTY_INPUT);
  const [formDate, setFormDate] = useState(() => getTodayYmd(new Date(), appTimeZone));
  const [selectedSubContractor, setSelectedSubContractor] = useState(assignedSubContractor ?? '');
  const [selectedPermitNumber, setSelectedPermitNumber] = useState('');
  const [permitSearch, setPermitSearch] = useState('');
  const debouncedPermitSearch = useDebounce(permitSearch);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<{
    stats: { total: number; inserted: number; updated: number; failed: number };
    errors: Array<{ row: number; messages: string[] }>;
  } | null>(null);
  const [deleting, setDeleting] = useState<DailyRegisterDTO | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState(date);
  const [exportDateTo, setExportDateTo] = useState(date);
  const [exportShifts, setExportShifts] = useState<Array<'day' | 'night'>>(['day', 'night']);
  const [selectedContractors, setSelectedContractors] = useState<string[]>([]);
  const [loadedContractorQuery, setLoadedContractorQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const query = useMemo(() => toQueryString({ date }), [date]);
  const { data, error, isLoading, mutate } = useSWR<DailyRegisterDTO[]>(
    date ? `/api/daily-register${query}` : null,
    swrFetcher,
  );
  const [searchText, setSearchText] = useState('');
  const [filterSubContractor, setFilterSubContractor] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const contractorFilterOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (data ?? [])
            .map((entry) => entry.subContractor?.trim())
            .filter((value): value is string => !!value),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [data],
  );
  const filteredEntries = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return (data ?? []).filter((entry) => {
      if (search && !entry.ptwNumber?.toLowerCase().includes(search)) return false;
      if (filterSubContractor && entry.subContractor !== filterSubContractor) return false;
      if (filterShift && entry.shiftDayNight?.toLowerCase() !== filterShift.toLowerCase()) {
        return false;
      }
      if (filterStatus && entry.ptwStatus?.toLowerCase() !== filterStatus.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [data, filterShift, filterStatus, filterSubContractor, searchText]);
  const dateNavigationQuery = date
    ? `/api/daily-register/dates${toQueryString({ date })}`
    : null;
  const {
    data: dateNavigation,
    error: dateNavigationError,
    isLoading: dateNavigationLoading,
  } = useSWR<DailyRegisterDateNavigationDTO>(dateNavigationQuery, swrFetcher);

  useEffect(() => {
    if (!formOpen) return;
    const updateTime = () => setLiveTime(getLocalCurrentTime());
    updateTime();
    const timer = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(timer);
  }, [formOpen]);

  function changeDate(nextDate: string) {
    setDate(nextDate);
    router.replace(
      nextDate ? `/daily-register?date=${encodeURIComponent(nextDate)}` : '/daily-register',
      { scroll: false },
    );
  }

  const openEdit = useCallback((entry: DailyRegisterDTO) => {
    setEditing(entry);
    setFormDate(entry.date);
    setFormData(entryInput(entry, entry.date));
    setSelectedSubContractor(entry.subContractor ?? assignedSubContractor ?? '');
    setSelectedPermitNumber(entry.ptwNumber ?? '');
    setPermitSearch(entry.ptwNumber ?? '');
    setFormErrors([]);
    setFormOpen(true);
  }, [assignedSubContractor]);
  useEffect(() => {
    if (!initialEditId || handledEditId === initialEditId || !data) return;
    const entry = data.find((item) => item.id === initialEditId);
    if (entry) openEdit(entry);
    setHandledEditId(initialEditId);
  }, [data, handledEditId, initialEditId, openEdit]);
  const permitContractorsQuery = formOpen
    ? `/api/daily-register/permit-contractors${toQueryString({ date: formDate })}`
    : null;
  const {
    data: permitContractors,
    error: permitContractorsError,
    isLoading: permitContractorsLoading,
  } = useSWR<string[]>(permitContractorsQuery, swrFetcher);
  const permitOptionsQuery = formOpen && selectedSubContractor
    ? `/api/daily-register/permit-options${toQueryString({
      date: formDate,
        subContractor: selectedSubContractor,
        search: debouncedPermitSearch,
      })}`
    : null;
  const {
    data: permitOptions,
    error: permitOptionsError,
    isLoading: permitOptionsLoading,
  } = useSWR<DailyRegisterPermitOptionDTO[]>(permitOptionsQuery, swrFetcher);
  const contractorQuery = useMemo(
    () => exportDateFrom && exportDateTo && exportDateFrom <= exportDateTo
      ? toQueryString({ dateFrom: exportDateFrom, dateTo: exportDateTo })
      : '',
    [exportDateFrom, exportDateTo],
  );
  const contractorOptionsQuery = exportOpen && contractorQuery
    ? `/api/daily-register/export-options${contractorQuery}`
    : null;
  const {
    data: contractorOptions,
    error: contractorOptionsError,
    isLoading: contractorOptionsLoading,
  } = useSWR<string[]>(contractorOptionsQuery, swrFetcher);

  useEffect(() => {
    if (
      contractorOptionsQuery &&
      contractorOptions &&
      loadedContractorQuery !== contractorOptionsQuery
    ) {
      setSelectedContractors(contractorOptions);
      setLoadedContractorQuery(contractorOptionsQuery);
    }
  }, [contractorOptions, contractorOptionsQuery, loadedContractorQuery]);

  const dailySummary = useMemo(() => ({
    permitCount: filteredEntries.length,
    dayPermits: filteredEntries.filter((entry) => entry.shiftDayNight?.trim().toLowerCase().startsWith('day')).length,
    nightPermits: filteredEntries.filter((entry) => entry.shiftDayNight?.trim().toLowerCase().startsWith('night')).length,
    livePermits: filteredEntries.filter((entry) => entry.ptwStatus?.trim().toLowerCase().startsWith('live')).length,
    suspendedPermits: filteredEntries.filter((entry) => entry.ptwStatus?.trim().toLowerCase().startsWith('suspended')).length,
  }), [filteredEntries]);

  function openCreate() {
    const today = getTodayYmd(new Date(), appTimeZone);
    setEditing(null);
    setFormDate(today);
    setFormData(entryInput(null, today));
    setSelectedSubContractor(assignedSubContractor ?? '');
    setSelectedPermitNumber('');
    setPermitSearch('');
    setFormErrors([]);
    setFormOpen(true);
  }

  function setField(key: string, value: string) {
    setFormData((current) => ({ ...current, [key]: value }));
  }

  function setPersonAndTime(
    personKey: keyof DailyRegisterInput,
    timeKey: keyof DailyRegisterInput,
    value: string,
  ) {
    const timeAtSelection = getLocalCurrentTime();
    setFormData((current) => ({
      ...current,
      [personKey]: value,
      [timeKey]: value ? current[timeKey] || timeAtSelection : '',
      ...(personKey === 'jobPerformer1' && !value ? { extendedHours: '' } : {}),
    }));
  }

  function renderPerformerField(
    personKey: 'jobPerformer1' | 'jobPerformer2',
    timeKey: 'jobPerformer1Time' | 'jobPerformer2Time',
    heading: string,
  ) {
    const currentPerson = formData[personKey] ?? '';
    const currentTime = formData[timeKey] ?? '';
    const extraHours = Number(formData.extendedHours ?? 0);
    const extendedEndMinutes = 17 * 60 + 59 + extraHours * 60;
    const extendedEnd = `${String(Math.floor(extendedEndMinutes / 60)).padStart(2, '0')}:${String(extendedEndMinutes % 60).padStart(2, '0')}`;

    return (
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">{heading}</span>
          <select
            value={currentPerson}
            onChange={(event) => setPersonAndTime(personKey, timeKey, event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            <option value="">
              {authorizedPeopleLoading ? 'Loading authorized people…' : 'Select authorized person'}
            </option>
            {currentPerson && !authorizedPeople?.some((person) => person.displayValue === currentPerson) && (
              <option value={currentPerson}>{currentPerson}</option>
            )}
            {authorizedPeople?.map((person) => (
              <option key={person.id} value={person.displayValue}>{person.displayValue}</option>
            ))}
          </select>
          {authorizedPeopleError && (
            <span className="block text-xs text-red-600">
              Could not load Authorized People: {authorizedPeopleError.message}
            </span>
          )}
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">{heading} time</span>
          <Input
            type="time"
            value={currentTime}
            onChange={(event) => setField(timeKey, event.target.value)}
          />
          <span className="block text-xs text-slate-500">
            Date: {formDate ? formatDisplayDate(formDate) : 'Choose a date'}
          </span>
          {!currentTime && (
            <span className="block text-xs text-slate-500">
              Current time: {liveTime} (auto-filled when a person is selected)
            </span>
          )}
        </label>
        {personKey === 'jobPerformer1' && currentPerson && (
          <>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Extended Hours</span>
              <select
                value={formData.extendedHours ?? ''}
                onChange={(event) => setField('extendedHours', event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                <option value="">No extended hours</option>
                {[1, 2, 3, 4].map((hours) => (
                  <option key={hours} value={String(hours)}>{hours} hour{hours > 1 ? 's' : ''}</option>
                ))}
              </select>
            </label>
            <p className="text-xs text-slate-500">
              Day shift is 06:00–17:59
              {extraHours ? `; with ${extraHours} extra hour${extraHours > 1 ? 's' : ''}, it ends at ${extendedEnd}` : ''}.
            </p>
          </>
        )}
      </div>
    );
  }

  function changeSubContractor(value: string) {
    setSelectedSubContractor(value);
    setSelectedPermitNumber('');
    setPermitSearch('');
    setFormData((current) => ({
      ...current,
      subContractor: value,
      plantDivision: '',
      mainContractor: '',
      department: '',
      discipline: '',
      ptwTitle: '',
      workLocation: '',
      equipmentTagNo: '',
      ptwType: '',
      ptwNumber: '',
      certificateTypes: '',
      plannedStartDate: formDate,
      plannedEndDate: addDaysToYmd(formDate, MAX_PTW_VALIDITY_DAYS - 1),
    }));
  }

  function changePermit(value: string) {
    setSelectedPermitNumber(value);
    const option = permitOptions?.find((item) => item.permitNumber === value);
    if (!option) {
      setField('ptwNumber', value);
      return;
    }
    setFormData((current) => ({
      ...current,
      ...option.data,
      subContractor: selectedSubContractor,
      ptwNumber: option.permitNumber,
    }));
  }

  const planDuration = formData.plannedStartDate && formData.plannedEndDate
    ? getPlanDurationDays(formData.plannedStartDate, formData.plannedEndDate)
    : null;

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !selectedSubContractor ||
      (!selectedPermitNumber && !(editing && !editing.ptwNumber))
    ) {
      setFormErrors(['Select a sub contractor and permit number before saving']);
      return;
    }
    const workStartTime = formData.jobPerformer1Time || formData.jobPerformer2Time || '';
    const extendedHours = formData.jobPerformer1Time
      ? getExtendedHoursValue(formData.extendedHours)
      : 0;
    const startMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(workStartTime);
    const workEndTime = startMatch
      ? (() => {
          const endMinutes =
            (Number(startMatch[1]) * 60 + Number(startMatch[2]) + (12 + extendedHours) * 60) %
            (24 * 60);
          return `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
        })()
      : '';
    const parsed = dailyRegisterInputSchema.safeParse({
      ...formData,
      shiftDayNight: getDailyRegisterShift(workStartTime) ?? '',
      shiftValidity: '',
      workStartTime,
      workEndTime,
      extendedHours: formData.jobPerformer1 ? formData.extendedHours ?? '' : '',
      ptwStatus: formData.jobPerformer1Time || formData.jobPerformer2Time
        ? 'Live'
        : 'Suspended',
    });
    if (!parsed.success) {
      setFormErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }
    setSaving(true);
    try {
      await apiFetch<DailyRegisterDTO>(
        editing ? `/api/daily-register/${editing.id}` : '/api/daily-register',
        {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify(
            editing
              ? {
                  date: formDate,
                  data: {
                    ...parsed.data,
                    subContractor: selectedSubContractor,
                    ...(selectedPermitNumber ? { ptwNumber: selectedPermitNumber } : {}),
                  },
                }
              : {
                  date: formDate,
                  data: {
                    ...parsed.data,
                    subContractor: selectedSubContractor,
                    ptwNumber: selectedPermitNumber,
                  },
                },
          ),
        },
      );
      toast.success(editing ? 'Daily register entry updated' : 'Daily register entry added');
      setFormOpen(false);
      changeDate(formDate);
      await globalMutate(`/api/daily-register${toQueryString({ date: formDate })}`);
      await Promise.all([
        globalMutate((key) => typeof key === 'string' && key.startsWith('/api/daily-register/history')),
        globalMutate((key) => typeof key === 'string' && key.startsWith('/api/daily-register/dashboard')),
        globalMutate((key) => typeof key === 'string' && key.startsWith('/api/daily-register/dates')),
        globalMutate((key) => typeof key === 'string' && key.startsWith('/api/daily-register/summary')),
      ]);
      await globalMutate((key) => typeof key === 'string' && key.startsWith('/api/files'));
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not save entry');
    } finally {
      setSaving(false);
    }
  }

  async function uploadRegister() {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('date', date);
      body.append('file', selectedFile);
      const result = await apiFetch<NonNullable<typeof importResult>>(
        '/api/daily-register/import',
        { method: 'POST', body },
      );
      setImportResult(result);
      await mutate();
      await Promise.all([
        globalMutate((key) => typeof key === 'string' && key.startsWith('/api/daily-register/history')),
        globalMutate((key) => typeof key === 'string' && key.startsWith('/api/daily-register/dashboard')),
        globalMutate((key) => typeof key === 'string' && key.startsWith('/api/daily-register/dates')),
        globalMutate((key) => typeof key === 'string' && key.startsWith('/api/daily-register/summary')),
      ]);
      await globalMutate((key) => typeof key === 'string' && key.startsWith('/api/files'));
      toast.success(`Import complete: ${result.stats.inserted} added, ${result.stats.failed} skipped`);
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : 'Import failed');
    } finally {
      setUploading(false);
    }
  }

  function openExport() {
    setExportDateFrom(date);
    setExportDateTo(date);
    setExportShifts(['day', 'night']);
    setSelectedContractors([]);
    setLoadedContractorQuery('');
    setExportOpen(true);
  }

  function toggleExportShift(shift: 'day' | 'night') {
    setExportShifts((current) =>
      current.includes(shift) ? current.filter((value) => value !== shift) : [...current, shift],
    );
  }

  async function exportRegister() {
    if (
      !contractorOptions ||
      !exportShifts.length ||
      (!selectedContractors.length && contractorOptions.length > 0)
    ) return;
    setExporting(true);
    try {
      const params = new URLSearchParams({
        dateFrom: exportDateFrom,
        dateTo: exportDateTo,
      });
      exportShifts.forEach((shift) => params.append('shift', shift));
      const allContractorsSelected = selectedContractors.length === contractorOptions.length;
      if (!allContractorsSelected) {
        selectedContractors.forEach((contractor) => params.append('subContractor', contractor));
      }
      const name = await downloadFromApi(
        `/api/daily-register/export?${params.toString()}`,
        `Daily-PTW-Register-${exportDateFrom}-${exportDateTo}.xlsx`,
      );
      toast.success(`Exported ${name}`);
      await globalMutate((key) => typeof key === 'string' && key.startsWith('/api/files'));
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiFetch(`/api/daily-register/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      toast.success('Daily register entry deleted');
      await mutate();
      await Promise.all([
        globalMutate((key) => typeof key === 'string' && key.startsWith('/api/daily-register/history')),
        globalMutate((key) => typeof key === 'string' && key.startsWith('/api/daily-register/dashboard')),
        globalMutate((key) => typeof key === 'string' && key.startsWith('/api/daily-register/dates')),
        globalMutate((key) => typeof key === 'string' && key.startsWith('/api/daily-register/summary')),
      ]);
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
        title="Daily PTW Register"
        description="Track daily permit counts and work details by shift. Each date has its own register; import, export, or add permit entries."
        actions={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Import
            </Button>
            <Button variant="secondary" onClick={openExport}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add permit entry
            </Button>
          </>
        }
      />

      <Modal
        open={exportOpen}
        title="Export daily PTW register"
        description="Choose a single day or date range, shifts, and subcontractors for the Excel workbook."
        onClose={() => !exporting && setExportOpen(false)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setExportOpen(false)} disabled={exporting}>
              Cancel
            </Button>
            <Button
              onClick={exportRegister}
              loading={exporting}
              disabled={
                !contractorOptions ||
                !exportShifts.length ||
                (!selectedContractors.length && (contractorOptions?.length ?? 0) > 0) ||
                exportDateFrom > exportDateTo
              }
            >
              <Download className="h-4 w-4" /> Download Excel
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">From date</span>
              <Input
                type="date"
                value={exportDateFrom}
                onChange={(event) => setExportDateFrom(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">To date</span>
              <Input
                type="date"
                value={exportDateTo}
                min={exportDateFrom}
                onChange={(event) => setExportDateTo(event.target.value)}
              />
            </label>
          </div>
          {exportDateFrom > exportDateTo && (
            <p className="text-sm text-red-600">End date cannot be before start date.</p>
          )}

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">Shifts</legend>
            <div className="flex flex-wrap gap-4">
              {(['day', 'night'] as const).map((shift) => (
                <label key={shift} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={exportShifts.includes(shift)}
                    onChange={() => toggleExportShift(shift)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  {shift === 'day' ? 'Day shift' : 'Night shift'}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <legend className="text-sm font-medium text-slate-700">Subcontractors</legend>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedContractors(contractorOptions ?? [])}
                  disabled={!contractorOptions?.length}
                >
                  Select all
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedContractors([])}
                  disabled={!contractorOptions?.length}
                >
                  Deselect all
                </Button>
              </div>
            </div>
            {contractorOptionsLoading ? (
              <p className="text-sm text-slate-500">Loading subcontractors…</p>
            ) : contractorOptionsError ? (
              <p className="text-sm text-red-600">Could not load subcontractors: {contractorOptionsError.message}</p>
            ) : contractorOptions?.length ? (
              <div className="grid max-h-52 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
                {contractorOptions.map((contractor) => (
                  <label key={contractor} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedContractors.includes(contractor)}
                      onChange={() => setSelectedContractors((current) =>
                        current.includes(contractor)
                          ? current.filter((value) => value !== contractor)
                          : [...current, contractor],
                      )}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="truncate">{contractor}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-slate-200 p-3 text-sm text-slate-500">
                No subcontractor entries in this date range. Export will include all matching entries.
              </p>
            )}
          </fieldset>
        </div>
      </Modal>

      <section className="mb-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Selected date — {date ? formatDisplayDate(date) : ''}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total permits</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{dailySummary.permitCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Day shift</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{dailySummary.dayPermits}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Night shift</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{dailySummary.nightPermits}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Live</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{dailySummary.livePermits}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Suspended</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{dailySummary.suspendedPermits}</p>
        </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Register date</span>
            <Input type="date" value={date} onChange={(event) => changeDate(event.target.value)} />
          </label>
          <div className="flex flex-col gap-3 sm:items-end">
            {dateNavigationError ? (
              <p role="alert" className="text-sm text-red-600">
                Could not load register date navigation: {dateNavigationError.message}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                aria-label="Previous page with newer date"
                disabled={dateNavigationLoading || !dateNavigation?.nextDate}
                onClick={() => dateNavigation?.nextDate && changeDate(dateNavigation.nextDate)}
              >
                <ChevronLeft className="h-4 w-4" /> Previous page
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label="Next page with older date"
                disabled={dateNavigationLoading || !dateNavigation?.previousDate}
                onClick={() => dateNavigation?.previousDate && changeDate(dateNavigation.previousDate)}
              >
                Next page <ChevronRight className="h-4 w-4" />
              </Button>
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <CalendarDays className="h-4 w-4" />
                {date ? formatDisplayDate(date) : 'Choose a date'}
                {assignedSubContractor ? ` · ${assignedSubContractor}` : isAdmin ? ' · All contractors' : ''}
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Search PTW number</span>
            <Input
              type="search"
              placeholder="Search PTW number"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Sub Contractor</span>
            <Select
              value={filterSubContractor}
              onChange={(event) => setFilterSubContractor(event.target.value)}
              options={contractorFilterOptions}
              placeholder="All sub contractors"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Shift</span>
            <Select
              value={filterShift}
              onChange={(event) => setFilterShift(event.target.value)}
              options={DAILY_SHIFTS}
              placeholder="Day and night"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">PTW Status</span>
            <Select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              options={DAILY_PTW_STATUSES}
              placeholder="All statuses"
            />
          </label>
        </div>
        {error ? (
          <EmptyState title="Could not load daily register">{error.message}</EmptyState>
        ) : isLoading && !data ? (
          <EmptyState title="Loading daily register…" />
        ) : filteredEntries.length ? (
          <>
            <div className="overflow-auto">
              <table className="min-w-max border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="border border-slate-300 px-3 py-2">Sr No</th>
                    {DAILY_REGISTER_TABLE_FIELDS.map((field) => (
                      <th key={field.key} className="border border-slate-300 px-3 py-2">
                        {field.header}
                      </th>
                    ))}
                    <th className="sticky right-0 z-20 border border-slate-300 bg-slate-50 px-3 py-2">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-3 py-2 font-medium">{entry.srNo}</td>
                      {DAILY_REGISTER_TABLE_FIELDS.map((field) => {
                        const value = entry[field.key as keyof DailyRegisterDTO];
                        const display =
                          field.type === 'computed'
                            ? field.key === 'ptwValidity'
                              ? formatPlanValidity(entry.plannedStartDate, entry.plannedEndDate)
                              : getDailyRegisterWorkHours(
                                  entry.workStartTime,
                                  entry.workEndTime,
                                  entry.extendedHours,
                                )?.toFixed(2) ?? ''
                            : field.type === 'date' && typeof value === 'string'
                              ? formatDisplayDate(value)
                              : typeof value === 'string'
                                ? value
                                : '';
                        return (
                          <td key={field.key} className="max-w-sm border border-slate-300 px-3 py-2">
                            {display || <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-10 whitespace-nowrap border border-slate-300 bg-white px-2 py-1 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(entry)} aria-label={`Edit entry ${entry.srNo}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleting(entry)} aria-label={`Delete entry ${entry.srNo}`}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
              {filteredEntries.length} of {data?.length ?? 0} entries in the {formatDisplayDate(date)} register.
            </p>
          </>
        ) : (
          <EmptyState title={data?.length ? 'No entries match these filters' : 'No entries for this date'}>
            {data?.length
              ? 'Adjust your search or filters to see register entries.'
              : `Add an entry or import the workbook for ${date ? formatDisplayDate(date) : 'this date'}.`}
          </EmptyState>
        )}
      </section>

      <Modal
        open={formOpen}
        title={editing ? `Edit daily entry · Sr No ${editing.srNo}` : 'Add daily permit entry'}
        description={`Register date: ${formDate ? formatDisplayDate(formDate) : ''}. Planned dates must include the selected register date.`}
        onClose={() => !saving && setFormOpen(false)}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" form="daily-register-form" loading={saving}>
              {editing ? 'Save entry' : 'Add entry'}
            </Button>
          </>
        }
      >
        <form id="daily-register-form" onSubmit={saveEntry} noValidate>
          {formErrors.length > 0 && (
            <ul className="mb-4 list-inside list-disc rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formErrors.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
            </ul>
          )}
          <div className="mb-5 grid gap-4 rounded-lg border border-brand-100 bg-brand-50/50 p-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Sub Contractor *</span>
              <select
                value={selectedSubContractor}
                onChange={(event) => changeSubContractor(event.target.value)}
                disabled={!!assignedSubContractor}
                required
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100"
              >
                <option value="">Select sub contractor</option>
                {selectedSubContractor && !permitContractors?.includes(selectedSubContractor) && (
                  <option key={selectedSubContractor} value={selectedSubContractor}>
                    {selectedSubContractor}
                  </option>
                )}
                {permitContractors?.map((contractor) => (
                  <option key={contractor} value={contractor}>{contractor}</option>
                ))}
              </select>
              {permitContractorsLoading && (
                <span className="block text-xs text-slate-500">Loading contractors with permits…</span>
              )}
              {permitContractorsError && (
                <span className="block text-xs text-red-600">
                  Could not load contractors: {permitContractorsError.message}
                </span>
              )}
              {!permitContractorsLoading && !permitContractorsError && !permitContractors?.length && (
                <span className="block text-xs text-slate-500">
                  No contractors have active permits for {formatDisplayDate(formDate)}.
                </span>
              )}
            </label>
            <div className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Permit Number *</span>
              <Input
                type="search"
                placeholder="Search active permit number"
                value={permitSearch}
                onChange={(event) => {
                  setPermitSearch(event.target.value);
                  setSelectedPermitNumber('');
                }}
                disabled={!selectedSubContractor}
              />
              <select
                value={selectedPermitNumber}
                onChange={(event) => changePermit(event.target.value)}
                disabled={!selectedSubContractor || permitOptionsLoading}
                required
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100"
              >
                <option value="">
                  {!selectedSubContractor
                    ? 'Select sub contractor first'
                    : permitOptionsLoading
                      ? 'Loading permits…'
                      : 'Select an active permit'}
                </option>
                {selectedPermitNumber && !permitOptions?.some((item) => item.permitNumber === selectedPermitNumber) && (
                  <option value={selectedPermitNumber}>{selectedPermitNumber}</option>
                )}
                {permitOptions?.map((option) => (
                  <option key={option.permitNumber} value={option.permitNumber}>{option.permitNumber}</option>
                ))}
              </select>
              {permitOptionsError && (
                <span className="block text-xs text-red-600">
                  Could not load permits: {permitOptionsError.message}
                </span>
              )}
              {permitOptions?.length === 100 && (
                <span className="block text-xs text-slate-500">
                  Showing the first 100 matches. Refine your search to find other permits.
                </span>
              )}
              {!permitOptionsLoading && !permitOptionsError && selectedSubContractor && !permitOptions?.length && (
                <span className="block text-xs text-slate-500">
                  {debouncedPermitSearch
                    ? `No active permits match "${debouncedPermitSearch}" for this contractor on ${formatDisplayDate(formDate)}.`
                    : `No active permits for this contractor on ${formatDisplayDate(formDate)}.`}
                </span>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {DAILY_REGISTER_FIELDS.filter(
              (field) =>
                field.type !== 'computed' &&
                field.key !== 'subContractor' &&
                field.key !== 'ptwNumber' &&
                ![
                  'permitIssuerTime',
                  'jobPerformer1Time',
                  'jobPerformer2Time',
                  'shiftDayNight',
                  'shiftValidity',
                  'workStartTime',
                  'workEndTime',
                  'workHours',
                  'extendedHours',
                  'ptwStatus',
                ].includes(field.key),
            ).map((field) => {
              if (field.key === 'jobPerformer1') {
                return (
                  <div key={field.key} className="sm:border-r sm:border-slate-300 sm:pr-4">
                    {renderPerformerField('jobPerformer1', 'jobPerformer1Time', 'Job Performer-1 (Day Shift)')}
                  </div>
                );
              }
              if (field.key === 'jobPerformer2') {
                const shift = formData.jobPerformer1Time
                  ? 'Day'
                  : formData.jobPerformer2Time
                    ? 'Night'
                    : 'Not set';
                const status = formData.jobPerformer1Time || formData.jobPerformer2Time
                  ? 'Live'
                  : 'Suspended';
                return (
                  <div key={field.key} className="contents">
                    <div className="sm:pl-4">
                      {renderPerformerField('jobPerformer2', 'jobPerformer2Time', 'Job Performer-2 (Night Shift)')}
                    </div>
                    <p className="sm:col-span-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Shift: <span className="font-medium text-slate-800">{shift}</span>
                      {' · '}PTW Status: <span className="font-medium text-slate-800">{status}</span>
                    </p>
                  </div>
                );
              }
              if (field.key === 'permitIssuer') {
                const timeKey = 'permitIssuerTime';
                const currentPerson = formData[field.key] ?? '';
                const currentTime = formData[timeKey] ?? '';
                return (
                  <div key={field.key} className="space-y-4 sm:col-span-2">
                    <label className="block space-y-1 sm:max-w-xs">
                      <span className="text-sm font-medium text-slate-700">Register Date *</span>
                      <Input
                        type="date"
                        required
                        value={formDate}
                        onChange={(event) => {
                          const nextDate = event.target.value;
                          setFormDate(nextDate);
                          setFormData((current) => ({
                            ...current,
                            ...(current.plannedStartDate === formDate
                              ? { plannedStartDate: nextDate }
                              : {}),
                            ...(current.plannedEndDate === addDaysToYmd(formDate, MAX_PTW_VALIDITY_DAYS - 1)
                              ? { plannedEndDate: addDaysToYmd(nextDate, MAX_PTW_VALIDITY_DAYS - 1) }
                              : {}),
                          }));
                        }}
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-sm font-medium text-slate-700">{field.header}</span>
                        <select
                          value={currentPerson}
                          onChange={(event) =>
                            setPersonAndTime(field.key, timeKey, event.target.value)
                          }
                          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                        >
                          <option value="">
                            {authorizedPeopleLoading ? 'Loading authorized people…' : 'Select authorized person'}
                          </option>
                          {currentPerson && !authorizedPeople?.some((person) => person.displayValue === currentPerson) && (
                            <option value={currentPerson}>{currentPerson}</option>
                          )}
                          {authorizedPeople?.map((person) => (
                            <option key={person.id} value={person.displayValue}>
                              {person.displayValue}
                            </option>
                          ))}
                        </select>
                        {authorizedPeopleError && (
                          <span className="block text-xs text-red-600">
                            Could not load Authorized People: {authorizedPeopleError.message}
                          </span>
                        )}
                      </label>
                      <label className="block space-y-1">
                        <span className="text-sm font-medium text-slate-700">
                          {field.header} time
                        </span>
                        <Input
                          type="time"
                          value={currentTime}
                          onChange={(event) => setField(timeKey, event.target.value)}
                        />
                        <span className="block text-xs text-slate-500">Date: {formatDisplayDate(formDate)}</span>
                        {!currentTime && (
                          <span className="block text-xs text-slate-500">
                            Current time: {liveTime} (auto-filled when a person is selected)
                          </span>
                        )}
                      </label>
                    </div>
                  </div>
                );
              }
              const isPermitDetail = [
                'plantDivision',
                'mainContractor',
                'department',
                'discipline',
                'ptwTitle',
                'workLocation',
                'equipmentTagNo',
                'ptwType',
                'certificateTypes',
                'plannedStartDate',
                'plannedEndDate',
              ].includes(field.key);
              return (
                <div key={field.key} className="contents">
                  <label
                    className={`block space-y-1 ${field.key === 'certificateTypes' ? 'sm:col-span-2' : ''}`}
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {(field.key === 'remarks' ? 'Shift Remark' : field.header).replace(/\s+/g, ' ')}
                      {('required' in field && field.required) ? ' *' : ''}
                    </span>
                    {field.type === 'radio' ? (
                      <div className="flex min-h-10 flex-wrap items-center gap-x-5 gap-y-2">
                        {field.options?.map((option) => (
                          <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="radio"
                              name={`daily-register-${field.key}`}
                              value={option}
                              checked={formData[field.key] === option}
                              onChange={(event) => setField(field.key, event.target.value)}
                              className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <Input
                        type={
                          field.type === 'date'
                            ? 'date'
                            : field.type === 'time'
                              ? 'time'
                              : 'text'
                        }
                        required={'required' in field ? field.required : undefined}
                        maxLength={'maxLength' in field ? field.maxLength : undefined}
                        max={field.key === 'plannedEndDate' && formData.plannedStartDate
                          ? addDaysToYmd(formData.plannedStartDate, MAX_PTW_VALIDITY_DAYS - 1)
                          : undefined}
                        value={formData[field.key] ?? ''}
                        onChange={(event) => setField(field.key, event.target.value)}
                        disabled={
                          isPermitDetail &&
                          !!permitOptions?.some((option) => option.permitNumber === selectedPermitNumber)
                        }
                      />
                    )}
                  </label>
                  {field.key === 'plannedEndDate' && (
                    <div className="sm:col-span-2 border-t border-slate-200" />
                  )}
                </div>
              );
            })}
          </div>
          {planDuration !== null && (
            <p className={`mt-4 text-sm ${planDuration > MAX_PTW_VALIDITY_DAYS ? 'text-red-700' : 'text-slate-600'}`}>
              {planDuration > MAX_PTW_VALIDITY_DAYS
                ? `PTW validity cannot exceed ${MAX_PTW_VALIDITY_DAYS} days`
                : `${planDuration} ${planDuration === 1 ? 'day' : 'days'} validity`}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={importOpen}
        title={`Import daily register · ${date ? formatDisplayDate(date) : ''}`}
        description="Rows are appended to this date's register. Existing or duplicate PTW Numbers are skipped; entries for other dates are not changed."
        onClose={() => {
          if (uploading) return;
          setImportOpen(false);
          setImportResult(null);
          setSelectedFile(null);
        }}
        footer={
          importResult ? (
            <Button onClick={() => {
              setImportOpen(false);
              setImportResult(null);
              setSelectedFile(null);
            }}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setImportOpen(false)} disabled={uploading}>Cancel</Button>
              <Button onClick={uploadRegister} loading={uploading} disabled={!selectedFile}>Import rows</Button>
            </>
          )
        }
      >
        {!importResult ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Upload the supplied PTW workbook. It must include the template’s PTW Register columns; the selected date is used for this separate register.
            </p>
            <input
              type="file"
              accept=".xlsx,.xlsm"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-medium file:text-brand-700"
            />
            {selectedFile && <p className="text-sm text-slate-600">Selected: {selectedFile.name}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              {importResult.stats.inserted} added · {importResult.stats.failed} skipped · {importResult.stats.total} rows read
            </p>
            {importResult.errors.length > 0 && (
              <div className="max-h-64 overflow-auto rounded-lg border border-red-200">
                <table className="w-full text-xs">
                  <thead className="bg-red-50 text-left text-red-700">
                    <tr><th className="px-3 py-2">Excel row</th><th className="px-3 py-2">Problem</th></tr>
                  </thead>
                  <tbody>
                    {importResult.errors.map((row, index) => (
                      <tr key={`${row.row}-${index}`} className="border-t border-red-100">
                        <td className="px-3 py-2">{row.row}</td>
                        <td className="px-3 py-2">{row.messages.join(' · ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete daily register entry"
        loading={deleteBusy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      >
        Permanently delete Sr No <b>{deleting?.srNo}</b> from the {formatDisplayDate(date)} register?
      </ConfirmDialog>
    </>
  );
}
