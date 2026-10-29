import {
  CERTIFICATE_TYPES,
  DEPARTMENTS,
  DISCIPLINES,
  PLANT_DIVISIONS,
  PTW_STATUSES,
  PTW_TYPES,
  YES_NO,
} from './options';

export type FieldType = 'text' | 'textarea' | 'date' | 'select' | 'multiselect';

export type FormSection = 'registration' | 'permit' | 'location' | 'validity' | 'approval';

export interface PermitFieldDef {
  /** Property name used in the API, database and forms. */
  readonly key: string;
  /** Column header – must match the Excel template exactly. */
  readonly header: string;
  readonly type: FieldType;
  readonly section: FormSection;
  /** Excel column width (characters). */
  readonly width: number;
  readonly required?: boolean;
  readonly options?: readonly string[];
  readonly maxLength?: number;
  /** Shown as a column in the register table. */
  readonly inTable?: boolean;
  /** Spans the full width of the form grid. */
  readonly fullWidth?: boolean;
}

/**
 * The order of this array is the column order of the Excel register
 * (column A is the system-managed "Sr No").
 */
export const PERMIT_FIELDS = [
  {
    key: 'closedDate',
    header: 'Closed Date',
    type: 'date',
    section: 'registration',
    width: 16,
    inTable: true,
  },
  {
    key: 'company',
    header: 'Company',
    type: 'text',
    section: 'registration',
    width: 18,
    required: true,
    inTable: true,
  },
  {
    key: 'department',
    header: 'Department',
    type: 'select',
    section: 'registration',
    width: 16,
    options: DEPARTMENTS,
    inTable: true,
  },
  {
    key: 'discipline',
    header: 'Discipline',
    type: 'select',
    section: 'registration',
    width: 16,
    options: DISCIPLINES,
    inTable: true,
  },
  {
    key: 'workActivity',
    header: 'Work Description',
    type: 'textarea',
    section: 'registration',
    width: 34,
    maxLength: 1000,
    fullWidth: true,
  },
  {
    key: 'previousPtwType',
    header: 'Previous PTW Type',
    type: 'select',
    section: 'permit',
    width: 28,
    options: PTW_TYPES,
  },
  {
    key: 'previousPtwNumber',
    header: 'Previous PTW Number',
    type: 'text',
    section: 'permit',
    width: 22,
  },
  {
    key: 'newPtwType',
    header: 'New PTW Type',
    type: 'select',
    section: 'permit',
    width: 28,
    options: PTW_TYPES,
    inTable: true,
  },
  {
    key: 'newPtwNumber',
    header: 'New PTW Number',
    type: 'text',
    section: 'permit',
    width: 22,
    inTable: true,
  },
  {
    key: 'certificateType',
    header: 'Certificate Types',
    type: 'multiselect',
    section: 'permit',
    width: 36,
    options: CERTIFICATE_TYPES,
    fullWidth: true,
  },
  {
    key: 'plantDivision',
    header: 'Plant/Division',
    type: 'select',
    section: 'location',
    width: 24,
    options: PLANT_DIVISIONS,
    inTable: true,
  },
  { key: 'workLocation', header: 'Work Location', type: 'text', section: 'location', width: 24 },
  {
    key: 'equipmentTagNo',
    header: 'Equipment Tag No',
    type: 'text',
    section: 'location',
    width: 22,
  },
  {
    key: 'planValidStartDate',
    header: 'Plan Valid Start Date',
    type: 'date',
    section: 'validity',
    width: 18,
    inTable: true,
  },
  {
    key: 'planValidEndDate',
    header: 'Plan Valid End Date',
    type: 'date',
    section: 'validity',
    width: 18,
    inTable: true,
  },
  {
    key: 'receivedDraft',
    header: 'Received Draft',
    type: 'select',
    section: 'approval',
    width: 14,
    options: YES_NO,
  },
  {
    key: 'receivedApproved',
    header: 'Received Approved',
    type: 'select',
    section: 'approval',
    width: 16,
    options: YES_NO,
  },
  {
    key: 'approvedByPtwc',
    header: 'Approved by PTWC',
    type: 'text',
    section: 'approval',
    width: 22,
  },
  {
    key: 'closedByJvPtwCoordinator',
    header: 'Closed By JV PTW Coordinator',
    type: 'select',
    section: 'approval',
    width: 22,
    options: YES_NO,
  },
  {
    key: 'status',
    header: 'Status',
    type: 'select',
    section: 'approval',
    width: 14,
    options: PTW_STATUSES,
    inTable: true,
  },
  {
    key: 'receivedOriginalClosedPtw',
    header: 'Received Original Closed PTW',
    type: 'select',
    section: 'approval',
    width: 22,
    options: YES_NO,
  },
  {
    key: 'locationOfClosedPtw',
    header: 'Location of Closed PTW',
    type: 'text',
    section: 'approval',
    width: 26,
  },
] as const satisfies readonly PermitFieldDef[];

export type PermitFieldKey = (typeof PERMIT_FIELDS)[number]['key'];
export type PermitDateFieldKey = Extract<(typeof PERMIT_FIELDS)[number], { type: 'date' }>['key'];

export const PERMIT_FIELD_LIST: readonly PermitFieldDef[] = PERMIT_FIELDS;

export const FORM_SECTIONS: ReadonlyArray<{ id: FormSection; title: string }> = [
  { id: 'registration', title: 'Registration' },
  { id: 'permit', title: 'Permit Details' },
  { id: 'location', title: 'Plant & Location' },
  { id: 'validity', title: 'Plan Validity' },
  { id: 'approval', title: 'Approval & Closure' },
];

export const REGISTER_TITLE = 'MASTER PTW TRACKING REGISTER - ONLINE';
export const SR_NO_HEADER = 'Sr No';
