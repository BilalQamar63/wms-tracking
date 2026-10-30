'use client';

import { PERMIT_FIELD_LIST, type PermitFieldKey } from '@wms/shared';

const TABLE_FIELDS = PERMIT_FIELD_LIST.filter((field) => field.inTable);

interface Props {
  selectedField: PermitFieldKey | null;
  visibleFields: readonly PermitFieldKey[];
  onChange: (field: PermitFieldKey) => void;
}

export function PermitColumnNavigator({ selectedField, visibleFields, onChange }: Props) {
  const selectedIsHidden = selectedField !== null && !visibleFields.includes(selectedField);

  return (
    <fieldset className="border-b border-slate-200 px-4 py-3">
      <legend className="mb-2 text-sm font-medium text-slate-700">Jump to table field</legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {TABLE_FIELDS.map((field) => {
          const key = field.key as PermitFieldKey;
          return (
            <label
              key={field.key}
              className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
            >
              <input
                type="radio"
                name="permit-column"
                checked={selectedField === key}
                onChange={() => onChange(key)}
                className="h-4 w-4 border-slate-300 text-brand-700 focus:ring-brand-500"
              />
              <span>{field.header}</span>
            </label>
          );
        })}
      </div>
      {selectedIsHidden && (
        <p className="mt-2 text-xs text-amber-700">
          This field is hidden. Enable it in Table fields to scroll to its column.
        </p>
      )}
    </fieldset>
  );
}
