'use client';

import { ChevronDown } from 'lucide-react';
import { useRef } from 'react';
import { PERMIT_FIELD_LIST, type PermitFieldKey } from '@wms/shared';

const TABLE_FIELDS = PERMIT_FIELD_LIST.filter((field) => field.inTable);

interface Props {
  selectedField: PermitFieldKey | null;
  visibleFields: readonly PermitFieldKey[];
  onChange: (field: PermitFieldKey) => void;
}

export function PermitColumnNavigator({ selectedField, visibleFields, onChange }: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const selectedIsHidden = selectedField !== null && !visibleFields.includes(selectedField);
  const selectedHeader = TABLE_FIELDS.find((field) => field.key === selectedField)?.header;

  return (
    <details ref={detailsRef} className="group border-b border-slate-200 px-3 py-2 sm:px-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 py-2 text-sm font-medium text-slate-700 hover:text-slate-900">
        <span>Jump to table field</span>
        <span className="flex min-w-0 items-center gap-2">
          {selectedHeader && (
            <span className="truncate text-xs font-normal text-slate-500">{selectedHeader}</span>
          )}
          <ChevronDown
            className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </span>
      </summary>
      <div className="mt-2 max-h-[45dvh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
        {selectedIsHidden && (
          <p className="mb-3 text-xs text-amber-700">
            This field is hidden. Enable it in Table fields to scroll to its column.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {TABLE_FIELDS.map((field) => {
            const key = field.key as PermitFieldKey;
            return (
              <label
                key={field.key}
                className="flex min-w-0 cursor-pointer items-start gap-2 text-sm text-slate-700"
              >
                <input
                  type="radio"
                  name="permit-column"
                  checked={selectedField === key}
                  onChange={() => {
                    onChange(key);
                    if (detailsRef.current) detailsRef.current.open = false;
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 border-slate-300 text-brand-700 focus:ring-brand-500"
                />
                <span className="break-words">{field.header}</span>
              </label>
            );
          })}
        </div>
      </div>
    </details>
  );
}
