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
import { ImportHistory } from './import-history';

const PAGE_SIZE = 20;

export function PermitsView({ canManage }: { canManage: boolean }) {
  const toast = useToast();
  const [filters, setFilters] = useState<PermitFilterState>(EMPTY_PERMIT_FILTERS);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'current' | 'snapshot' | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(filters.search);
  const effectiveFilters = { ...filters, search: debouncedSearch };

  const {
    data,
    isLoading,
    error,
    mutate: refresh,
  } = usePermits(effectiveFilters, page, PAGE_SIZE, selectedBatchId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PermitDTO | null>(null);
  const [deleting, setDeleting] = useState<PermitDTO | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<{ id: string; name: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingBatchId, setExportingBatchId] = useState<string | null>(null);

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
    mutate('/api/permits/batches');
  };

  async function refreshRegister() {
    await refresh();
    await mutate('/api/permits/batches');
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const name = await downloadFromApi(
        `/api/permits/export${toQueryString({ ...effectiveFilters, batchId: selectedBatchId })}`,
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

  async function exportBatch(batchId: string) {
    setExportingBatchId(batchId);
    try {
      const name = await downloadFromApi(
        `/api/permits/export${toQueryString({ batchId })}`,
        'PTW-Register.xlsx',
      );
      toast.success(`Exported ${name}`);
      refreshFileHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExportingBatchId(null);
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

  async function confirmDeleteBatch() {
    if (!deletingBatch) return;
    setDeleteBusy(true);
    try {
      await apiFetch(`/api/files/${deletingBatch.id}`, { method: 'DELETE' });
      toast.success(`Deleted import ${deletingBatch.name}`);
      if (selectedBatchId === deletingBatch.id) {
        setSelectedBatchId(null);
        setViewMode(null);
      }
      setDeletingBatch(null);
      refreshFileHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete the import');
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Meram Master PTW Tracking Register"
        description="Manage the current register or edit a dated imported register, then export its updated Excel file."
        actions={
          <>
            {canManage && (
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" /> Import
              </Button>
            )}
            {viewMode && (
              <Button variant="secondary" onClick={exportExcel} loading={exporting}>
                <Download className="h-4 w-4" /> {selectedBatchId ? 'Export snapshot' : 'Export'}
              </Button>
            )}
            {viewMode === 'current' && canManage && (
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

      <ImportHistory
        selectedBatchId={selectedBatchId}
        currentSelected={viewMode === 'current'}
        canManage={canManage}
        onAddPermit={(batchId) => {
          setViewMode('snapshot');
          setSelectedBatchId(batchId);
          setFilters(EMPTY_PERMIT_FILTERS);
          setPage(1);
          setEditing(null);
          setFormOpen(true);
        }}
        onExportBatch={exportBatch}
        onDeleteBatch={(id, name) => setDeletingBatch({ id, name })}
        exportingBatchId={exportingBatchId}
        onSelect={(id) => {
          setViewMode('snapshot');
          setSelectedBatchId(id);
          setFilters(EMPTY_PERMIT_FILTERS);
          setPage(1);
        }}
        onSelectCurrent={() => {
          setViewMode('current');
          setSelectedBatchId(null);
          setFilters(EMPTY_PERMIT_FILTERS);
          setPage(1);
        }}
      />

      {viewMode ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {selectedBatchId && canManage ? (
            <div className="border-b border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900">
              Viewing this imported workbook only. Changes and new permits stay in this snapshot.
              Use its <b>Export</b> action above to download the updated Excel file.
            </div>
          ) : selectedBatchId ? (
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Read-only view of this imported workbook.
            </div>
          ) : (
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Current register — separate from the dated imported workbooks above.
            </div>
          )}
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
      ) : (
        <EmptyState title="Choose a register">
          Select an imported workbook above to view its dated permits, or choose the current
          register. New permits can be added directly to the selected workbook.
        </EmptyState>
      )}

      {canManage && (
        <PermitFormDialog
          open={formOpen}
          permit={editing}
          importBatchId={selectedBatchId}
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
            setViewMode(null);
            setSelectedBatchId(null);
            refresh();
            refreshFileHistory();
          }}
        />
      )}
      {canManage && (
        <>
          <ConfirmDialog
            open={!!deleting}
            title="Delete permit"
            loading={deleteBusy}
            onConfirm={confirmDelete}
            onClose={() => setDeleting(null)}
          >
            Permanently delete Sr No <b>{deleting?.srNo}</b>
            {deleting?.newPtwNumber ? <> ({deleting.newPtwNumber})</> : null}?
            {selectedBatchId
              ? ' This removes it only from this imported snapshot.'
              : ' This cannot be undone.'}
          </ConfirmDialog>
          <ConfirmDialog
            open={!!deletingBatch}
            title="Delete imported workbook"
            confirmLabel="Delete import"
            loading={deleteBusy}
            onConfirm={confirmDeleteBatch}
            onClose={() => setDeletingBatch(null)}
          >
            Delete <b>{deletingBatch?.name}</b> and all permits saved in this imported snapshot?
            This cannot be undone.
          </ConfirmDialog>
        </>
      )}
    </>
  );
}
