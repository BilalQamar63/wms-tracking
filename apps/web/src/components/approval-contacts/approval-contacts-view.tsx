'use client';

import { useEffect, useRef, useState } from 'react';
import { mutate } from 'swr';
import { Download, FileUp, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  AUTHORIZATION_LIST_DROPDOWN_FIELDS,
  AUTHORIZATION_STATUS_OPTIONS,
  type ApprovalContactImportPreview,
  type ApprovalContactImportResult,
  type ApprovalContactInput,
  type ApprovalContactDTO,
} from '@wms/shared';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useApprovalContacts, type ApprovalContactFilters } from '@/hooks/use-approval-contacts';
import { useDebounce } from '@/hooks/use-debounce';
import { apiFetch, downloadFromApi } from '@/lib/api-client';
import { useDropdownValues } from '@/hooks/use-dropdown-values';

const EMPTY_CONTACT: ApprovalContactInput = {
  srNo: '',
  approvalFormNo: '',
  company: '',
  name: '',
  emiratesId: '',
  phone: '',
  position: '',
  wmsRole: '',
  instituteName: '',
  jvAssessmentDate: '',
  wmsValidity: '',
  status: 'Active',
  remarks: '',
};
const PAGE_SIZE = 20;
const EMPTY_FILTERS: ApprovalContactFilters = { search: '', position: '', wmsRole: '' };

const CONTACT_FORM_FIELDS: Array<{
  key: keyof ApprovalContactInput;
  label: string;
  required?: boolean;
}> = [
  { key: 'srNo', label: 'Sr #' },
  { key: 'approvalFormNo', label: 'Approval Form No' },
  { key: 'company', label: 'Company' },
  { key: 'name', label: 'Full Name' },
  { key: 'emiratesId', label: 'Emirates ID/JVUID No' },
  { key: 'phone', label: 'Mobile Number' },
  { key: 'position', label: 'Position' },
  { key: 'wmsRole', label: 'WMS Role' },
  { key: 'instituteName', label: 'Institute Name' },
  { key: 'jvAssessmentDate', label: 'JV Assessment Date' },
  { key: 'wmsValidity', label: 'WMS Validity' },
  { key: 'status', label: 'Status' },
  { key: 'remarks', label: 'Remarks' },
];

function contactInputFrom(contact?: ApprovalContactDTO): ApprovalContactInput {
  if (!contact) return { ...EMPTY_CONTACT };
  return {
    srNo: contact.srNo,
    approvalFormNo: contact.approvalFormNo,
    company: contact.company,
    name: contact.name,
    emiratesId: contact.emiratesId,
    phone: contact.phone,
    position: contact.position,
    wmsRole: contact.wmsRole,
    instituteName: contact.instituteName,
    jvAssessmentDate: contact.jvAssessmentDate,
    wmsValidity: contact.wmsValidity,
    status: AUTHORIZATION_STATUS_OPTIONS.find((status) => status === contact.status) ?? 'Active',
    remarks: contact.remarks,
  };
}

