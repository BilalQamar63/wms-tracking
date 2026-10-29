import useSWR from 'swr';
import type { Paginated, PermitDTO } from '@wms/shared';
import { swrFetcher, toQueryString } from '@/lib/api-client';

export interface PermitFilterState {
  search: string;
  status: string;
  department: string;
  discipline: string;
  plantDivision: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_PERMIT_FILTERS: PermitFilterState = {
  search: '',
  status: '',
  department: '',
  discipline: '',
  plantDivision: '',
  dateFrom: '',
  dateTo: '',
};

export function usePermits(
  filters: PermitFilterState,
  page: number,
  limit = 20,
  batchId?: string | null,
) {
  const query = toQueryString({ ...filters, page, limit, batchId });
  return useSWR<Paginated<PermitDTO>>(`/api/permits${query}`, swrFetcher, {
    keepPreviousData: true,
  });
}
