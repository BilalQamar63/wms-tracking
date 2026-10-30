import type { PermitFieldKey } from '../constants/permit-fields';
import type { Role } from '../constants/options';

/** Form / API payload; dates are `YYYY-MM-DD`, and certificates can be selected in multiples. */
export type PermitInput = {
  [K in PermitFieldKey]?: K extends 'certificateType' ? string[] : string;
};

export interface UserRef {
  id: string;
  name: string;
  isDeleted: boolean;
}

export interface PermitDTO extends PermitInput {
  id: string;
  srNo: number;
  createdBy?: UserRef;
  updatedBy?: UserRef;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  /** Number of permit records owned by the user. */
  permitCount?: number;
}

export type SessionUser = Pick<UserDTO, 'id' | 'name' | 'email' | 'role'>;

export type FileKind = 'import' | 'export';

export interface ImportStats {
  total: number;
  inserted: number;
  updated: number;
  failed: number;
}

export interface ImportRowError {
  row: number;
  messages: string[];
}

export interface FileRecordDTO {
  id: string;
  kind: FileKind;
  originalName: string;
  bytes: number;
  rowCount: number;
  stats?: ImportStats;
  errors?: ImportRowError[];
  createdBy?: UserRef;
  createdAt: string;
}

export interface ImportResultDTO {
  file: FileRecordDTO;
  stats: ImportStats;
  errors: ImportRowError[];
}

export interface ImportPreviewFieldDTO {
  key: string;
  header: string;
  type: string;
  oldValue: string | string[] | null;
  newValue: string | string[] | null;
}

export interface ImportPreviewRowDTO {
  rowNumber: number;
  action: 'update' | 'add';
  newPtwNumber?: string;
  existingSrNo?: number;
  fields: ImportPreviewFieldDTO[];
}

export interface ImportPreviewDTO {
  fileName: string;
  totalRows: number;
  rows: ImportPreviewRowDTO[];
  errors: ImportRowError[];
}

export interface ImportFieldApproval {
  rowNumber: number;
  fields: Array<{
    key: string;
    expectedOldValue: string | string[] | null;
  }>;
}

export interface PermitImportBatchDTO {
  id: string;
  originalName: string;
  createdAt: string;
  total: number;
  closed: number;
  available: boolean;
  stats?: ImportStats;
}

export interface PermitImportDayDTO {
  date: string;
  total: number;
  closed: number;
  batches: PermitImportBatchDTO[];
}

export interface PermitRegisterSummaryDTO {
  total: number;
  active: number;
  closed: number;
  notClosed: number;
  updatedAt: string | null;
}

export interface CompanyPermitStatsDTO {
  company: string;
  total: number;
  active: number;
  closed: number;
}

export interface PermitDashboardStatsDTO {
  total: number;
  companies: number;
  active: number;
  closed: number;
  byCompany: CompanyPermitStatsDTO[];
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