export function AuthorizationListView() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const debouncedSearch = useDebounce(filters.search);
  const effectiveFilters = { ...filters, search: debouncedSearch };
  const { data, error, isLoading, mutate: refresh } = useApprovalContacts(
    page,
    PAGE_SIZE,
    effectiveFilters,
  );
  const { data: dropdownValues } = useDropdownValues();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApprovalContactDTO | null>(null);
  const [deleting, setDeleting] = useState<ApprovalContactDTO | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteAllEmail, setDeleteAllEmail] = useState('');
  const [deleteAllPassword, setDeleteAllPassword] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [contactForm, setContactForm] = useState<ApprovalContactInput>(EMPTY_CONTACT);
  const [importPreview, setImportPreview] = useState<ApprovalContactImportPreview | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setPage(1), [debouncedSearch, filters.position, filters.wmsRole]);
  useEffect(() => {
    if (!formOpen) return;
    setContactForm(contactInputFrom(editing ?? undefined));
  }, [editing, formOpen]);
  useEffect(() => {
    if (data && page > data.totalPages) setPage(data.totalPages);
  }, [data, page]);

  async function refreshContacts() {
    await Promise.all([
      refresh(),
      mutate('/api/approval-contacts/options'),
    ]);
    setSelectedIds(new Set());
  }

  function openCreateForm() {
    setEditing(null);
    setFormOpen(true);
  }

  function closeForm() {
    if (busy) return;
    setFormOpen(false);
    setEditing(null);
  }

  async function saveContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiFetch(
        editing ? `/api/approval-contacts/${editing.id}` : '/api/approval-contacts',
        {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify(contactForm),
        },
      );
      toast.success(editing ? 'Authorization updated' : 'Authorization created');
      setFormOpen(false);
      setEditing(null);
      await refreshContacts();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not save contact');
    } finally {
      setBusy(false);
    }
  }

  async function previewContactFile(file: File) {
    setImportBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const preview = await apiFetch<ApprovalContactImportPreview>(
        '/api/approval-contacts/import',
        { method: 'POST', body },
      );
      setImportPreview(preview);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read authorization workbook');
      if (importFileRef.current) importFileRef.current.value = '';
    } finally {
      setImportBusy(false);
    }
  }

  async function commitContactImport(updateExisting: boolean) {
    if (!importPreview) return;
    setImportBusy(true);
    try {
      const result = await apiFetch<ApprovalContactImportResult>(
        '/api/approval-contacts/import/commit',
        {
          method: 'POST',
          body: JSON.stringify({
            records: importPreview.records,
            updateExisting,
            fileName: importPreview.fileName,
            bytes: importFileRef.current?.files?.[0]?.size ?? 0,
            rowCount: importPreview.totalRows,
            invalidRows: importPreview.errors.length,
          }),
        },
      );
      toast.success(
        `Authorization import complete: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped, ${result.unchanged} unchanged`,
      );
      setImportPreview(null);
      if (importFileRef.current) importFileRef.current.value = '';
      await Promise.all([
        refreshContacts(),
        mutate('/api/dropdown-values'),
        mutate((key) => typeof key === 'string' && key.startsWith('/api/approval-contacts/history')),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not import authorizations');
    } finally {
      setImportBusy(false);
    }
  }

  async function exportContacts() {
    setExportBusy(true);
    try {
      await downloadFromApi('/api/approval-contacts/export', 'Authorization-List.xlsx');
      toast.success('Authorization workbook downloaded');
      await mutate((key) => typeof key === 'string' && key.startsWith('/api/approval-contacts/history'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not export authorizations');
    } finally {
      setExportBusy(false);
    }
  }

  async function deleteContact() {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiFetch(`/api/approval-contacts/${deleting.id}`, { method: 'DELETE' });
      toast.success('Authorization deleted');
      setDeleting(null);
      await refreshContacts();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Could not delete authorization');
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedContacts() {
    if (selectedIds.size === 0) return;
    setBusy(true);
    try {
      const result = await apiFetch<{ deleted: number }>('/api/approval-contacts/bulk', {
        method: 'DELETE',
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      toast.success(`${result.deleted} authorizations deleted`);
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      await refreshContacts();
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error ? deleteError.message : 'Could not delete selected authorizations',
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteAllContacts() {
    setBusy(true);
    try {
      const result = await apiFetch<{ deleted: number }>('/api/approval-contacts/bulk', {
        method: 'DELETE',
        body: JSON.stringify({
          deleteAll: true,
          credentials: { email: deleteAllEmail, password: deleteAllPassword },
        }),
      });
      toast.success(`${result.deleted} authorizations deleted`);
      setDeleteAllOpen(false);
      setDeleteAllEmail('');
      setDeleteAllPassword('');
      await refreshContacts();
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error ? deleteError.message : 'Could not delete all authorizations',
      );
    } finally {
      setBusy(false);
    }
  }

  const contacts = data?.items ?? [];
  const allSelected =
    contacts.length > 0 && contacts.every((contact) => selectedIds.has(contact.id));

  return (
    <>
      <PageHeader
        title="Authorization List"
        description="Manage authorization records manually or through Excel. These contacts are available in the permit authority selectors."
      />

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Authorization records
          </h2>
          <div className="flex flex-wrap gap-2">
            {selectedIds.size > 0 && (
              <Button
                variant="danger"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" /> Delete selected ({selectedIds.size})
              </Button>
            )}
            <Button
              variant="danger"
              onClick={() => setDeleteAllOpen(true)}
              disabled={!data?.total}
            >
              <Trash2 className="h-4 w-4" /> Delete all
            </Button>
            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void previewContactFile(file);
              }}
            />
            <Button
              variant="secondary"
              onClick={() => importFileRef.current?.click()}
              loading={importBusy}
            >
              <FileUp className="h-4 w-4" /> Import Excel
            </Button>
            <Button variant="secondary" onClick={() => void exportContacts()} loading={exportBusy}>
              <Download className="h-4 w-4" /> Export Excel
            </Button>
            <Button variant="secondary" onClick={openCreateForm}>
              <Plus className="h-4 w-4" /> Add authorization
            </Button>
          </div>
        </div>
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <Input
            type="search"
            placeholder="Search name, approval no., Emirates ID, mobile…"
            aria-label="Search authorized people"
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          />
          <Select
            aria-label="Filter by WMS role"
            options={dropdownValues?.wmsRole ?? []}
            placeholder="All WMS roles"
            value={filters.wmsRole}
            onChange={(event) => setFilters((current) => ({ ...current, wmsRole: event.target.value }))}
          />
          <Select
            aria-label="Filter by position"
            options={dropdownValues?.position ?? []}
            placeholder="All positions"
            value={filters.position}
            onChange={(event) => setFilters((current) => ({ ...current, position: event.target.value }))}
          />
        </div>
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {error ? (
            <EmptyState title="Could not load authorizations">{error.message}</EmptyState>
          ) : isLoading ? (
            <EmptyState title="Loading…" />
          ) : data && contacts.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-[2200px] border-collapse text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="sticky left-0 z-10 border border-slate-400 bg-slate-50 px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label="Select all authorizations"
                          checked={allSelected}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setSelectedIds((current) => {
                              const next = new Set(current);
                              for (const contact of contacts) {
                                if (checked) next.add(contact.id);
                                else next.delete(contact.id);
                              }
                              return next;
                            });
                          }}
                        />
                      </th>
                      <th className="whitespace-nowrap border border-slate-400 px-4 py-3">Sr #</th>
                      <th className="whitespace-nowrap border border-slate-400 px-4 py-3">Approval Form No</th>
                      <th className="whitespace-nowrap border border-slate-400 px-4 py-3">Company</th>
                      <th className="whitespace-nowrap border border-slate-400 px-4 py-3">Full Name</th>
                      <th className="whitespace-nowrap border border-slate-400 px-4 py-3">Emirates ID/JVUID No</th>
                      <th className="whitespace-nowrap border border-slate-400 px-4 py-3">Mobile Number</th>
                      <th className="whitespace-nowrap border border-slate-400 px-4 py-3">Position</th>
                      <th className="whitespace-nowrap border border-slate-400 px-4 py-3">WMS Role</th>
                      <th className="whitespace-nowrap border border-slate-400 px-4 py-3">Institute Name</th>
                      <th className="whitespace-nowrap border border-slate-400 px-4 py-3">JV Assessment Date</th>
                      <th className="whitespace-nowrap border border-slate-400 px-4 py-3">WMS Validity</th>
                      <th className="whitespace-nowrap border border-slate-400 px-4 py-3">Status</th>
                      <th className="whitespace-nowrap border border-slate-400 px-4 py-3">Remarks</th>
                      <th className="sticky right-0 z-10 whitespace-nowrap border border-slate-400 bg-slate-50 px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contacts.map((contact) => (
                      <tr key={contact.id} className="hover:bg-slate-50/70">
                        <td className="sticky left-0 border border-slate-400 bg-white px-3 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${contact.name}`}
                            checked={selectedIds.has(contact.id)}
                            onChange={(event) =>
                              setSelectedIds((current) => {
                                const next = new Set(current);
                                if (event.target.checked) next.add(contact.id);
                                else next.delete(contact.id);
                                return next;
                              })
                            }
                          />
                        </td>
                        {[
                          contact.srNo,
                          contact.approvalFormNo,
                          contact.company,
                          contact.name,
                          contact.emiratesId,
                          contact.phone,
                          contact.position,
                          contact.wmsRole,
                          contact.instituteName,
                          contact.jvAssessmentDate,
                          contact.wmsValidity,
                          contact.status,
                          contact.remarks,
                        ].map((value, index) => (
                          <td
                            key={index}
                            title={value || undefined}
                            className={`${index === 3 ? 'font-medium text-slate-900' : ''} whitespace-nowrap border border-slate-400 px-4 py-3`}
                          >
                            {value || '—'}
                          </td>
                        ))}
                        <td className="sticky right-0 whitespace-nowrap border border-slate-400 bg-white px-2 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditing(contact);
                              setFormOpen(true);
                            }}
                            aria-label={`Edit ${contact.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleting(contact)}
                            aria-label={`Delete ${contact.name}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
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
            <EmptyState title="No authorizations" />
          )}
        </section>
      </section>

      <Modal
        open={formOpen}
        size="xl"
        title={editing ? 'Edit authorization' : 'Add authorization'}
        onClose={closeForm}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="approval-contact-form" loading={busy}>
              {editing ? 'Save changes' : 'Create authorization'}
            </Button>
          </>
        }
      >
        <form id="approval-contact-form" onSubmit={saveContact}>
          <p className="mb-4 text-sm text-slate-500">
            Position, WMS Role, and Institute Name choices are managed on the Dropdown Values page.
          </p>
          <div className="grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto p-1 sm:grid-cols-2">
            {CONTACT_FORM_FIELDS.map(({ key, label, required }) => (
              <FormField
                key={key}
                label={label}
                htmlFor={`contact-${key}`}
                required={required}
                className={key === 'remarks' ? 'sm:col-span-2' : undefined}
              >
                {AUTHORIZATION_LIST_DROPDOWN_FIELDS.some((field) => field.key === key) ? (
                  <Select
                    id={`contact-${key}`}
                    options={dropdownValues?.[key] ?? []}
                    value={contactForm[key]}
                    onChange={(event) =>
                      setContactForm((current) => ({ ...current, [key]: event.target.value }))
                    }
                  />
                ) : key === 'status' ? (
                  <div className="flex flex-wrap gap-5">
                    {AUTHORIZATION_STATUS_OPTIONS.map((status) => (
                      <label key={status} className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="authorization-status"
                          value={status}
                          checked={contactForm.status === status}
                          onChange={() =>
                            setContactForm((current) => ({ ...current, status }))
                          }
                        />
                        {status}
                      </label>
                    ))}
                  </div>
                ) : (
                  <Input
                    id={`contact-${key}`}
                    type={key === 'jvAssessmentDate' || key === 'wmsValidity' ? 'date' : 'text'}
                    value={contactForm[key]}
                    onChange={(event) =>
                      setContactForm((current) => ({ ...current, [key]: event.target.value }))
                    }
                    maxLength={key === 'remarks' ? 1000 : key === 'phone' ? 40 : key === 'emiratesId' ? 100 : 200}
                    required={required}
                  />
                )}
              </FormField>
            ))}
          </div>
        </form>
      </Modal>

      <Modal
        open={!!importPreview}
        size="xl"
        title="Review authorization import"
        description={
          importPreview
            ? `${importPreview.fileName} · ${importPreview.totalRows} rows found`
            : undefined
        }
        onClose={() => {
          if (!importBusy) {
            setImportPreview(null);
            if (importFileRef.current) importFileRef.current.value = '';
          }
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setImportPreview(null);
                if (importFileRef.current) importFileRef.current.value = '';
              }}
              disabled={importBusy}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => void commitContactImport(false)}
              loading={importBusy}
              disabled={!importPreview?.counts.added}
            >
              Add new only ({importPreview?.counts.added ?? 0})
            </Button>
            <Button
              onClick={() => void commitContactImport(true)}
              loading={importBusy}
              disabled={!importPreview || importPreview.counts.added + importPreview.counts.updated === 0}
            >
              Add and update existing
            </Button>
          </>
        }
      >
        {importPreview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <p>New: <b>{importPreview.counts.added}</b></p>
              <p>Changed: <b>{importPreview.counts.updated}</b></p>
              <p>Unchanged: <b>{importPreview.counts.unchanged}</b></p>
              <p>Errors: <b>{importPreview.errors.length}</b></p>
            </div>
            {importPreview.errors.length > 0 && (
              <div className="max-h-36 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {importPreview.errors.map((error) => (
                  <p key={`${error.row}-${error.messages.join()}`}>
                    Row {error.row}: {error.messages.join(', ')}
                  </p>
                ))}
              </div>
            )}
            <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[700px] divide-y divide-slate-200 text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Excel row</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Contact</th>
                    <th className="px-3 py-2">Changes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importPreview.rows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2 capitalize">{row.action}</td>
                      <td className="px-3 py-2">
                        {row.name}
                        <span className="block text-xs text-slate-500">{row.emiratesId}</span>
                      </td>
                      <td className="px-3 py-2">
                        {row.changes.length ? (
                          <ul className="space-y-1">
                            {row.changes.map((change) => (
                              <li key={change.key}>
                                <b>{change.label}:</b> “{change.oldValue || '—'}” → “
                                {change.newValue || '—'}”
                              </li>
                            ))}
                          </ul>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete authorization"
        loading={busy}
        onConfirm={deleteContact}
        onClose={() => {
          if (!busy) setDeleting(null);
        }}
      >
        Delete <b>{deleting?.name}</b> from the authorization list? Authorizations selected by a permit
        cannot be deleted until that permit is updated.
      </ConfirmDialog>

      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Delete selected authorizations"
        confirmLabel={`Delete ${selectedIds.size}`}
        loading={busy}
        onConfirm={deleteSelectedContacts}
        onClose={() => {
          if (!busy) setBulkDeleteOpen(false);
        }}
      >
        Delete {selectedIds.size} selected authorizations? Any authorization used by a permit
        prevents the entire selection from being deleted.
      </ConfirmDialog>

      <Modal
        open={deleteAllOpen}
        title="Delete all authorizations"
        description={`This will delete all ${data?.total ?? 0} authorization records, not only the current page. Admin credentials are required.`}
        onClose={() => {
          if (!busy) {
            setDeleteAllOpen(false);
            setDeleteAllEmail('');
            setDeleteAllPassword('');
          }
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteAllOpen(false);
                setDeleteAllEmail('');
                setDeleteAllPassword('');
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="delete-all-authorizations-form"
              variant="danger"
              loading={busy}
            >
              <Trash2 className="h-4 w-4" /> Delete all
            </Button>
          </>
        }
      >
        <form
          id="delete-all-authorizations-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void deleteAllContacts();
          }}
        >
          <p className="text-sm text-slate-600">
            Authorizations currently used by permits cannot be deleted. Update those permits first.
          </p>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Admin email</span>
            <Input
              type="email"
              autoComplete="username"
              required
              value={deleteAllEmail}
              onChange={(event) => setDeleteAllEmail(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Admin password</span>
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={deleteAllPassword}
              onChange={(event) => setDeleteAllPassword(event.target.value)}
            />
          </label>
        </form>
      </Modal>
    </>
  );
}
