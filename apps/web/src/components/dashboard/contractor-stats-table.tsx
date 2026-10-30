import type { CompanyPermitStatsDTO } from '@wms/shared';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';

export type CompanyExportStatus = 'all' | 'active' | 'closed';

interface Props {
  contractors: CompanyPermitStatsDTO[];
  onExport: (mainContractor: string, subContractor: string, status: CompanyExportStatus) => void;
  exportingKey: string | null;
  canExport: boolean;
}

const EXPORT_OPTIONS = [
  { value: 'all', label: 'All permits' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
] as const;

export function ContractorStatsTable({ contractors, onExport, exportingKey, canExport }: Props) {
  const [statuses, setStatuses] = useState<Record<string, CompanyExportStatus>>({});

  if (contractors.length === 0) {
    return (
      <EmptyState title="No contractors found">Try changing the dashboard filters.</EmptyState>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Main Contractor
            </th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sub Contractor
            </th>
            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total permits
            </th>
            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
              Active
            </th>
            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
              Closed
            </th>
            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
              Download
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {contractors.map((contractor) => {
            const key = `${contractor.mainContractor}|${contractor.subContractor}`;
            const exportStatus = statuses[key] ?? 'all';
            return (
              <tr key={key} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-900">
                  {contractor.mainContractor}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">
                  {contractor.subContractor}
                </td>
                <td className="px-5 py-4 text-right text-sm font-semibold text-slate-900">
                  {contractor.total}
                </td>
                <td className="px-5 py-4 text-right text-sm">
                  <Badge tone="blue">{contractor.active}</Badge>
                </td>
                <td className="px-5 py-4 text-right text-sm">
                  <Badge tone="green">{contractor.closed}</Badge>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Select
                      aria-label={`Export status for ${contractor.mainContractor}, ${contractor.subContractor}`}
                      options={EXPORT_OPTIONS}
                      value={exportStatus}
                      onChange={(event) =>
                        setStatuses((current) => ({
                          ...current,
                          [key]: event.target.value as CompanyExportStatus,
                        }))
                      }
                      className="min-w-40"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Download ${exportStatus} permits for ${contractor.mainContractor}, ${contractor.subContractor}`}
                      loading={exportingKey === `${key}:${exportStatus}`}
                      disabled={exportingKey !== null || !canExport}
                      onClick={() =>
                        onExport(contractor.mainContractor, contractor.subContractor, exportStatus)
                      }
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
