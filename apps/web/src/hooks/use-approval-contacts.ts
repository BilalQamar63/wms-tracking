import useSWR from 'swr';
import type { ApprovalContactDTO } from '@wms/shared';
import { swrFetcher } from '@/lib/api-client';

export function useApprovalContacts() {
  return useSWR<ApprovalContactDTO[]>('/api/approval-contacts', swrFetcher);
}
