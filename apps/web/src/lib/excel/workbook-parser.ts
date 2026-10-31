import ExcelJS from 'exceljs';
import {
  CERTIFICATE_TYPES,
  OPTION_ALIASES,
  PERMIT_FIELD_LIST,
  PTWC_APPROVER_NAME,
  SR_NO_HEADER,
  addDaysToYmd,
  parseFlexibleDate,
  permitInputSchema,
  type ImportRowError,
  type PermitInput,
} from '@wms/shared';
import { badRequest } from '@/lib/http/errors';
import { LISTS_SHEET_NAME, MAX_IMPORT_ROWS } from './constants';

export interface ParsedPermitRow {
  /** 1-based Excel row number (for error reporting). */
  rowNumber: number;
  data: PermitInput;
}

export interface ParseResult {
  rows: ParsedPermitRow[];
  errors: ImportRowError[];
  /** Non-empty data rows found in the sheet. */
  totalRows: number;
}

const normalizeHeader = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const HEADER_LOOKUP = new Map<string, (typeof PERMIT_FIELD_LIST)[number]>(
  PERMIT_FIELD_LIST.filter((field) => field.exportToExcel !== false).map((field) => [
    normalizeHeader(field.header),
    field,
  ]),
);
const CERTIFICATE_FIELD = PERMIT_FIELD_LIST.find((field) => field.key === 'certificateType');
if (CERTIFICATE_FIELD) {
  CERTIFICATE_TYPES.forEach((_, index) => {
    HEADER_LOOKUP.set(normalizeHeader(`Certificate Type ${index + 1}`), CERTIFICATE_FIELD);
  });
}
const PTWC_STATUS_FIELD = PERMIT_FIELD_LIST.find((field) => field.key === 'ptwcStatus');
if (PTWC_STATUS_FIELD) {
  HEADER_LOOKUP.set(normalizeHeader('Approved by PTWC'), PTWC_STATUS_FIELD);
}
const COMPANY_FIELD = PERMIT_FIELD_LIST.find((field) => field.key === 'company');
if (COMPANY_FIELD) HEADER_LOOKUP.set(normalizeHeader('Company'), COMPANY_FIELD);
const WORK_ACTIVITY_FIELD = PERMIT_FIELD_LIST.find((field) => field.key === 'workActivity');
if (WORK_ACTIVITY_FIELD) HEADER_LOOKUP.set(normalizeHeader('Work Activity'), WORK_ACTIVITY_FIELD);
const PROJECT_NUMBER_FIELD = PERMIT_FIELD_LIST.find((field) => field.key === 'projectNumber');
if (PROJECT_NUMBER_FIELD) {
  HEADER_LOOKUP.set(normalizeHeader('Meram Project No-1000482'), PROJECT_NUMBER_FIELD);
}
const START_DATE_FIELD = PERMIT_FIELD_LIST.find((field) => field.key === 'planValidStartDate');
if (START_DATE_FIELD) {
  HEADER_LOOKUP.set(normalizeHeader('Plan Valid Start Date'), START_DATE_FIELD);
}
const END_DATE_FIELD = PERMIT_FIELD_LIST.find((field) => field.key === 'planValidEndDate');
if (END_DATE_FIELD) {
  HEADER_LOOKUP.set(normalizeHeader('Plan Valid End Date'), END_DATE_FIELD);
}
const CLOSED_DATE_FIELD = PERMIT_FIELD_LIST.find((field) => field.key === 'closedDate');
if (CLOSED_DATE_FIELD) HEADER_LOOKUP.set(normalizeHeader('Closed Date'), CLOSED_DATE_FIELD);
const HARD_COPY_FIELD = PERMIT_FIELD_LIST.find(
  (field) => field.key === 'receivedOriginalClosedPtw',
);
if (HARD_COPY_FIELD) {
  HEADER_LOOKUP.set(normalizeHeader('Received Original Closed PTW'), HARD_COPY_FIELD);
  HEADER_LOOKUP.set(normalizeHeader('Received Original Closed PTW (Hard Copy)'), HARD_COPY_FIELD);
}
const SOFT_COPY_FIELD = PERMIT_FIELD_LIST.find(
  (field) => field.key === 'receivedOriginalClosedPtwSoftCopy',
);
if (SOFT_COPY_FIELD) {
  HEADER_LOOKUP.set(normalizeHeader('Received Original Closed PTW (Soft Copy)'), SOFT_COPY_FIELD);
}
const SR_NO_KEY = normalizeHeader(SR_NO_HEADER);

/** Reduces any ExcelJS cell value (rich text, formula, hyperlink…) to a primitive. */
function toPrimitive(value: ExcelJS.CellValue): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    const obj = value as unknown as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text: string }>).map((part) => part.text).join('');
    }
    if ('result' in obj) return toPrimitive(obj.result as ExcelJS.CellValue);
    if (typeof obj.text === 'string') return obj.text;
    return null;
  }
  return value;
}

