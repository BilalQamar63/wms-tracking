import useSWR from 'swr';
import type { FileKind, FileRecordDTO, Paginated } from '@wms/shared';
import { swrFetcher, toQueryString } from '@/lib/api-client';

export interface FileFilterState {
  kind: FileKind | '';
  dateFrom: string;
  dateTo: string;
}

export function useFiles(filters: FileFilterState, page: number, limit = 20) {
  const query = toQueryString({ ...filters, page, limit });
  return useSWR<Paginated<FileRecordDTO>>(`/api/files${query}`, swrFetcher, {
    keepPreviousData: true,
  });
}
