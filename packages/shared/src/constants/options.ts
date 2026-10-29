/**
 * Dropdown option lists taken from the "Master PTW Tracking Register" Excel template.
 * Every list is the single source of truth for the UI, API validation and Excel export.
 */
export const DEPARTMENTS = ['Construction', 'Commissioning'] as const;

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

export const PLANT_DIVISIONS = ['Habshan 5 Green Field', 'Habshan 5 Brown Field'] as const;

export const YES_NO = ['Yes', 'No'] as const;

export const PTW_STATUSES = ['Not Start Yet', 'Not Closed', 'Closed'] as const;

export const DEFAULT_PTWC_APPROVER = 'Muhammad Sajid';

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
};
