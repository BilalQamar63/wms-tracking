import { DAILY_PTW_STATUSES, DAILY_SHIFTS } from './options';

export type DailyRegisterFieldType = 'text' | 'date' | 'time' | 'number' | 'radio' | 'computed';

export interface DailyRegisterFieldDef {
  readonly key: string;
  readonly header: string;
  readonly type: DailyRegisterFieldType;
  readonly width: number;
  readonly maxLength?: number;
  readonly required?: boolean;
  readonly options?: readonly string[];
}

export const DAILY_REGISTER_FIELDS = [
  { key: 'plantDivision', header: 'Plant/Division', type: 'text', width: 25 },
  { key: 'mainContractor', header: 'Main Contractor', type: 'text', width: 22 },
  { key: 'subContractor', header: 'Sub Contractor', type: 'text', width: 22 },
  { key: 'department', header: 'Department', type: 'text', width: 18 },
  { key: 'discipline', header: 'Discipline', type: 'text', width: 18 },
  { key: 'ptwTitle', header: 'PTW Tittle', type: 'text', width: 32, maxLength: 255 },
  { key: 'workLocation', header: 'Work Location', type: 'text', width: 28, maxLength: 500 },
  { key: 'equipmentTagNo', header: 'Equipment Tag No', type: 'text', width: 24, maxLength: 255 },
  { key: 'ptwType', header: 'PTW Type', type: 'text', width: 30, maxLength: 255 },
  { key: 'ptwNumber', header: 'PTW Number', type: 'text', width: 22, maxLength: 100 },
  { key: 'certificateTypes', header: 'Certificate Types', type: 'text', width: 34, maxLength: 500 },
  {
    key: 'plannedStartDate',
    header: 'Planned Start Date',
    type: 'date',
    width: 20,
    required: true,
  },
  {
    key: 'plannedEndDate',
    header: 'Planned End Date',
    type: 'date',
    width: 20,
    required: true,
  },
  { key: 'ptwValidity', header: 'PTW Validity', type: 'computed', width: 20 },
  { key: 'shiftDayNight', header: 'Shift', type: 'radio', width: 18, options: DAILY_SHIFTS },
  // { key: 'shiftValidity', header: 'Shift Validity', type: 'radio', width: 20, options: DAILY_SHIFTS },
  { key: 'workStartTime', header: 'Work Start Time', type: 'time', width: 18 },
  { key: 'workEndTime', header: 'Work End Time', type: 'time', width: 18 },
  { key: 'extendedHours', header: 'Extended Hours', type: 'time', width: 18 },
  { key: 'workHours', header: 'Work Hours', type: 'computed', width: 16 },
  { key: 'permitIssuer', header: 'Permit issuer', type: 'text', width: 32, maxLength: 255 },
  { key: 'permitIssuerTime', header: 'Time', type: 'time', width: 14 },
  { key: 'jobPerformer1', header: 'Job Performer-1', type: 'text', width: 32, maxLength: 255 },
  { key: 'jobPerformer1Time', header: 'Time', type: 'time', width: 14 },
  { key: 'jobPerformer2', header: 'Job Performer-2', type: 'text', width: 32, maxLength: 255 },
  { key: 'jobPerformer2Time', header: 'Time', type: 'time', width: 14 },
  {
    key: 'ptwStatus',
    header: 'PTW Status (Live/Suspended)',
    type: 'radio',
    width: 24,
    options: DAILY_PTW_STATUSES,
  },
  { key: 'remarks', header: 'Remarks', type: 'text', width: 36, maxLength: 1000 },
] as const satisfies readonly DailyRegisterFieldDef[];

export type DailyRegisterFieldKey = (typeof DAILY_REGISTER_FIELDS)[number]['key'];
