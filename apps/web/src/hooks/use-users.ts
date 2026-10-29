import useSWR from 'swr';
import type { UserDTO } from '@wms/shared';
import { swrFetcher } from '@/lib/api-client';

export function useUsers() {
  return useSWR<UserDTO[]>('/api/users', swrFetcher);
}
