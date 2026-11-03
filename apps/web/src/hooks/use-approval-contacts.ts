import useSWR from 'swr';
import type { ApprovalContactDTO, Paginated } from '@wms/shared';
import { swrFetcher, toQueryString } from '@/lib/api-client';

export interface ApprovalContactFilters {
  search: string;
  position: string;
  wmsRole: string;
}

export function useApprovalContacts(
  page: number,
  limit = 20,
  filters: ApprovalContactFilters = { search: '', position: '', wmsRole: '' },
) {
  return useSWR<Paginated<ApprovalContactDTO>>(
    `/api/approval-contacts${toQueryString({ page, limit, ...filters })}`,
    swrFetcher,
    { keepPreviousData: true },
  );
}
