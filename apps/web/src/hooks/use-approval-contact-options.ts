import useSWR from 'swr';
import type { ApprovalContactOptionDTO } from '@wms/shared';
import { swrFetcher } from '@/lib/api-client';

export function useApprovalContactOptions() {
  return useSWR<ApprovalContactOptionDTO[]>('/api/approval-contacts/options', swrFetcher);
}
