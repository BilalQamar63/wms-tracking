import useSWR from 'swr';
import type { ApprovalContactDTO } from '@wms/shared';
import { swrFetcher, toQueryString } from '@/lib/api-client';

export function useApprovalContacts(subContractor?: string, enabled = true) {
  const url = subContractor
    ? `/api/approval-contacts${toQueryString({ subContractor })}`
    : '/api/approval-contacts';
  return useSWR<ApprovalContactDTO[]>(enabled ? url : null, swrFetcher);
}
