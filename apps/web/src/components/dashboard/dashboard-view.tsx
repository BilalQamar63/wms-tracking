'use client';

import { useMemo, useState } from 'react';
import { Building2, ClipboardList, Clock3, Users, XCircle } from 'lucide-react';
import useSWR from 'swr';
import { PTW_TYPES, type PermitDashboardStatsDTO, type PermitFieldKey } from '@wms/shared';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ExcelFieldPicker, ALL_FIELD_KEYS } from '@/components/ui/excel-field-picker';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { EMPTY_PERMIT_FILTERS, type PermitFilterState } from '@/hooks/use-permits';
import { useDebounce } from '@/hooks/use-debounce';
import { downloadFromApi, swrFetcher, toQueryString } from '@/lib/api-client';
import { PermitFilters } from '../permits/permit-filters';
import { ContractorStatsTable } from './contractor-stats-table';
import { DashboardStatCard } from './dashboard-stat-card';

type ContractorStatusFilter = 'all' | 'active' | 'closed' | 'overdue';
type CompanyExportStatus = ContractorStatusFilter;
type CompanySelection = { mainContractor: string; subContractor: string };

const EXPORT_STATUS_OPTIONS = [
  { value: 'all', label: 'All permits' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'overdue', label: 'Overdue' },
] as const;

