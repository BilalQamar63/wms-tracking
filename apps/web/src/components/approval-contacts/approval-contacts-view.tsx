'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  APPROVAL_CONTACT_ROLES,
  PERMIT_FIELD_LIST,
  type ApprovalContactDTO,
  type ApprovalContactRole,
} from '@wms/shared';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useApprovalContacts } from '@/hooks/use-approval-contacts';
import { apiFetch } from '@/lib/api-client';
import { useDropdownValues } from '@/hooks/use-dropdown-values';

const CONFIGURABLE_FIELDS = PERMIT_FIELD_LIST.filter(
  (field) =>
    ['select', 'radio', 'multiselect'].includes(field.type) &&
    !field.contactRole &&
    field.options?.length,
);
const ROLE_LABELS: Record<ApprovalContactRole, string> = {
  performingAuthority: 'Performing Authority',
  validationBy: 'Validate',
  approvedBy: 'Approval',
};

export function DropdownValuesView() {
  const toast = useToast();
  const { data, error, isLoading, mutate: refresh } = useApprovalContacts();
  const {
    data: dropdownValues,
    error: dropdownValuesError,
    isLoading: dropdownValuesLoading,
    mutate: refreshDropdownValues,
  } = useDropdownValues();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApprovalContactDTO | null>(null);
  const [deleting, setDeleting] = useState<ApprovalContactDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<ApprovalContactRole>(APPROVAL_CONTACT_ROLES[0]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [subContractor, setSubContractor] = useState('');
  const [draftValues, setDraftValues] = useState<Record<string, string[]>>({});
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [savingField, setSavingField] = useState<string | null>(null);

  useEffect(() => {
    if (!dropdownValues) return;
    setDraftValues(
      Object.fromEntries(
        Object.entries(dropdownValues).map(([fieldKey, values]) => [fieldKey, [...values]]),
      ),
    );
  }, [dropdownValues]);

  useEffect(() => {
    if (!formOpen) return;
    setRole(editing?.role ?? APPROVAL_CONTACT_ROLES[0]);
    setName(editing?.name ?? '');
    setPhone(editing?.phone ?? '');
    setSubContractor(editing?.subContractor ?? '');
  }, [editing, formOpen]);

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
      const input = { role, name, phone, subContractor };
      await apiFetch(
        editing ? `/api/approval-contacts/${editing.id}` : '/api/approval-contacts',
        {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify(input),
        },
      );
      toast.success(editing ? 'Approval contact updated' : 'Approval contact created');
      setFormOpen(false);
      setEditing(null);
      await Promise.all([refresh(), refreshDropdownValues()]);
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not save contact');
    } finally {
      setBusy(false);
    }
  }

  async function deleteContact() {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiFetch(`/api/approval-contacts/${deleting.id}`, { method: 'DELETE' });
      toast.success('Approval contact deleted');
      setDeleting(null);
      await Promise.all([refresh(), refreshDropdownValues()]);
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Could not delete contact');
    } finally {
      setBusy(false);
    }
  }

  async function saveFieldValues(fieldKey: string, values: string[]): Promise<boolean> {
    setSavingField(fieldKey);
    try {
      await apiFetch(`/api/dropdown-values/${fieldKey}`, {
        method: 'PUT',
        body: JSON.stringify({ values }),
      });
      toast.success('Dropdown values saved');
      await refreshDropdownValues();
      return true;
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not save dropdown values');
      return false;
    } finally {
      setSavingField(null);
    }
  }

  async function addFieldValue(fieldKey: string) {
    const value = newValues[fieldKey]?.trim();
    if (!value) {
      toast.error('Enter a value first');
      return;
    }
    const values = draftValues[fieldKey] ?? dropdownValues?.[fieldKey] ?? [];
    if (await saveFieldValues(fieldKey, [...values, value])) {
      setNewValues((current) => ({ ...current, [fieldKey]: '' }));
    }
  }

  return (
    <>
      <PageHeader
        title="Dropdown Values"
        description="Manage permit dropdown choices. Approval contacts are shown as Name - number and filtered by the permit’s sub contractor."
      />

      <section className="mb-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Permit dropdown fields
        </h2>
        {dropdownValuesError ? (
          <EmptyState title="Could not load dropdown values">{dropdownValuesError.message}</EmptyState>
        ) : dropdownValuesLoading ? (
          <EmptyState title="Loading dropdown values…" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {CONFIGURABLE_FIELDS.map((field) => {
              const values = draftValues[field.key] ?? dropdownValues?.[field.key] ?? [];
              const isDirty =
                JSON.stringify(values) !==
                JSON.stringify(dropdownValues?.[field.key] ?? field.options ?? []);
              return (
                <article
                  key={field.key}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <h3 className="mb-3 font-medium text-slate-900">{field.header}</h3>
                  <div className="space-y-2">
                    {values.map((value, index) => (
                      <div key={`${field.key}-${index}`} className="flex items-center gap-2">
                        <Input
                          aria-label={`${field.header} value ${index + 1}`}
                          value={value}
                          onChange={(event) =>
                            setDraftValues((current) => ({
                              ...current,
                              [field.key]: values.map((entry, valueIndex) =>
                                valueIndex === index ? event.target.value : entry,
                              ),
                            }))
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove ${value || 'empty'} from ${field.header}`}
                          disabled={savingField === field.key}
                          onClick={() =>
                            void saveFieldValues(
                              field.key,
                              values.filter((_, valueIndex) => valueIndex !== index),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Input
                        aria-label={`New ${field.header} value`}
                        placeholder={`Add ${field.header.toLowerCase()} value`}
                        value={newValues[field.key] ?? ''}
                        onChange={(event) =>
                          setNewValues((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        variant="secondary"
                        disabled={savingField === field.key}
                        onClick={() => void addFieldValue(field.key)}
                      >
                        Add
                      </Button>
                    </div>
                    {isDirty && (
                      <Button
                        loading={savingField === field.key}
                        disabled={savingField !== null}
                        onClick={() => void saveFieldValues(field.key, values)}
                      >
                        Save {field.header}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Approval contacts
          </h2>
          <Button variant="secondary" onClick={openCreateForm}>
            <Plus className="h-4 w-4" /> Add contact
          </Button>
        </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {error ? (
          <EmptyState title="Could not load approval contacts">{error.message}</EmptyState>
        ) : isLoading ? (
          <EmptyState title="Loading…" />
        ) : data?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[700px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Dropdown field</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Mobile number</th>
                  <th className="px-4 py-3">Sub contractor</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">{ROLE_LABELS[contact.role]}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{contact.name}</td>
                    <td className="px-4 py-3">{contact.phone}</td>
                    <td className="px-4 py-3">{contact.subContractor}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
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
        ) : (
          <EmptyState title="No approval contacts" />
        )}
      </section>
      </section>

      <Modal
        open={formOpen}
        title={editing ? 'Edit approval contact' : 'Add approval contact'}
        onClose={closeForm}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="approval-contact-form" loading={busy}>
              {editing ? 'Save changes' : 'Create contact'}
            </Button>
          </>
        }
      >
        <form id="approval-contact-form" onSubmit={saveContact} className="space-y-4">
          <FormField label="Approval field" htmlFor="contact-role" required>
            <Select
              id="contact-role"
              options={APPROVAL_CONTACT_ROLES.map((value) => ({
                value,
                label: ROLE_LABELS[value],
              }))}
              value={role}
              onChange={(event) => setRole(event.target.value as ApprovalContactRole)}
            />
          </FormField>
          <FormField label="Name" htmlFor="contact-name" required>
            <Input
              id="contact-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
            />
          </FormField>
          <FormField label="Mobile number" htmlFor="contact-phone" required>
            <Input
              id="contact-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={40}
              required
            />
          </FormField>
          <FormField label="Sub contractor" htmlFor="contact-sub-contractor" required>
            <Select
              id="contact-sub-contractor"
              options={dropdownValues?.subContractor ?? []}
              value={subContractor}
              onChange={(event) => setSubContractor(event.target.value)}
              disabled={!dropdownValues?.subContractor?.length}
              required
            />
          </FormField>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete approval contact"
        loading={busy}
        onConfirm={deleteContact}
        onClose={() => {
          if (!busy) setDeleting(null);
        }}
      >
        Delete <b>{deleting?.name}</b> from {deleting ? ROLE_LABELS[deleting.role] : 'the dropdown'}?
        Contacts selected by a permit cannot be deleted until that permit is updated.
      </ConfirmDialog>
    </>
  );
}
