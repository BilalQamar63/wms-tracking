'use client';

import { useMemo, useState } from 'react';
import { Building2, ClipboardList, Clock3, Search, XCircle } from 'lucide-react';
import useSWR from 'swr';
import type { PermitDashboardStatsDTO } from '@wms/shared';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { downloadFromApi, swrFetcher, toQueryString } from '@/lib/api-client';
import { CompanyStatsTable } from './company-stats-table';
import type { CompanyExportStatus } from './company-stats-table';
import { DashboardStatCard } from './dashboard-stat-card';

type CompanyStatusFilter = 'all' | 'active' | 'closed';

export function DashboardView() {
  const toast = useToast();
  const { data, error, isLoading } = useSWR<PermitDashboardStatsDTO>(
    '/api/dashboard/stats',
    swrFetcher,
  );
  const [companySearch, setCompanySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CompanyStatusFilter>('all');
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  async function exportCompany(company: string, status: CompanyExportStatus) {
    const key = `${company}:${status}`;
    setExportingKey(key);
    try {
      const fileName = await downloadFromApi(
        `/api/dashboard/export${toQueryString({ company, status })}`,
        `PTW-${company}-${status}.xlsx`,
      );
      toast.success(`Exported ${fileName}`);
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : 'Export failed');
    } finally {
      setExportingKey(null);
    }
  }

  const companies = useMemo(() => {
    const search = companySearch.trim().toLowerCase();
    return (data?.byCompany ?? []).filter((company) => {
      if (search && !company.company.toLowerCase().includes(search)) return false;
      if (statusFilter === 'active' && company.active === 0) return false;
      if (statusFilter === 'closed' && company.closed === 0) return false;
      return true;
    });
  }, [companySearch, data?.byCompany, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of permits across the current register and all imported workbooks, with a company-by-company status breakdown."
      />

      {error ? (
        <EmptyState title="Could not load dashboard">{error.message}</EmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardStatCard
              label="Companies"
              value={data?.companies}
              icon={Building2}
              tone="blue"
              active={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
            />
            <DashboardStatCard
              label="Total permits"
              value={data?.total}
              icon={ClipboardList}
              tone="slate"
              active={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
            />
            <DashboardStatCard
              label="Active"
              value={data?.active}
              icon={Clock3}
              tone="amber"
              active={statusFilter === 'active'}
              onClick={() => setStatusFilter('active')}
            />
            <DashboardStatCard
              label="Closed"
              value={data?.closed}
              icon={XCircle}
              tone="green"
              active={statusFilter === 'closed'}
              onClick={() => setStatusFilter('closed')}
            />
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Permits by company</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Select a status card to filter companies. Active includes Not Closed and Not Start
                  Yet permits. Each PTW number is counted once using its most recently updated
                  record across imports and the current register.
                </p>
              </div>
              <label className="relative block w-full sm:max-w-xs">
                <span className="sr-only">Filter companies</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={companySearch}
                  onChange={(event) => setCompanySearch(event.target.value)}
                  placeholder="Search companies…"
                  className="pl-9"
                />
              </label>
            </div>

            {isLoading && !data ? (
              <EmptyState title="Loading dashboard…" />
            ) : data?.byCompany.length ? (
              <CompanyStatsTable
                companies={companies}
                onExport={exportCompany}
                exportingKey={exportingKey}
              />
            ) : (
              <EmptyState title="No permits in the current register">
                Import a workbook or add permits to see company statistics.
              </EmptyState>
            )}
          </section>
        </>
      )}
    </div>
  );
}
