import {
  CERTIFICATE_TYPES,
  DEPARTMENTS,
  DISCIPLINES,
  MAIN_CONTRACTORS,
  PLANT_DIVISIONS,
  PTW_STATUSES,
  PTW_TYPES,
  YES_NO,
  WORK_PLANNING_TYPES,
  SUB_CONTRACTORS,
} from './options';

export type FieldType =
  'text' | 'textarea' | 'date' | 'select' | 'radio' | 'multiselect' | 'computed';

export type FormSection = 'planning' | 'validity' | 'closure';

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
  readonly defaultValue?: string;
  readonly fixedValue?: string;
  /** Shown as a column in the register table. */
  readonly inTable?: boolean;
  /** Spans the full width of the form grid. */
  readonly fullWidth?: boolean;
}

/**
 * The order of this array controls the form, register table and Excel columns.
 * Excel column A is the system-managed "Sr No".
 */
export const PERMIT_FIELDS = [
  {
    key: 'projectNumber',
    header: 'Meram Project No',
    type: 'text',
    section: 'planning',
    width: 18,
    required: true,
    fixedValue: '1000482',
    inTable: true,
  },
  {
    key: 'plantDivision',
    header: 'Plant/Division',
    type: 'select',
    section: 'planning',
    width: 24,
    options: PLANT_DIVISIONS,
    inTable: true,
  },
  {
    key: 'company',
    header: 'Main Contractor',
    type: 'select',
    section: 'planning',
    width: 22,
    required: true,
    options: MAIN_CONTRACTORS,
    defaultValue: MAIN_CONTRACTORS[0],
    inTable: true,
  },
  {
    key: 'subContractor',
    header: 'Sub Contractor',
    type: 'select',
    section: 'planning',
    width: 22,
    options: SUB_CONTRACTORS,
    inTable: true,
  },
  {
    key: 'department',
    header: 'Department',
    type: 'select',
    section: 'planning',
    width: 16,
    options: DEPARTMENTS,
    inTable: true,
  },
  {
    key: 'discipline',
    header: 'Discipline',
    type: 'select',
    section: 'planning',
    width: 16,
    options: DISCIPLINES,
    inTable: true,
  },
  {
    key: 'plannedWorkers',
    header: 'Planned No. of Workers',
    type: 'text',
    section: 'planning',
    width: 18,
    inTable: true,
  },
  {
    key: 'workPlanningIwap',
    header: 'Work Planning IWAP',
    type: 'select',
    section: 'planning',
    width: 20,
    options: WORK_PLANNING_TYPES,
    inTable: true,
  },
  {
    key: 'plannedSimops',
    header: 'Planned SIMOPS',
    type: 'radio',
    section: 'planning',
    width: 18,
    options: YES_NO,
    inTable: true,
  },
  {
    key: 'ptwEndorsementRequired',
    header: 'PTW Endorsement Required',
    type: 'radio',
    section: 'planning',
    width: 22,
    options: YES_NO,
    inTable: true,
  },
  {
    key: 'workActivity',
    header: 'Work Description',
    type: 'textarea',
    section: 'planning',
    width: 34,
    maxLength: 1000,
    fullWidth: true,
    inTable: true,
  },
  {
    key: 'workEquipmentDetails',
    header: 'Work Equipment Details',
    type: 'textarea',
    section: 'planning',
    width: 30,
    maxLength: 1000,
    fullWidth: true,
    inTable: true,
  },
  {
    key: 'workLocation',
    header: 'Work Location',
    type: 'text',
    section: 'planning',
    width: 24,
    inTable: true,
  },
  {
    key: 'equipmentTagNo',
    header: 'Equipment Tag No',
    type: 'text',
    section: 'planning',
    width: 22,
    inTable: true,
  },
  {
    key: 'previousPtwType',
    header: 'Previous PTW Type',
    type: 'select',
    section: 'planning',
    width: 28,
    options: PTW_TYPES,
    inTable: true,
  },
  {
    key: 'previousPtwNumber',
    header: 'Previous PTW Number',
    type: 'text',
    section: 'planning',
    width: 22,
    inTable: true,
  },
  {
    key: 'newPtwType',
    header: 'New PTW Type',
    type: 'select',
    section: 'planning',
    width: 28,
    options: PTW_TYPES,
    inTable: true,
  },
  {
    key: 'newPtwNumber',
    header: 'New PTW Number',
    type: 'text',
    section: 'planning',
    width: 22,
    inTable: true,
  },
  {
    key: 'certificateType',
    header: 'Certificate Types',
    type: 'multiselect',
    section: 'planning',
    width: 36,
    options: CERTIFICATE_TYPES,
    fullWidth: true,
    inTable: true,
  },
  {
    key: 'planValidStartDate',
    header: 'Planned Start Date',
    type: 'date',
    section: 'validity',
    width: 18,
    required: true,
    inTable: true,
  },
  {
    key: 'planValidEndDate',
    header: 'Planned End Date',
    type: 'date',
    section: 'validity',
    width: 18,
    required: true,
    inTable: true,
  },
  {
    key: 'ptwValidity',
    header: 'PTW Validity',
    type: 'computed',
    section: 'validity',
    width: 16,
    inTable: true,
  },
  {
    key: 'receivedDraft',
    header: 'Received Draft',
    type: 'radio',
    section: 'validity',
    width: 14,
    options: YES_NO,
    inTable: true,
  },
  {
    key: 'receivedApproved',
    header: 'Received Approved',
    type: 'radio',
    section: 'validity',
    width: 16,
    options: YES_NO,
    inTable: true,
  },
  {
    key: 'approvedByPtwc',
    header: 'Approved by PTWC',
    type: 'text',
    section: 'validity',
    width: 22,
    inTable: true,
  },
  {
    key: 'closedDate',
    header: 'PTW Closed Date',
    type: 'date',
    section: 'validity',
    width: 16,
    inTable: true,
  },
  {
    key: 'closedByJvPtwCoordinator',
    header: 'Closed By JV PTW Coordinator',
    type: 'radio',
    section: 'closure',
    width: 22,
    options: YES_NO,
    inTable: true,
  },
  {
    key: 'status',
    header: 'Status',
    type: 'radio',
    section: 'closure',
    width: 14,
    options: PTW_STATUSES,
    inTable: true,
  },
  {
    key: 'receivedOriginalClosedPtw',
    header: 'Received Closed PTW (Hard Copy)',
    type: 'radio',
    section: 'closure',
    width: 22,
    options: YES_NO,
    inTable: true,
  },
  {
    key: 'receivedOriginalClosedPtwSoftCopy',
    header: 'Received Closed PTW (Soft Copy)',
    type: 'radio',
    section: 'closure',
    width: 22,
    options: YES_NO,
    inTable: true,
  },
  {
    key: 'locationOfClosedPtw',
    header: 'Location of Closed PTW',
    type: 'text',
    section: 'closure',
    width: 26,
    inTable: true,
  },
  {
    key: 'remarks',
    header: 'Remarks',
    type: 'textarea',
    section: 'closure',
    width: 34,
    maxLength: 1000,
    fullWidth: true,
    inTable: true,
  },
] as const satisfies readonly PermitFieldDef[];

export type PermitFieldKey = (typeof PERMIT_FIELDS)[number]['key'];
export type PermitDateFieldKey = Extract<(typeof PERMIT_FIELDS)[number], { type: 'date' }>['key'];

export const PERMIT_FIELD_LIST: readonly PermitFieldDef[] = PERMIT_FIELDS;

export const FORM_SECTIONS: ReadonlyArray<{ id: FormSection; title: string }> = [
  { id: 'planning', title: 'SECTION-1 PTW PLANNING & REQUEST' },
  { id: 'validity', title: 'SECTION-2 PTW APPROVAL' },
  { id: 'closure', title: 'SECTION-3 PTW CLOSURE' },
];

export const REGISTER_TITLE = 'MASTER PTW TRACKING REGISTER - ONLINE';
export const SR_NO_HEADER = 'Sr No';
