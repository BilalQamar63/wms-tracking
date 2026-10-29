import type { CompanyPermitStatsDTO } from '@wms/shared';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';

export type CompanyExportStatus = 'all' | 'active' | 'closed';

interface Props {
  companies: CompanyPermitStatsDTO[];
  onExport: (company: string, status: CompanyExportStatus) => void;
  exportingKey: string | null;
}

const EXPORT_OPTIONS = [
  { value: 'all', label: 'All permits' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
] as const;

export function CompanyStatsTable({ companies, onExport, exportingKey }: Props) {
  const [statuses, setStatuses] = useState<Record<string, CompanyExportStatus>>({});

  if (companies.length === 0) {
    return (
      <EmptyState title="No companies found">Try another company name or status filter.</EmptyState>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Company
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
          {companies.map((company) => (
            <tr key={company.company} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-900">
                {company.company}
              </td>
              <td className="px-5 py-4 text-right text-sm font-semibold text-slate-900">
                {company.total}
              </td>
              <td className="px-5 py-4 text-right text-sm">
                <Badge tone="blue">{company.active}</Badge>
              </td>
              <td className="px-5 py-4 text-right text-sm">
                <Badge tone="green">{company.closed}</Badge>
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center justify-end gap-2">
                  <Select
                    aria-label={`Export status for ${company.company}`}
                    options={EXPORT_OPTIONS}
                    value={statuses[company.company] ?? 'all'}
                    onChange={(event) =>
                      setStatuses((current) => ({
                        ...current,
                        [company.company]: event.target.value as CompanyExportStatus,
                      }))
                    }
                    className="min-w-40"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Download ${statuses[company.company] ?? 'all'} permits for ${company.company}`}
                    loading={
                      exportingKey === `${company.company}:${statuses[company.company] ?? 'all'}`
                    }
                    disabled={exportingKey !== null}
                    onClick={() => onExport(company.company, statuses[company.company] ?? 'all')}
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