function toText(value: ReturnType<typeof toPrimitive>): string {
  if (value === null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function canonicalOption(raw: string, options: readonly string[]): string {
  const lower = raw.toLowerCase();
  const match = options.find((option) => option.toLowerCase() === lower);
  if (match) return match;
  const compact = lower.replace(/[^a-z0-9]/g, '');
  const normalizedMatch = options.find(
    (option) => option.toLowerCase().replace(/[^a-z0-9]/g, '') === compact,
  );
  if (normalizedMatch) return normalizedMatch;
  const alias = OPTION_ALIASES[lower];
  return alias && options.includes(alias) ? alias : raw;
}

function canonicalPtwcStatus(raw: string, options: readonly string[]): string {
  const status = /^(approved|rejected)(?:\s+by\b.*)?$/i.exec(raw.trim())?.[1];
  if (status) return canonicalOption(status, options);
  if (raw.trim().toLowerCase() === PTWC_APPROVER_NAME.toLowerCase()) {
    return canonicalOption('Approved', options);
  }
  return canonicalOption(raw, options);
}

function pickWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const sheet = workbook.worksheets.find(
    (ws) => ws.state === 'visible' && ws.name !== LISTS_SHEET_NAME,
  );
  if (!sheet) throw badRequest('The workbook does not contain a readable worksheet');
  return sheet;
}

function findHeaderRow(sheet: ExcelJS.Worksheet): { row: number; columns: Map<number, string> } {
  const limit = Math.min(sheet.rowCount, 25);
  for (let r = 1; r <= limit; r += 1) {
    const columns = new Map<number, string>();
    let matches = 0;
    sheet.getRow(r).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = normalizeHeader(toText(toPrimitive(cell.value)));
      if (HEADER_LOOKUP.has(key)) {
        columns.set(colNumber, key);
        matches += 1;
      } else if (key === SR_NO_KEY) {
        columns.set(colNumber, key);
      }
    });
    if (matches >= 3) return { row: r, columns };
  }
  throw badRequest(
    'Could not find the header row. Please use the exported file or the downloadable template.',
  );
}

/** Parses a register workbook into validated permit rows plus per-row error messages. */
export async function parsePermitWorkbook(buffer: Buffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw badRequest('The file could not be read. Please upload a valid .xlsx workbook.');
  }

  const sheet = pickWorksheet(workbook);
  const header = findHeaderRow(sheet);

  const rows: ParsedPermitRow[] = [];
  const errors: ImportRowError[] = [];
  let totalRows = 0;

  for (let r = header.row + 1; r <= sheet.rowCount; r += 1) {
    const excelRow = sheet.getRow(r);
    const candidate: Record<string, string | string[]> = {};
    const messages: string[] = [];
    let hasData = false;

    header.columns.forEach((key, colNumber) => {
      const field = HEADER_LOOKUP.get(key);
      if (!field) return; // Sr No is system managed – ignored on import.
      if (field.type === 'computed') return;

      const primitive = toPrimitive(excelRow.getCell(colNumber).value);
      const text = toText(primitive);
      if (!text) return;
      hasData = true;

      if (field.type === 'date') {
        const ymd = parseFlexibleDate(primitive instanceof Date ? primitive : text);
        if (ymd) candidate[field.key] = ymd;
        else messages.push(`${field.header}: "${text}" is not a valid date`);
      } else if (field.type === 'multiselect' && field.options) {
        const values = text
          .split(/[;|,\r\n]+/)
          .map((option) => canonicalOption(option.trim(), field.options ?? []))
          .filter(Boolean);
        const existing = candidate[field.key];
        candidate[field.key] = [
          ...new Set([...(Array.isArray(existing) ? existing : []), ...values]),
        ];
      } else if ((field.type === 'select' || field.type === 'radio') && field.options) {
        const normalized =
          field.key === 'ptwcStatus'
            ? canonicalPtwcStatus(text, field.options)
            : canonicalOption(text, field.options);
        candidate[field.key] =
          field.key === 'company' && field.defaultValue && !field.options.includes(normalized)
            ? field.defaultValue
            : normalized;
      } else {
        candidate[field.key] = text;
      }
    });

    if (!hasData) continue;
    totalRows += 1;
    if (PROJECT_NUMBER_FIELD?.fixedValue) {
      candidate[PROJECT_NUMBER_FIELD.key] = PROJECT_NUMBER_FIELD.fixedValue;
    }
    for (const field of PERMIT_FIELD_LIST) {
      if (field.defaultValue && candidate[field.key] === undefined) {
        candidate[field.key] = field.defaultValue;
      }
    }
    if (
      typeof candidate.planValidStartDate === 'string' &&
      typeof candidate.planValidEndDate !== 'string'
    ) {
      candidate.planValidEndDate = addDaysToYmd(candidate.planValidStartDate, 14);
    }

    if (totalRows > MAX_IMPORT_ROWS) {
      throw badRequest(
        `The file has more than ${MAX_IMPORT_ROWS} rows. Please split it and retry.`,
      );
    }

    const parsed = permitInputSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = PERMIT_FIELD_LIST.find((f) => f.key === issue.path[0]);
        messages.push(`${field?.header ?? 'Row'}: ${issue.message}`);
      }
    }

    if (messages.length > 0 || !parsed.success) {
      errors.push({ row: r, messages });
    } else {
      rows.push({ rowNumber: r, data: parsed.data });
    }
  }

  const rowsByPtwNumber = new Map<string, ParsedPermitRow[]>();
  for (const row of rows) {
    const number = row.data.newPtwNumber?.trim().toLowerCase();
    if (!number) continue;
    const duplicates = rowsByPtwNumber.get(number) ?? [];
    duplicates.push(row);
    rowsByPtwNumber.set(number, duplicates);
  }
  const duplicateRowNumbers = new Set<number>();
  for (const duplicates of rowsByPtwNumber.values()) {
    if (duplicates.length < 2) continue;
    for (const duplicate of duplicates) {
      duplicateRowNumbers.add(duplicate.rowNumber);
      errors.push({
        row: duplicate.rowNumber,
        messages: [`New PTW Number "${duplicate.data.newPtwNumber}" appears more than once`],
      });
    }
  }

  return {
    rows: rows.filter((row) => !duplicateRowNumbers.has(row.rowNumber)),
    errors,
    totalRows,
  };
}