export function DashboardView() {
  const toast = useToast();
  const [filters, setFilters] = useState<PermitFilterState>(EMPTY_PERMIT_FILTERS);
  const [statusFilter, setStatusFilter] = useState<ContractorStatusFilter>('all');
  const [selectedFields, setSelectedFields] = useState<PermitFieldKey[]>(ALL_FIELD_KEYS);
  const [selectedPtwTypes, setSelectedPtwTypes] = useState<string[]>([...PTW_TYPES]);
  const [exportStatus, setExportStatus] = useState<CompanyExportStatus>('all');
  const [selectedCompany, setSelectedCompany] = useState<CompanySelection | null>(null);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const debouncedSearch = useDebounce(filters.search);
  const effectiveFilters = { ...filters, search: debouncedSearch };
  const statsUrl = `/api/dashboard/stats${toQueryString(effectiveFilters)}`;
  const { data, error, isLoading } = useSWR<PermitDashboardStatsDTO>(statsUrl, swrFetcher);

  async function exportContractor(
    company: CompanySelection,
    status = exportStatus,
    fields = selectedFields,
    ptwTypes = selectedPtwTypes,
  ) {
    const key = `${company.mainContractor}|${company.subContractor}`;
    setExportingKey(key);
    try {
      const fileName = await downloadFromApi(
        `/api/dashboard/export${toQueryString({
          ...effectiveFilters,
          status: '',
          ptwType: '',
          mainContractor: company.mainContractor,
          rowSubContractor: company.subContractor,
          exportStatus: status,
          fields: fields.join(','),
          ptwTypes: ptwTypes.join(','),
        })}`,
        `PTW-${company.mainContractor}-${company.subContractor}-${status}.xlsx`,
      );
      toast.success(`Exported ${fileName}`);
      setSelectedCompany(null);
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
        if (statusFilter === 'overdue' && contractor.overdue === 0) return false;
        return true;
      }),
    [data?.byContractor, statusFilter],
  );

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="MERAM MASTER PTW DASHBOARD"
          description="Overview of permits grouped by Main Contractor and Sub Contractor."
        />

        {error ? (
          <EmptyState title="Could not load dashboard">{error.message}</EmptyState>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
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
              <DashboardStatCard
                label="Overdue"
                value={data?.overdue}
                icon={XCircle}
                tone="red"
                active={statusFilter === 'overdue'}
                onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
              />
            </div>

            {data && (
              <section className="flex flex-col items-center gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row">
                <div
                  role="img"
                  aria-label={`Permit status chart: ${data.active} active, ${data.closed} closed, ${data.overdue} overdue`}
                  className="relative h-48 w-48 shrink-0 rounded-full"
                  style={{
                    background:
                      data.total === 0
                        ? '#e2e8f0'
                        : `conic-gradient(#f59e0b 0% ${((data.active / data.total) * 100).toFixed(2)}%, #10b981 ${((data.active / data.total) * 100).toFixed(2)}% ${(((data.active + data.closed) / data.total) * 100).toFixed(2)}%, #ef4444 ${(((data.active + data.closed) / data.total) * 100).toFixed(2)}% 100%)`,
                  }}
                >
                  <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-white">
                    <span className="text-3xl font-semibold text-slate-900">{data.total}</span>
                    <span className="text-sm text-slate-500">Permits</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <h2 className="text-base font-semibold text-slate-900">Permit status</h2>
                  {[
                    { label: 'Active', value: data.active, color: 'bg-amber-500' },
                    { label: 'Closed', value: data.closed, color: 'bg-emerald-500' },
                    { label: 'Overdue', value: data.overdue, color: 'bg-red-500' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <span className={`h-3 w-3 rounded-full ${item.color}`} />
                      <span>{item.label}</span>
                      <span className="font-semibold tabular-nums">{item.value}</span>
                      <span className="text-slate-500">
                        ({data.total ? Math.round((item.value / data.total) * 100) : 0}%)
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Permits by Main Contractor and Sub Contractor
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Use the filters to narrow permits. Expired, unclosed permits are overdue.
                    </p>
                  </div>
                </div>
              </div>

              <PermitFilters value={filters} onChange={setFilters} />

              {isLoading && !data ? (
                <EmptyState title="Loading dashboard…" />
              ) : data ? (
                <ContractorStatsTable
                  contractors={contractors}
                  onExport={(mainContractor, subContractor) => {
                    setSelectedCompany({ mainContractor, subContractor });
                    setExportStatus('all');
                    setSelectedFields(ALL_FIELD_KEYS);
                    setSelectedPtwTypes([...PTW_TYPES]);
                  }}
                  exportingKey={exportingKey}
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
      <Modal
        open={selectedCompany !== null}
        title="Export contractor permits"
        description={
          selectedCompany
            ? `${selectedCompany.mainContractor} · ${selectedCompany.subContractor}`
            : undefined
        }
        onClose={() => {
          if (!exportingKey) setSelectedCompany(null);
        }}
        size="xl"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={exportingKey !== null}
              onClick={() => setSelectedCompany(null)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              loading={exportingKey !== null}
              disabled={!selectedCompany || exportingKey !== null}
              onClick={() =>
                selectedCompany &&
                exportContractor(selectedCompany, 'all', ALL_FIELD_KEYS, [...PTW_TYPES])
              }
            >
              Download full Excel
            </Button>
            <Button
              loading={exportingKey !== null}
              disabled={
                !selectedCompany ||
                exportingKey !== null ||
                selectedFields.length === 0 ||
                selectedPtwTypes.length === 0
              }
              onClick={() => selectedCompany && exportContractor(selectedCompany)}
            >
              Download selected
            </Button>
          </>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-4">
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-800">Permit status</span>
              <Select
                options={EXPORT_STATUS_OPTIONS}
                value={exportStatus}
                onChange={(event) => setExportStatus(event.target.value as CompanyExportStatus)}
              />
            </label>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">Excel fields</h3>
              <ExcelFieldPicker
                selectedFields={selectedFields}
                onChange={setSelectedFields}
                expanded
              />
            </div>
          </div>
          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold text-slate-800">PTW types</legend>
            <div className="mb-3 flex justify-between gap-2">
              <button
                type="button"
                className="text-xs font-medium text-brand-700 hover:text-brand-900"
                onClick={() => setSelectedPtwTypes([...PTW_TYPES])}
              >
                Select all
              </button>
              <button
                type="button"
                className="text-xs font-medium text-brand-700 hover:text-brand-900"
                onClick={() => setSelectedPtwTypes([])}
              >
                Clear
              </button>
            </div>
            <div className="space-y-3">
              {PTW_TYPES.map((ptwType) => (
                <label key={ptwType} className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedPtwTypes.includes(ptwType)}
                    onChange={() =>
                      setSelectedPtwTypes((current) =>
                        current.includes(ptwType)
                          ? current.filter((value) => value !== ptwType)
                          : [...current, ptwType],
                      )
                    }
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                  />
                  <span>{ptwType}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Modal>
    </>
  );
}
