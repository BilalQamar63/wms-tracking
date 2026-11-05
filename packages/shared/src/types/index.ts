import type { DailyRegisterFieldKey } from '../constants/daily-register-fields';
import type { PermitFieldKey } from '../constants/permit-fields';
import type { Role } from '../constants/options';
import type { ApprovalContactInput } from '../schemas/approval-contact.schema';

export interface ApprovalContactDTO {
  id: string;
  srNo: string;
  approvalFormNo: string;
  company: string;
  name: string;
  emiratesId: string;
  phone: string;
  position: string;
  wmsRole: string;
  instituteName: string;
  jvAssessmentDate: string;
  wmsValidity: string;
  status: string;
  remarks: string;
  displayValue: string;
}

export interface ApprovalContactOptionDTO {
  id: string;
  name: string;
  phone: string;
  wmsRole: string;
  displayValue: string;
}

export interface ApprovalContactImportChange {
  key: keyof Omit<ApprovalContactDTO, 'id' | 'displayValue'>;
  label: string;
  oldValue: string;
  newValue: string;
}

export interface ApprovalContactImportRow {
  rowNumber: number;
  action: 'add' | 'update' | 'unchanged';
  name: string;
  emiratesId: string;
  expectedUpdatedAt: string | null;
  changes: ApprovalContactImportChange[];
}

export interface ApprovalContactImportRecord {
  rowNumber: number;
  data: ApprovalContactInput;
  expectedContactId: string | null;
  expectedUpdatedAt: string | null;
}

export interface ApprovalContactImportPreview {
  fileName: string;
  totalRows: number;
  records: ApprovalContactImportRecord[];
  rows: ApprovalContactImportRow[];
  errors: ImportRowError[];
  counts: { added: number; updated: number; unchanged: number };
}

export interface ApprovalContactImportResult {
  added: number;
  updated: number;
  unchanged: number;
  skipped: number;
}

export interface ApprovalContactHistoryDTO {
  id: string;
  kind: 'import' | 'export';
  fileName: string;
  bytes: number;
  rowCount: number;
  added?: number;
  updated?: number;
  unchanged?: number;
  skipped?: number;
  createdBy?: UserRef;
  createdAt: string;
}

export interface ApprovalContactStatsDTO {
  total: number;
  active: number;
  inactive: number;
}

/** Form / API payload; dates are `YYYY-MM-DD`, and certificates can be selected in multiples. */
export type PermitInput = {
  [K in PermitFieldKey]?: K extends 'certificateType' ? string[] : string;
};

export interface UserRef {
  id: string;
  name: string;
  isDeleted: boolean;
  assignedSubContractor?: string;
}

export interface PermitDTO extends PermitInput {
  id: string;
  srNo: number;
  createdBy?: UserRef;
  updatedBy?: UserRef;
  createdAt: string;
  updatedAt: string;
}

export type DailyRegisterInput = Partial<Record<DailyRegisterFieldKey, string>>;

export interface DailyRegisterDTO extends DailyRegisterInput {
  id: string;
  date: string;
  srNo: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyRegisterPermitOptionDTO {
  permitNumber: string;
  data: DailyRegisterInput;
}

export interface DailyRegisterSummaryDTO {
  total: number;
  day: number;
  night: number;
  live: number;
  suspended: number;
}

export interface DailyRegisterDateNavigationDTO {
  previousDate: string | null;
  nextDate: string | null;
}

export interface DailyRegisterDateGroupDTO {
  date: string;
  total: number;
  day: number;
  night: number;
  live: number;
  suspended: number;
}

export interface DailyRegisterDashboardFiltersDTO {
  ptwNumber?: string;
  ptwType?: string;
  subContractor?: string;
  shiftDayNight?: string;
  ptwStatus?: string;
}

export interface DailyRegisterDashboardFilterOptionsDTO {
  ptwTypes: string[];
  subContractors: string[];
  shifts: string[];
  ptwStatuses: string[];
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
  assignedSubContractor?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  /** Number of permit records owned by the user. */
  permitCount?: number;
}

export type SessionUser = Pick<UserDTO, 'id' | 'name' | 'email' | 'role' | 'assignedSubContractor'>;

export type FileKind = 'import' | 'export' | 'add';

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
  dailyDate?: string;
  stats?: ImportStats;
  subContractors?: string[];
  importedPermits?: Array<{
    srNo: number;
    newPtwNumber?: string;
    subContractor?: string;
  }>;
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
  mainContractor: string;
  subContractor: string;
  total: number;
  active: number;
  closed: number;
  overdue: number;
}

export interface PermitDashboardStatsDTO {
  total: number;
  mainContractors: number;
  subContractors: number;
  active: number;
  closed: number;
  overdue: number;
  byContractor: CompanyPermitStatsDTO[];
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
