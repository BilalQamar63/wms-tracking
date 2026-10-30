'use client';

import { Search, X } from 'lucide-react';
import {
  DEPARTMENTS,
  DISCIPLINES,
  MAIN_CONTRACTORS,
  PERMIT_FIELD_LIST,
  PLANT_DIVISIONS,
  PTW_STATUSES,
  PTW_TYPES,
  SUB_CONTRACTORS,
} from '@wms/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EMPTY_PERMIT_FILTERS, type PermitFilterState } from '@/hooks/use-permits';

interface Props {
  value: PermitFilterState;
  onChange: (next: PermitFilterState) => void;
}

export function PermitFilters({ value, onChange }: Props) {
  const set = <K extends keyof PermitFilterState>(key: K, v: PermitFilterState[K]) =>
    onChange({ ...value, [key]: v });
  const dirty = JSON.stringify(value) !== JSON.stringify(EMPTY_PERMIT_FILTERS);
  const field = PERMIT_FIELD_LIST.find((item) => item.key === value.fieldKey);

  return (
    <div className="grid grid-cols-1 gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      <div className="relative sm:col-span-2 lg:col-span-2">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Search company, PTW no, tag, location…"
          value={value.search}
          onChange={(e) => set('search', e.target.value)}
          aria-label="Search permits"
        />
      </div>
      <Select
        aria-label="Status"
        placeholder="All statuses"
        options={PTW_STATUSES}
        value={value.status}
        onChange={(e) => set('status', e.target.value)}
      />
      <Select
        aria-label="Department"
        placeholder="All departments"
        options={DEPARTMENTS}
        value={value.department}
        onChange={(e) => set('department', e.target.value)}
      />
      <Select
        aria-label="Discipline"
        placeholder="All disciplines"
        options={DISCIPLINES}
        value={value.discipline}
        onChange={(e) => set('discipline', e.target.value)}
      />
      <Select
        aria-label="Plant"
        placeholder="All plants"
        options={PLANT_DIVISIONS}
        value={value.plantDivision}
        onChange={(e) => set('plantDivision', e.target.value)}
      />
      <Select
        aria-label="Main contractor"
        placeholder="All main contractors"
        options={MAIN_CONTRACTORS}
        value={value.company}
        onChange={(e) => set('company', e.target.value)}
      />
      <Select
        aria-label="Sub contractor"
        placeholder="All sub contractors"
        options={SUB_CONTRACTORS}
        value={value.subContractor}
        onChange={(e) => set('subContractor', e.target.value)}
      />
      <Select
        aria-label="New PTW Type"
        placeholder="All new PTW types"
        options={PTW_TYPES}
        value={value.ptwType}
        onChange={(e) => set('ptwType', e.target.value)}
      />
      <Select
        aria-label="Filter by field"
        placeholder="Any field"
        options={PERMIT_FIELD_LIST.filter((item) => item.type !== 'computed').map((item) => ({
          value: item.key,
          label: item.header,
        }))}
        value={value.fieldKey}
        onChange={(e) => onChange({ ...value, fieldKey: e.target.value, fieldValue: '' })}
      />
      {field?.type === 'date' ? (
        <Input
          type="date"
          aria-label={`Filter ${field.header}`}
          value={value.fieldValue}
          onChange={(e) => set('fieldValue', e.target.value)}
        />
      ) : field?.options ? (
        <Select
          aria-label={`Filter ${field.header}`}
          placeholder={`All ${field.header.toLowerCase()}`}
          options={field.options}
          value={value.fieldValue}
          onChange={(e) => set('fieldValue', e.target.value)}
        />
      ) : (
        <Input
          aria-label={field ? `Filter ${field.header}` : 'Filter value'}
          placeholder={field ? `Filter ${field.header}…` : 'Field value'}
          value={value.fieldValue}
          disabled={!field}
          onChange={(e) => set('fieldValue', e.target.value)}
        />
      )}
      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-4">
        <Input
          type="date"
          aria-label="Closed from"
          value={value.dateFrom}
          onChange={(e) => set('dateFrom', e.target.value)}
        />
        <span className="text-xs text-slate-400">to</span>
        <Input
          type="date"
          aria-label="Closed to"
          value={value.dateTo}
          onChange={(e) => set('dateTo', e.target.value)}
        />
        {dirty && (
          <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_PERMIT_FILTERS)}>
            <X className="h-4 w-4" /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}
