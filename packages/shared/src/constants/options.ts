/**
 * Dropdown option lists taken from the "Master PTW Tracking Register" Excel template.
 * Every list is the single source of truth for the UI, API validation and Excel export.
 */
export const DEPARTMENTS = ['Construction', 'Commissioning'] as const;

export const MAIN_CONTRACTORS = ['JV-TR/NMDC'] as const;
export const DAILY_SHIFTS = ['Day', 'Night'] as const;
export const DAILY_PTW_STATUSES = ['Live', 'Suspended'] as const;

export const APPROVAL_CONTACT_ROLES = [
  'performingAuthority',
  'validationBy',
  'approvedBy',
] as const;
export type ApprovalContactRole = (typeof APPROVAL_CONTACT_ROLES)[number];

export const AUTHORIZATION_LIST_DROPDOWN_FIELDS = [
  { key: 'position', header: 'Position' },
  { key: 'wmsRole', header: 'WMS Role' },
  { key: 'instituteName', header: 'Institute Name' },
] as const;

export const AUTHORIZATION_STATUS_OPTIONS = ['Active', 'Inactive'] as const;
export const PROCESS_RESTRICTION_OPTIONS = ['Y', 'N', 'NC'] as const;
export const HAZARDOUS_AREA_OPTIONS = [
  'Process / Restricted',
  'Non-Process / Unrestricted',
] as const;
export const H2S_ZONE_OPTIONS = ['R', 'A', 'Y', 'NC'] as const;
export const HAC_ZONE_OPTIONS = ['0', '1', '2', 'NC'] as const;
export const DUST_ZONE_OPTIONS = ['20', '21', '22', 'NC'] as const;

export const SUB_CONTRACTORS = [
  'OQC',
  'INCOL',
  'CYLINGAS',
  'DOUGLAS OHI',
  'TARGET',
  'AG POWER',
  'PETROJECT PKG4',
  'PETROJECT-LLP',
  'PENTA GLOBAL',
  'NBTC',
  'SINOPEC5TH',
  'GRANITE',
  'GERMAN GULF',
  'NMDC INFRA',
  'AL SHOUMUKH',
  'BORGE',
  'CANAL',
  'DESCON',
  'SINOPIC H.L',
  'STECON',
  'TARGET-PL',
  'JV-TR/NMDC',
] as const;

export const DISCIPLINES = [
  'Electrical',
  'Instrument',
  'Telecom',
  'Civil',
  'Piping',
  'Equipments',
  'Steel Structure',
  'Lifting',
  'Mechanical',
  'Pipeline',
] as const;

export const PTW_TYPES = [
  'General Work Permit (GWP)',
  'Critical Work Permit (CWP)',
  'Hot Work Permit (HWP)',
] as const;

export const CERTIFICATE_TYPES = [
  'Atmospheric Test Record Form',
  'Confined Space Entry Certificate',
  'Diving Certificate',
  'Easement Certificate',
  'Excavation Certificate',
  'Ionization Radiation Certificate',
  'Road Closure Certificate',
  'Temporary Defeat Certificate',
  'Vehicle and Machine Entry Certificate',
] as const;

export const PLANT_DIVISIONS = [
  'Habshan 5 Green Field',
  'Habshan 5 Green Field Plus',
  'Habshan Complex Green Field Plus',
  'Habshan 5 Brown Field',
  'Ruwais NGL Green Field Plus',
] as const;

export const YES_NO = ['Yes', 'No'] as const;

export const PTW_STATUSES = ['Not Closed', 'Closed'] as const;
export const PERMIT_STATUS_FILTERS = ['Active', 'Closed', 'Overdue'] as const;

export const WORK_PLANNING_TYPES = ['Planned', 'Emergency'] as const;

export const PTWC_STATUS_OPTIONS = ['Approved', 'Rejected'] as const;
export const PTWC_APPROVER_NAME = 'Muhammad Sajid';

export const USER_ROLES = ['admin', 'user'] as const;
export type Role = (typeof USER_ROLES)[number];

/**
 * Legacy / misspelled values that may appear in older spreadsheets.
 * Keys must be lowercase. Used by the Excel importer to normalise values.
 */
export const OPTION_ALIASES: Readonly<Record<string, string>> = {
  commisioing: 'Commissioning',
  commisioning: 'Commissioning',
  'steel structures': 'Steel Structure',
  equipment: 'Equipments',
  'not start yet': 'Not Closed',
};
