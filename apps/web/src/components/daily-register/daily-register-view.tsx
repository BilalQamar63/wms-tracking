'use client';

import { useMemo, useState, type FormEvent } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { CalendarDays, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import {
  DAILY_REGISTER_FIELDS,
  MAX_PTW_VALIDITY_DAYS,
  addDaysToYmd,
  dailyRegisterInputSchema,
  formatDisplayDate,
  getPlanDurationDays,
  formatPlanValidity,
  getTodayYmd,
  type DailyRegisterDTO,
  type DailyRegisterInput,
} from '@wms/shared';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { apiFetch, downloadFromApi, swrFetcher, toQueryString } from '@/lib/api-client';

const EMPTY_INPUT: DailyRegisterInput = {};

function entryInput(entry: DailyRegisterDTO | null, date: string): DailyRegisterInput {
  const result: Record<string, string> = {};
  for (const field of DAILY_REGISTER_FIELDS) {
    if (field.type === 'computed') continue;
    const value = entry?.[field.key as keyof DailyRegisterDTO];
    result[field.key] =
      typeof value === 'string'
        ? value
        : field.key === 'plannedStartDate'
          ? date
          : field.key === 'plannedEndDate'
            ? addDaysToYmd(date, MAX_PTW_VALIDITY_DAYS - 1)
            : '';
  }
  return result as DailyRegisterInput;
}

export function DailyRegisterView({
  isAdmin,
  assignedSubContractor,
  appTimeZone,
}: {
  isAdmin: boolean;
  assignedSubContractor?: string;
  appTimeZone: string;
}) {
  const toast = useToast();
  const [date, setDate] = useState(() => getTodayYmd(new Date(), appTimeZone));
  const [editing, setEditing] = useState<DailyRegisterDTO | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<DailyRegisterInput>(EMPTY_INPUT);
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
  const query = useMemo(() => toQueryString({ date }), [date]);
  const { data, error, isLoading, mutate } = useSWR<DailyRegisterDTO[]>(
    date ? `/api/daily-register${query}` : null,
    swrFetcher,
  );

  function openCreate() {
    setEditing(null);
    setFormData(entryInput(null, date));
    setFormErrors([]);
    setFormOpen(true);
  }

  function openEdit(entry: DailyRegisterDTO) {
    setEditing(entry);
    setFormData(entryInput(entry, date));
    setFormErrors([]);
    setFormOpen(true);
  }

  function setField(key: string, value: string) {
    setFormData((current) => ({ ...current, [key]: value }));
  }

  const planDuration = formData.plannedStartDate && formData.plannedEndDate
    ? getPlanDurationDays(formData.plannedStartDate, formData.plannedEndDate)
    : null;

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = dailyRegisterInputSchema.safeParse(formData);
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
            editing ? parsed.data : { date, data: parsed.data },
          ),
        },
      );
      toast.success(editing ? 'Daily register entry updated' : 'Daily register entry added');
      setFormOpen(false);
      await mutate();
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
      await globalMutate((key) => typeof key === 'string' && key.startsWith('/api/files'));
      toast.success(`Import complete: ${result.stats.inserted} added, ${result.stats.failed} skipped`);
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : 'Import failed');
    } finally {
      setUploading(false);
    }
  }

  async function exportRegister() {
    try {
      const name = await downloadFromApi(
        `/api/daily-register/export${toQueryString({ date })}`,
        `Daily-PTW-Register-${date}.xlsx`,
      );
      toast.success(`Exported ${name}`);
      await globalMutate((key) => typeof key === 'string' && key.startsWith('/api/files'));
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : 'Export failed');
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
        description="Each selected date has its own independent register. Import, export, or add entries using the columns from your PTW Register template."
        actions={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Import
            </Button>
            <Button variant="secondary" onClick={exportRegister}>
              <Download className="h-4 w-4" /> Export this date
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add permit entry
            </Button>
          </>
        }
      />

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Register date</span>
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays className="h-4 w-4" />
            {date ? formatDisplayDate(date) : 'Choose a date'}
            {assignedSubContractor ? ` · ${assignedSubContractor}` : isAdmin ? ' · All contractors' : ''}
          </p>
        </div>
        {error ? (
          <EmptyState title="Could not load daily register">{error.message}</EmptyState>
        ) : isLoading && !data ? (
          <EmptyState title="Loading daily register…" />
        ) : data?.length ? (
          <>
            <div className="overflow-auto">
              <table className="min-w-max border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="border border-slate-300 px-3 py-2">Sr No</th>
                    {DAILY_REGISTER_FIELDS.map((field) => (
                      <th key={field.key} className="border border-slate-300 px-3 py-2">
                        {field.header}
                      </th>
                    ))}
                    <th className="border border-slate-300 px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-3 py-2 font-medium">{entry.srNo}</td>
                      {DAILY_REGISTER_FIELDS.map((field) => {
                        const value = entry[field.key as keyof DailyRegisterDTO];
                        const display =
                          field.type === 'computed'
                            ? formatPlanValidity(entry.plannedStartDate, entry.plannedEndDate)
                            : field.type === 'date' && typeof value === 'string'
                              ? formatDisplayDate(value)
                              : typeof value === 'string'
                                ? value
                                : '';
                        return (
                          <td key={field.key} className="max-w-sm border border-slate-200 px-3 py-2">
                            {display || <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap border border-slate-200 px-2 py-1 text-right">
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
              {data.length} entries in the {formatDisplayDate(date)} register.
            </p>
          </>
        ) : (
          <EmptyState title="No entries for this date">
            Add an entry or import the workbook for {date ? formatDisplayDate(date) : 'this date'}.
          </EmptyState>
        )}
      </section>

      <Modal
        open={formOpen}
        title={editing ? `Edit daily entry · Sr No ${editing.srNo}` : 'Add daily permit entry'}
        description={`Register date: ${date ? formatDisplayDate(date) : ''}. Planned dates must include the selected register date.`}
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
          <div className="grid gap-4 sm:grid-cols-2">
            {DAILY_REGISTER_FIELDS.filter((field) => field.type !== 'computed').map((field) => (
              <label key={field.key} className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">
                  {field.header.replace(/\s+/g, ' ')}{('required' in field && field.required) ? ' *' : ''}
                </span>
                <Input
                  type={field.type === 'date' ? 'date' : 'text'}
                  required={'required' in field ? field.required : undefined}
                  maxLength={'maxLength' in field ? field.maxLength : undefined}
                  max={
                    field.key === 'plannedEndDate' && formData.plannedStartDate
                      ? addDaysToYmd(formData.plannedStartDate, MAX_PTW_VALIDITY_DAYS - 1)
                      : undefined
                  }
                  value={formData[field.key] ?? ''}
                  onChange={(event) => setField(field.key, event.target.value)}
                />
              </label>
            ))}
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
