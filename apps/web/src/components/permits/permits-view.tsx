'use client';

import { useEffect, useState } from 'react';
import { mutate } from 'swr';
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import { PERMIT_FIELD_LIST, PTW_TYPES, type PermitDTO, type PermitFieldKey } from '@wms/shared';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ExcelFieldPicker, ALL_FIELD_KEYS } from '@/components/ui/excel-field-picker';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { useToast } from '@/components/ui/toast';
import { EMPTY_PERMIT_FILTERS, usePermits, type PermitFilterState } from '@/hooks/use-permits';
import { useDebounce } from '@/hooks/use-debounce';
import { apiFetch, downloadFromApi, toQueryString } from '@/lib/api-client';
import { ImportDialog } from './import-dialog';
import { PermitFilters } from './permit-filters';
import { PermitFormDialog } from './permit-form-dialog';
import { PermitTable } from './permit-table';
import { RegisterSummary } from './register-summary';
import { PermitColumnPicker } from './permit-column-picker';
import { PermitColumnNavigator } from './permit-column-navigator';

const PAGE_SIZE = 20;
const ALL_TABLE_FIELDS = PERMIT_FIELD_LIST.filter((field) => field.inTable).map(
  (field) => field.key as PermitFieldKey,
);

export function PermitsView({
  canManage,
  canImport,
  assignedSubContractor,
  appTimeZone,
}: {
  canManage: boolean;
  canImport: boolean;
  assignedSubContractor?: string;
  appTimeZone: string;
}) {
  const toast = useToast();
  const [filters, setFilters] = useState<PermitFilterState>(EMPTY_PERMIT_FILTERS);
  const [page, setPage] = useState(1);
  const [visibleFields, setVisibleFields] = useState<PermitFieldKey[]>(ALL_TABLE_FIELDS);
  const [selectedTableField, setSelectedTableField] = useState<PermitFieldKey | null>(null);
  const [tableNavigationVersion, setTableNavigationVersion] = useState(0);
  const [selectedExportFields, setSelectedExportFields] =
    useState<PermitFieldKey[]>(ALL_FIELD_KEYS);
  const [selectedExportPtwTypes, setSelectedExportPtwTypes] = useState<string[]>([...PTW_TYPES]);
  const debouncedSearch = useDebounce(filters.search);
  const effectiveFilters = { ...filters, search: debouncedSearch };

  const { data, isLoading, error, mutate: refresh } = usePermits(effectiveFilters, page, PAGE_SIZE);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PermitDTO | null>(null);
  const [deleting, setDeleting] = useState<PermitDTO | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportOptionsOpen, setExportOptionsOpen] = useState(false);
  const [deleteRegisterOpen, setDeleteRegisterOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [deletingRegister, setDeletingRegister] = useState(false);

  // Any filter change goes back to page 1.
  useEffect(
    () => setPage(1),
    [
      debouncedSearch,
      filters.status,
      filters.department,
      filters.discipline,
      filters.plantDivision,
      filters.company,
      filters.subContractor,
      filters.ptwType,
      filters.fieldKey,
      filters.fieldValue,
      filters.dateFrom,
      filters.dateTo,
    ],
  );

  const refreshFileHistory = () => {
    mutate((key) => typeof key === 'string' && key.startsWith('/api/files'));
  };

  async function refreshRegister() {
    await Promise.all([refresh(), mutate('/api/permits/summary')]);
  }

  async function exportExcel(
    fieldKeys: readonly PermitFieldKey[] = selectedExportFields,
    ptwTypes: readonly string[] = selectedExportPtwTypes,
  ) {
    setExporting(true);
    try {
      const name = await downloadFromApi(
        `/api/permits/export${toQueryString({
          ...effectiveFilters,
          ptwType: '',
          fields: fieldKeys.join(','),
          exportPtwTypes: ptwTypes.join(','),
        })}`,
        'PTW-Register.xlsx',
      );
      toast.success(`Exported ${name}`);
      setExportOptionsOpen(false);
      refreshFileHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function deleteCurrentRegister() {
    setDeletingRegister(true);
    try {
      const result = await apiFetch<{ deletedCount: number }>('/api/permits/current', {
        method: 'DELETE',
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      toast.success(`${result.deletedCount} permits deleted from the current register`);
      setAdminEmail('');
      setAdminPassword('');
      setDeleteRegisterOpen(false);
      setFilters(EMPTY_PERMIT_FILTERS);
      setPage(1);
      await mutate((key) => typeof key === 'string' && key.startsWith('/api/permits'));
      refreshFileHistory();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Could not delete register');
    } finally {
      setDeletingRegister(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiFetch(`/api/permits/${deleting.id}`, { method: 'DELETE' });
      toast.success('Permit deleted');
      setDeleting(null);
      await refreshRegister();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete the permit');
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="MERAM MASTER PTW TRACKING REGISTER"
        description="Manage the current PTW tracking register. Excel imports are reviewed and merged into this register."
        actions={
          <>
            {canImport && (
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" /> Import
              </Button>
            )}
            {canManage && (
              <Button variant="secondary" onClick={() => setExportOptionsOpen(true)}>
                <Download className="h-4 w-4" /> Export
              </Button>
            )}
            {(canManage || canImport) && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add to current register
              </Button>
            )}
          </>
        }
      />

      <RegisterSummary canManage={canManage} onDelete={() => setDeleteRegisterOpen(true)} />

      <Modal
        open={exportOptionsOpen}
        title="Export PTW register"
        description="Choose which fields and PTW types to include in the Excel file."
        onClose={() => {
          if (!exporting) setExportOptionsOpen(false);
        }}
        size="xl"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={exporting}
              onClick={() => setExportOptionsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              loading={exporting}
              disabled={exporting}
              onClick={() => exportExcel(ALL_FIELD_KEYS, [...PTW_TYPES])}
            >
              Download full Excel
            </Button>
            <Button
              loading={exporting}
              disabled={selectedExportFields.length === 0 || selectedExportPtwTypes.length === 0}
              onClick={() => exportExcel()}
            >
              Download selected
            </Button>
          </>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">Excel fields</h3>
            <ExcelFieldPicker
              selectedFields={selectedExportFields}
              onChange={setSelectedExportFields}
              expanded
            />
          </div>
          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold text-slate-800">PTW types</legend>
            <div className="mb-3 flex justify-between gap-2">
              <button
                type="button"
                className="text-xs font-medium text-brand-700 hover:text-brand-900"
                onClick={() => setSelectedExportPtwTypes([...PTW_TYPES])}
              >
                Select all
              </button>
              <button
                type="button"
                className="text-xs font-medium text-brand-700 hover:text-brand-900"
                onClick={() => setSelectedExportPtwTypes([])}
              >
                Clear
              </button>
            </div>
            <div className="space-y-3">
              {PTW_TYPES.map((ptwType) => (
                <label key={ptwType} className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedExportPtwTypes.includes(ptwType)}
                    onChange={() =>
                      setSelectedExportPtwTypes((current) =>
                        current.includes(ptwType)
                          ? current.filter((value) => value !== ptwType)
                          : [...current, ptwType],
                      )
                    }
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                  />
                  <span>{ptwType}</span>
                </label>
              ))}
            </div>
            {selectedExportPtwTypes.length === 0 && (
              <p className="mt-3 text-xs text-amber-700">Select at least one PTW type.</p>
            )}
          </fieldset>
        </div>
      </Modal>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Current register — new Excel imports are applied here after review.
        </div>
        <PermitFilters value={filters} onChange={setFilters} />
        <PermitColumnPicker selectedFields={visibleFields} onChange={setVisibleFields} />
        <PermitColumnNavigator
          selectedField={selectedTableField}
          visibleFields={visibleFields}
          onChange={(field) => {
            setSelectedTableField(field);
            setTableNavigationVersion((version) => version + 1);
          }}
        />

        {error ? (
          <EmptyState title="Could not load permits">{error.message}</EmptyState>
        ) : isLoading && !data ? (
          <EmptyState title="Loading…" />
        ) : data && data.items.length > 0 ? (
          <>
            <PermitTable
              permits={data.items}
              canManage={canManage}
              onEdit={(permit) => {
                setEditing(permit);
                setFormOpen(true);
              }}
              onDelete={setDeleting}
              visibleFields={visibleFields}
              selectedField={selectedTableField}
              navigationVersion={tableNavigationVersion}
              appTimeZone={appTimeZone}
            />
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              limit={data.limit}
              onChange={setPage}
            />
          </>
        ) : (
          <EmptyState title="No permits found">
            Add a permit or import an Excel file to get started.
          </EmptyState>
        )}
      </section>

      {canManage && (
        <Modal
          open={deleteRegisterOpen}
          title="Delete current register"
          description="Confirm with an administrator account to permanently delete the current register."
          onClose={() => {
            if (deletingRegister) return;
            setDeleteRegisterOpen(false);
            setAdminEmail('');
            setAdminPassword('');
          }}
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                disabled={deletingRegister}
                onClick={() => {
                  setDeleteRegisterOpen(false);
                  setAdminEmail('');
                  setAdminPassword('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={deletingRegister}
                disabled={!adminEmail || !adminPassword}
                onClick={deleteCurrentRegister}
              >
                Delete register
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              This permanently deletes all current-register permits. Imported snapshots and upload
              history will not be deleted.
            </p>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Administrator email</span>
              <Input
                type="email"
                autoComplete="username"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Administrator password</span>
              <Input
                type="password"
                autoComplete="current-password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
              />
            </label>
          </div>
        </Modal>
      )}
      {(canManage || canImport) && (
        <PermitFormDialog
          open={formOpen}
          permit={editing}
          assignedSubContractor={canManage ? undefined : assignedSubContractor}
          onClose={() => setFormOpen(false)}
          onSaved={async () => {
            await refreshRegister();
          }}
        />
      )}
      {canImport && (
        <ImportDialog
          open={importOpen}
          canUpdate={canManage}
          assignedSubContractor={assignedSubContractor}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setFilters(EMPTY_PERMIT_FILTERS);
            setPage(1);
            mutate((key) => typeof key === 'string' && key.startsWith('/api/permits'));
            mutate('/api/permits/summary');
            if (canManage) refreshFileHistory();
          }}
        />
      )}
      {canManage && (
        <ConfirmDialog
          open={!!deleting}
          title="Delete permit"
          loading={deleteBusy}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        >
          Permanently delete Sr No <b>{deleting?.srNo}</b>
          {deleting?.newPtwNumber ? <> ({deleting.newPtwNumber})</> : null}? This cannot be undone.
        </ConfirmDialog>
      )}
    </>
  );
}
