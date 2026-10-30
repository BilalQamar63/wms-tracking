'use client';

import { useMemo, useState } from 'react';
import { Building2, ClipboardList, Clock3, Users, XCircle } from 'lucide-react';
import useSWR from 'swr';
import type { PermitDashboardStatsDTO, PermitFieldKey } from '@wms/shared';
import { EmptyState } from '@/components/ui/empty-state';
import { ExcelFieldPicker, ALL_FIELD_KEYS } from '@/components/ui/excel-field-picker';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { EMPTY_PERMIT_FILTERS, type PermitFilterState } from '@/hooks/use-permits';
import { useDebounce } from '@/hooks/use-debounce';
import { downloadFromApi, swrFetcher, toQueryString } from '@/lib/api-client';
import { PermitFilters } from '../permits/permit-filters';
import { ContractorStatsTable, type CompanyExportStatus } from './contractor-stats-table';
import { DashboardStatCard } from './dashboard-stat-card';

type ContractorStatusFilter = 'all' | 'active' | 'closed';

export function DashboardView() {
  const toast = useToast();
  const [filters, setFilters] = useState<PermitFilterState>(EMPTY_PERMIT_FILTERS);
  const [statusFilter, setStatusFilter] = useState<ContractorStatusFilter>('all');
  const [selectedFields, setSelectedFields] = useState<PermitFieldKey[]>(ALL_FIELD_KEYS);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const debouncedSearch = useDebounce(filters.search);
  const effectiveFilters = { ...filters, search: debouncedSearch };
  const statsUrl = `/api/dashboard/stats${toQueryString(effectiveFilters)}`;
  const { data, error, isLoading } = useSWR<PermitDashboardStatsDTO>(statsUrl, swrFetcher);

  async function exportContractor(
    mainContractor: string,
    subContractor: string,
    exportStatus: CompanyExportStatus,
  ) {
    const key = `${mainContractor}|${subContractor}:${exportStatus}`;
    setExportingKey(key);
    try {
      const fileName = await downloadFromApi(
        `/api/dashboard/export${toQueryString({
          ...effectiveFilters,
          mainContractor,
          rowSubContractor: subContractor,
          exportStatus,
          fields: selectedFields.join(','),
        })}`,
        `PTW-${mainContractor}-${subContractor}-${exportStatus}.xlsx`,
      );
      toast.success(`Exported ${fileName}`);
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : 'Export failed');
    } finally {
      setExportingKey(null);
    }
  }

  const contractors = useMemo(
    () =>
      (data?.byContractor ?? []).filter((contractor) => {
        if (statusFilter === 'active' && contractor.active === 0) return false;
        if (statusFilter === 'closed' && contractor.closed === 0) return false;
        return true;
      }),
    [data?.byContractor, statusFilter],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="MERAM MASTER PTW DASHBOARD"
        description="Overview of permits grouped by Main Contractor and Sub Contractor."
      />

      {error ? (
        <EmptyState title="Could not load dashboard">{error.message}</EmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <DashboardStatCard
              label="Main Contractors"
              value={data?.mainContractors}
              icon={Building2}
              tone="blue"
            />
            <DashboardStatCard
              label="Sub Contractors"
              value={data?.subContractors}
              icon={Users}
              tone="purple"
            />
            <DashboardStatCard
              label="Total permits"
              value={data?.total}
              icon={ClipboardList}
              tone="slate"
            />
            <DashboardStatCard
              label="Active"
              value={data?.active}
              icon={Clock3}
              tone="amber"
              active={statusFilter === 'active'}
              onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
            />
            <DashboardStatCard
              label="Closed"
              value={data?.closed}
              icon={XCircle}
              tone="green"
              active={statusFilter === 'closed'}
              onClick={() => setStatusFilter(statusFilter === 'closed' ? 'all' : 'closed')}
            />
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Permits by Main Contractor and Sub Contractor
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Use the filters to narrow permits. Active permits are not closed. Choose Excel
                    fields below before exporting.
                  </p>
                </div>
                <ExcelFieldPicker selectedFields={selectedFields} onChange={setSelectedFields} />
              </div>
            </div>

            <PermitFilters value={filters} onChange={setFilters} />

            {isLoading && !data ? (
              <EmptyState title="Loading dashboard…" />
            ) : data ? (
              <ContractorStatsTable
                contractors={contractors}
                onExport={exportContractor}
                exportingKey={exportingKey}
                canExport={selectedFields.length > 0}
              />
            ) : (
              <EmptyState title="No permits match these filters">
                Adjust your filters to see contractor totals.
              </EmptyState>
            )}
          </section>
        </>
      )}
    </div>
  );
}
