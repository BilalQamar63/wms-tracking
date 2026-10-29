'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { PERMIT_FIELD_LIST, formatDisplayDate, type PermitDTO } from '@wms/shared';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './status-badge';
import { PlanCountdown } from './plan-countdown';

const COLUMNS = PERMIT_FIELD_LIST.filter((field) => field.inTable);

interface Props {
  permits: PermitDTO[];
  onEdit: (permit: PermitDTO) => void;
  onDelete: (permit: PermitDTO) => void;
}

function renderCell(permit: PermitDTO, key: string, type: string) {
  const value = permit[key as keyof PermitDTO] as string | string[] | undefined;
  if (key === 'status')
    return <StatusBadge status={typeof value === 'string' ? value : undefined} />;
  if (!value) return <span className="text-slate-300">—</span>;
  if (type === 'date') return formatDisplayDate(value as string);
  return Array.isArray(value) ? value.join(', ') : value;
}

export function PermitTable({ permits, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Sr No</th>
            {COLUMNS.map((column) => (
              <th key={column.key} className="whitespace-nowrap px-4 py-3">
                {column.header}
              </th>
            ))}
            <th className="whitespace-nowrap px-4 py-3">Plan countdown</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {permits.map((permit) => (
            <tr key={permit.id} className="hover:bg-slate-50/70">
              <td className="px-4 py-3 font-medium tabular-nums text-slate-900">{permit.srNo}</td>
              {COLUMNS.map((column) => (
                <td
                  key={column.key}
                  className="max-w-[16rem] truncate whitespace-nowrap px-4 py-3 text-slate-700"
                >
                  {renderCell(permit, column.key, column.type)}
                </td>
              ))}
              <td className="whitespace-nowrap px-4 py-3">
                <PlanCountdown
                  startDate={permit.planValidStartDate}
                  endDate={permit.planValidEndDate}
                />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
