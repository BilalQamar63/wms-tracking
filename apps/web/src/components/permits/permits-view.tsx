'use client';

import { useEffect, useState } from 'react';
import { mutate } from 'swr';
import { Download, Plus, Upload } from 'lucide-react';
import type { PermitDTO } from '@wms/shared';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
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

const PAGE_SIZE = 20;

export function PermitsView({ canManage }: { canManage: boolean }) {
  const toast = useToast();
  const [filters, setFilters] = useState<PermitFilterState>(EMPTY_PERMIT_FILTERS);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(filters.search);
  const effectiveFilters = { ...filters, search: debouncedSearch };

  const { data, isLoading, error, mutate: refresh } = usePermits(effectiveFilters, page, PAGE_SIZE);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PermitDTO | null>(null);
  const [deleting, setDeleting] = useState<PermitDTO | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Any filter change goes back to page 1.
  useEffect(
    () => setPage(1),
    [
      debouncedSearch,
      filters.status,
      filters.department,
      filters.discipline,
      filters.plantDivision,
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

  async function exportExcel() {
    setExporting(true);
    try {
      const name = await downloadFromApi(
        `/api/permits/export${toQueryString(effectiveFilters)}`,
        'PTW-Register.xlsx',
      );
      toast.success(`Exported ${name}`);
      refreshFileHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
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
        title="Permits"
        description="Manage the current PTW tracking register. Excel imports are reviewed and merged into this register."
        actions={
          <>
            {canManage && (
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" /> Import
              </Button>
            )}
            <Button variant="secondary" onClick={exportExcel} loading={exporting}>
              <Download className="h-4 w-4" /> Export
            </Button>
            {canManage && (
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

      <RegisterSummary />

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Current register — new Excel imports are applied here after review.
        </div>
        <PermitFilters value={filters} onChange={setFilters} />

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
        <PermitFormDialog
          open={formOpen}
          permit={editing}
          onClose={() => setFormOpen(false)}
          onSaved={async () => {
            await refreshRegister();
          }}
        />
      )}
      {canManage && (
        <ImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setFilters(EMPTY_PERMIT_FILTERS);
            setPage(1);
            mutate((key) => typeof key === 'string' && key.startsWith('/api/permits'));
            mutate('/api/permits/summary');
            refreshFileHistory();
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
