'use client';

import { PERMIT_FIELD_LIST, type PermitFieldKey } from '@wms/shared';

const TABLE_FIELDS = PERMIT_FIELD_LIST.filter((field) => field.inTable);
const ALL_TABLE_FIELDS = TABLE_FIELDS.map((field) => field.key as PermitFieldKey);

interface Props {
  selectedFields: readonly PermitFieldKey[];
  onChange: (fields: PermitFieldKey[]) => void;
}

export function PermitColumnPicker({ selectedFields, onChange }: Props) {
  function toggleField(key: PermitFieldKey) {
    onChange(
      selectedFields.includes(key)
        ? selectedFields.filter((field) => field !== key)
        : [...selectedFields, key],
    );
  }

  return (
    <details className="relative min-w-0 border-b border-slate-200 px-3 py-3 sm:px-4">
      <summary className="inline-flex max-w-full cursor-pointer list-none items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        Table fields ({selectedFields.length}/{ALL_TABLE_FIELDS.length})
      </summary>
      <div className="absolute left-2 right-2 z-20 mt-2 max-h-[70dvh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-lg sm:left-4 sm:right-auto sm:max-h-[28rem] sm:w-80">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <span className="text-sm font-semibold text-slate-800">Fields shown in table</span>
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              className="text-xs font-medium text-brand-700 hover:text-brand-900"
              onClick={() => onChange(ALL_TABLE_FIELDS)}
            >
              Select all
            </button>
            <button
              type="button"
              className="text-xs font-medium text-brand-700 hover:text-brand-900"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {TABLE_FIELDS.map((field) => {
            const key = field.key as PermitFieldKey;
            return (
              <label
                key={field.key}
                className="flex cursor-pointer items-start gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={selectedFields.includes(key)}
                  onChange={() => toggleField(key)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                />
                <span>{field.header}</span>
              </label>
            );
          })}
        </div>
        <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
          Sr No is always shown.
        </p>
      </div>
    </details>
  );
}
