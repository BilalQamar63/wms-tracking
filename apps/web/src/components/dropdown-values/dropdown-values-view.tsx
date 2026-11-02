'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  AUTHORIZATION_LIST_DROPDOWN_FIELDS,
  PERMIT_FIELD_LIST,
} from '@wms/shared';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { useDropdownValues } from '@/hooks/use-dropdown-values';
import { apiFetch } from '@/lib/api-client';

const PERMIT_FIELDS = PERMIT_FIELD_LIST.filter(
  (field) =>
    ['select', 'radio', 'multiselect'].includes(field.type) &&
    !field.contactRole &&
    field.options?.length,
);

type DropdownField = { key: string; header: string };

export function DropdownValuesView() {
  const toast = useToast();
  const {
    data: dropdownValues,
    error,
    isLoading,
    mutate: refresh,
  } = useDropdownValues();
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

  async function saveFieldValues(fieldKey: string, values: string[]): Promise<boolean> {
    setSavingField(fieldKey);
    try {
      await apiFetch(`/api/dropdown-values/${fieldKey}`, {
        method: 'PUT',
        body: JSON.stringify({ values }),
      });
      toast.success('Dropdown values saved');
      await refresh();
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

  function renderFields(fields: readonly DropdownField[]) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {fields.map((field) => {
          const values = draftValues[field.key] ?? dropdownValues?.[field.key] ?? [];
          const isDirty =
            JSON.stringify(values) !== JSON.stringify(dropdownValues?.[field.key] ?? []);
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
    );
  }

  return (
    <>
      <PageHeader
        title="Dropdown Values"
        description="Configure permit choices and the Position, WMS Role, and Institute Name options used by the Authorization List."
      />
      {error ? (
        <EmptyState title="Could not load dropdown values">{error.message}</EmptyState>
      ) : isLoading ? (
        <EmptyState title="Loading dropdown values…" />
      ) : (
        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              Permit dropdown fields
            </h2>
            {renderFields(PERMIT_FIELDS)}
          </section>
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              Authorization List dropdown fields
            </h2>
            {renderFields(AUTHORIZATION_LIST_DROPDOWN_FIELDS)}
          </section>
        </div>
      )}
    </>
  );
}
