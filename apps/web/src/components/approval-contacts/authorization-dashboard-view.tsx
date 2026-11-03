'use client';

import useSWR from 'swr';
import type { ApprovalContactStatsDTO } from '@wms/shared';
import { DashboardStatCard } from '@/components/dashboard/dashboard-stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { swrFetcher } from '@/lib/api-client';
import { UserCheck, UserRound, UserX } from 'lucide-react';

export function AuthorizationDashboardView() {
  const { data, error } = useSWR<ApprovalContactStatsDTO>(
    '/api/approval-contacts/stats',
    swrFetcher,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Authorized People Dashboard"
        description="Overview of authorized people and their current status."
      />

      {error ? (
        <EmptyState title="Could not load authorization totals">{error.message}</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <DashboardStatCard
            label="Total authorized"
            value={data?.total}
            icon={UserRound}
            tone="blue"
          />
          <DashboardStatCard
            label="Active"
            value={data?.active}
            icon={UserCheck}
            tone="green"
          />
          <DashboardStatCard
            label="Deactive"
            value={data?.inactive}
            icon={UserX}
            tone="slate"
          />
        </div>
      )}
    </div>
  );
}
