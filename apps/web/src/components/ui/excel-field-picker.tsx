'use client';

import { FileSpreadsheet } from 'lucide-react';
import { FORM_SECTIONS, PERMIT_FIELD_LIST, type PermitFieldKey } from '@wms/shared';

const ALL_FIELD_KEYS = PERMIT_FIELD_LIST.map((field) => field.key as PermitFieldKey);

interface Props {
  selectedFields: readonly PermitFieldKey[];
  onChange: (fields: PermitFieldKey[]) => void;
  expanded?: boolean;
}

export function ExcelFieldPicker({ selectedFields, onChange, expanded = false }: Props) {
  function toggleField(key: PermitFieldKey) {
    onChange(
      selectedFields.includes(key)
        ? selectedFields.filter((field) => field !== key)
        : [...selectedFields, key],
    );
  }

  const contents = (
    <>
      <div className="mb-3 flex justify-between gap-2 border-b border-slate-100 pb-3">
        <span className="text-sm font-semibold text-slate-800">Fields to include</span>
        <div className="flex gap-2">
          <button
            type="button"
            className="text-xs font-medium text-brand-700 hover:text-brand-900"
            onClick={() => onChange(ALL_FIELD_KEYS)}
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
      {FORM_SECTIONS.map((section) => (
        <fieldset key={section.id} className="mb-3 last:mb-0">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {section.title}
          </legend>
          <div className="space-y-2">
            {PERMIT_FIELD_LIST.filter((field) => field.section === section.id).map((field) => {
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
        </fieldset>
      ))}
      <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
        Sr No is always included.
      </p>
    </>
  );

  if (expanded) {
    return (
      <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 p-3">
        {contents}
      </div>
    );
  }

  return (
    <details className="relative">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
        <FileSpreadsheet className="h-4 w-4" />
        Excel fields ({selectedFields.length}/{ALL_FIELD_KEYS.length})
      </summary>
      <div className="absolute right-0 z-20 mt-2 max-h-[28rem] w-80 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
        {contents}
      </div>
    </details>
  );
}

export { ALL_FIELD_KEYS };
