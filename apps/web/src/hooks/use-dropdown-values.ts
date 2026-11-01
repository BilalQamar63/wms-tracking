import useSWR from 'swr';
import type { PermitDropdownValues } from '@/services/dropdown-values.service';
import { swrFetcher } from '@/lib/api-client';

export function useDropdownValues(enabled = true) {
  return useSWR<PermitDropdownValues>(enabled ? '/api/dropdown-values' : null, swrFetcher);
}
