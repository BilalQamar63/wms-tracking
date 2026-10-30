'use client';

import { useEffect, useRef } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import {
  FORM_SECTIONS,
  PERMIT_FIELD_LIST,
  formatDisplayDate,
  getTodayYmd,
  toDateInputValue,
  type FormSection,
  type PermitFieldKey,
  type PermitDTO,
} from '@wms/shared';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './status-badge';
import { PlanCountdown } from './plan-countdown';

const COLUMNS = PERMIT_FIELD_LIST.filter((field) => field.inTable);
const SECTION_STYLES: Record<FormSection, { header: string; cell: string }> = {
  planning: {
    header: 'bg-blue-50 text-blue-900',
    cell: 'bg-blue-50/25',
  },
  validity: {
    header: 'bg-amber-50 text-amber-900',
    cell: 'bg-amber-50/25',
  },
  closure: {
    header: 'bg-emerald-50 text-emerald-900',
    cell: 'bg-emerald-50/25',
  },
};

interface Props {
  permits: PermitDTO[];
  canManage: boolean;
  onEdit: (permit: PermitDTO) => void;
  onDelete: (permit: PermitDTO) => void;
  visibleFields: readonly PermitFieldKey[];
  selectedField: PermitFieldKey | null;
  navigationVersion: number;
}

function renderCell(permit: PermitDTO, key: string, type: string) {
  const value = permit[key as keyof PermitDTO] as string | string[] | undefined;
  if (key === 'status') {
    const endDate = toDateInputValue(permit.planValidEndDate);
    const status = value !== 'Closed' && endDate && endDate < getTodayYmd() ? 'Overdue' : value;
    return <StatusBadge status={typeof status === 'string' ? status : undefined} />;
  }
  if (key === 'ptwValidity')
    return (
      <PlanCountdown startDate={permit.planValidStartDate} endDate={permit.planValidEndDate} />
    );
  if (!value) return <span className="text-slate-300">—</span>;
  if (type === 'date') return formatDisplayDate(value as string);
  return Array.isArray(value) ? value.join(', ') : value;
}

export function PermitTable({
  permits,
  canManage,
  onEdit,
  onDelete,
  visibleFields,
  selectedField,
  navigationVersion,
}: Props) {
  const tableContainer = useRef<HTMLDivElement>(null);
  const columns = COLUMNS.filter((column) => visibleFields.includes(column.key as PermitFieldKey));
  const sectionColumns = FORM_SECTIONS.map((section) => ({
    ...section,
    columns: columns.filter((column) => column.section === section.id),
  }));
  const planningColumns = sectionColumns[0]?.columns.length ?? 0;
  const validityColumns = sectionColumns[1]?.columns.length ?? 0;
  const closureColumns = sectionColumns[2]?.columns.length ?? 0;

  useEffect(() => {
    if (!selectedField) return;
    const container = tableContainer.current;
    const target = container?.querySelector<HTMLElement>(
      `th[data-permit-column="${selectedField}"]`,
    );
    if (!container || !target) return;
    const targetLeft =
      target.getBoundingClientRect().left -
      container.getBoundingClientRect().left +
      container.scrollLeft;
    container.scrollTo({ left: targetLeft, behavior: 'smooth' });
  }, [selectedField, visibleFields, navigationVersion]);

  return (
    <div ref={tableContainer} className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="text-xs font-semibold uppercase tracking-wide">
          <tr>
            <th
              colSpan={planningColumns + 1}
              className={`border-b border-blue-100 px-4 py-2 text-left ${SECTION_STYLES.planning.header}`}
            >
              {FORM_SECTIONS[0]?.title}
            </th>
            {validityColumns > 0 && (
              <th
                colSpan={validityColumns}
                className={`border-b border-amber-100 px-4 py-2 text-left ${SECTION_STYLES.validity.header}`}
              >
                {FORM_SECTIONS[1]?.title}
              </th>
            )}
            {(closureColumns > 0 || canManage) && (
              <th
                colSpan={closureColumns + (canManage ? 1 : 0)}
                className={`border-b border-emerald-100 px-4 py-2 text-left ${SECTION_STYLES.closure.header}`}
              >
                {FORM_SECTIONS[2]?.title}
              </th>
            )}
          </tr>
          <tr className="bg-slate-50 text-left text-slate-500">
            <th className={`whitespace-nowrap px-4 py-3 ${SECTION_STYLES.planning.cell}`}>Sr No</th>
            {columns.map((column) => (
              <th
                key={column.key}
                data-permit-column={column.key}
                className={`whitespace-nowrap px-4 py-3 ${SECTION_STYLES[column.section].cell} ${selectedField === column.key ? 'ring-2 ring-inset ring-brand-500' : ''}`}
              >
                {column.header}
              </th>
            ))}
            {canManage && (
              <th className={`px-4 py-3 text-right ${SECTION_STYLES.closure.cell}`}>Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {permits.map((permit) => (
            <tr key={permit.id} className="hover:bg-slate-50/70">
              <td
                className={`px-4 py-3 font-medium tabular-nums text-slate-900 ${SECTION_STYLES.planning.cell}`}
              >
                {permit.srNo}
              </td>
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-permit-column={column.key}
                  className={`max-w-[16rem] px-4 py-3 text-slate-700 ${column.key === 'certificateType' ? 'whitespace-normal break-words' : 'truncate whitespace-nowrap'} ${SECTION_STYLES[column.section].cell} ${selectedField === column.key ? 'ring-2 ring-inset ring-brand-500' : ''}`}
                >
                  {renderCell(permit, column.key, column.type)}
                </td>
              ))}
              {canManage && (
                <td
                  className={`whitespace-nowrap px-4 py-3 text-right ${SECTION_STYLES.closure.cell}`}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(permit)}
                    aria-label={`Edit permit ${permit.srNo}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(permit)}
                    aria-label={`Delete permit ${permit.srNo}`}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
