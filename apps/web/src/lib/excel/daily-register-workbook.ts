import ExcelJS from 'exceljs';
import {
  DAILY_REGISTER_FIELDS,
  DAILY_REGISTER_FIELDS as fields,
  SR_NO_HEADER,
  formatPlanValidity,
  parseFlexibleDate,
  ymdToUtcDate,
  type DailyRegisterDTO,
  type DailyRegisterInput,
} from '@wms/shared';
import { badRequest } from '@/lib/http/errors';
import { DATE_FORMAT, FIRST_DATA_ROW, HEADER_ROW, SECTION_ROW, SHEET_NAME, TITLE_ROW } from './constants';

const DAILY_TITLE = 'DAILY PTW REGISTER';
const FONT = 'Calibri';
const BLUE = 'FF1F4E78';
const COLUMN_BLUE = 'FF4472C4';
const THIN = { style: 'thin', color: { argb: 'FFBFBFBF' } } as const;
const BORDER: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

function excelCellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== 'object') return String(value).trim();
  const object = value as unknown as Record<string, unknown>;
  if ('result' in object) return excelCellText(object.result as ExcelJS.CellValue);
  if (typeof object.text === 'string') return object.text.trim();
  if (Array.isArray(object.richText)) {
    return (object.richText as Array<{ text: string }>).map((part) => part.text).join('').trim();
  }
  return '';
}

function excelCellDate(value: ExcelJS.CellValue): string | null {
  if (value && typeof value === 'object' && 'result' in value) {
    return parseFlexibleDate(value.result);
  }
  return parseFlexibleDate(value);
}

function validityFormula(row: number, startColumn: string, endColumn: string): string {
  const days = `${endColumn}${row}-${startColumn}${row}+1`;
  return `IF(OR(${startColumn}${row}="",${endColumn}${row}=""),"",IF(${days}<1,"Invalid date range",IF(${days}=1,"1 day validity",${days}&" days validity")))`;
}

export async function buildDailyRegisterWorkbook(
  date: string,
  entries: DailyRegisterDTO[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WMS Tracking';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(SHEET_NAME);
  const lastColumn = DAILY_REGISTER_FIELDS.length + 1;

  sheet.mergeCells(TITLE_ROW, 1, TITLE_ROW, lastColumn);
  const title = sheet.getCell(TITLE_ROW, 1);
  title.value = `${DAILY_TITLE} - ${date}`;
  title.font = { name: FONT, size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
  sheet.getRow(TITLE_ROW).height = 24;

  sheet.mergeCells(SECTION_ROW, 1, SECTION_ROW, 13);
  sheet.mergeCells(SECTION_ROW, 14, SECTION_ROW, lastColumn);
  for (const [column, text] of [
    [1, 'SECTION-1 PTW PLANNING & REQUEST'],
    [14, 'SECTION-2 PTW APPROVAL WORKSITE REVALIDATION'],
  ] as const) {
    const cell = sheet.getCell(SECTION_ROW, column);
    cell.value = text;
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: 'FFFF0000' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDER;
  }
  sheet.getRow(SECTION_ROW).height = 24;

  const headers = [SR_NO_HEADER, ...DAILY_REGISTER_FIELDS.map((field) => field.header)];
  const headerRow = sheet.getRow(HEADER_ROW);
  headers.forEach((value, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = value;
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLUMN_BLUE } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDER;
  });
  headerRow.height = 42;
  sheet.getColumn(1).width = 9;
  DAILY_REGISTER_FIELDS.forEach((field, index) => {
    sheet.getColumn(index + 2).width = field.width;
    if (field.type === 'date') sheet.getColumn(index + 2).numFmt = DATE_FORMAT;
  });

  const startIndex = DAILY_REGISTER_FIELDS.findIndex((field) => field.key === 'plannedStartDate');
  const endIndex = DAILY_REGISTER_FIELDS.findIndex((field) => field.key === 'plannedEndDate');
  entries.forEach((entry, index) => {
    const rowNumber = FIRST_DATA_ROW + index;
    const row = sheet.getRow(rowNumber);
    row.getCell(1).value = entry.srNo;
    DAILY_REGISTER_FIELDS.forEach((field, fieldIndex) => {
      const cell = row.getCell(fieldIndex + 2);
      if (field.type === 'computed') {
        const startColumn = sheet.getColumn(startIndex + 2).letter;
        const endColumn = sheet.getColumn(endIndex + 2).letter;
        const start = entry.plannedStartDate ?? '';
        const end = entry.plannedEndDate ?? '';
        cell.value = {
          formula: validityFormula(rowNumber, startColumn, endColumn),
          result: formatPlanValidity(start, end),
        };
      } else if (field.type === 'date') {
        const value = entry[field.key as keyof DailyRegisterDTO];
        if (typeof value === 'string' && value) cell.value = ymdToUtcDate(value);
      } else {
        const value = entry[field.key as keyof DailyRegisterDTO];
        if (typeof value === 'string') cell.value = value;
      }
    });
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: FONT, size: 11 };
      cell.border = BORDER;
      cell.alignment = { vertical: 'top', wrapText: true };
    });
  });

  sheet.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: HEADER_ROW, column: lastColumn },
  };
  sheet.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export interface ParsedDailyRegisterRow {
  rowNumber: number;
  data: DailyRegisterInput;
}

export interface DailyRegisterParseResult {
  rows: ParsedDailyRegisterRow[];
  errors: Array<{ row: number; messages: string[] }>;
  totalRows: number;
}

function getDailyHeaderColumns(sheet: ExcelJS.Worksheet): Map<number, string> {
  const required = ['srno', ...fields.map((field) => normalizeHeader(field.header))];
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 25); rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const headers: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell) => headers.push(normalizeHeader(excelCellText(cell.value))));
    const available = [...headers];
    const hasAllRequired = required.every((header) => available.includes(header));
    const hasThreeTimeColumns = available.filter((header) => header === 'time').length === 3;
    if (hasAllRequired && hasThreeTimeColumns) {
      const columns = new Map<number, string>();
      let timeIndex = 0;
      row.eachCell({ includeEmpty: false }, (cell, column) => {
        const header = normalizeHeader(excelCellText(cell.value));
        if (header === 'srno') {
          columns.set(column, 'srNo');
          return;
        }
        const matches = DAILY_REGISTER_FIELDS.filter(
          (field) => normalizeHeader(field.header) === header,
        );
        if (!matches.length) return;
        const field =
          header === 'time'
            ? matches[timeIndex++]
            : matches[0];
        if (field) columns.set(column, field.key);
      });
      return columns;
    }
  }
  throw badRequest(
    'This workbook does not have all the required PTW Register columns from the supplied template.',
  );
}

export async function parseDailyRegisterWorkbook(buffer: Buffer): Promise<DailyRegisterParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw badRequest('The file could not be read. Please upload a valid .xlsx workbook.');
  }
  const sheet =
    workbook.worksheets.find((worksheet) => normalizeHeader(worksheet.name) === 'ptwregister') ??
    workbook.worksheets.find((worksheet) => worksheet.state === 'visible');
  if (!sheet) throw badRequest('The workbook does not contain a readable PTW Register sheet.');
  const columns = getDailyHeaderColumns(sheet);
  const rows: ParsedDailyRegisterRow[] = [];
  const errors: DailyRegisterParseResult['errors'] = [];
  let totalRows = 0;

  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const values: Record<string, string> = {};
    const rawValues: Record<string, ExcelJS.CellValue> = {};
    columns.forEach((key, column) => {
      const value = sheet.getRow(rowNumber).getCell(column).value;
      values[key] = excelCellText(value);
      rawValues[key] = value;
    });
    if (!Object.entries(values).some(([key, value]) => key !== 'srNo' && key !== 'ptwValidity' && value)) {
      continue;
    }
    if (rowNumber <= 3) continue;
    totalRows += 1;
    const data: Record<string, string> = {};
    const messages: string[] = [];
    for (const field of DAILY_REGISTER_FIELDS) {
      if (field.type === 'computed') continue;
      const raw = values[field.key] ?? '';
      if (field.type === 'date' && raw) {
        const parsedDate = excelCellDate(rawValues[field.key] ?? raw);
        if (!parsedDate) messages.push(`${field.header}: "${raw}" is not a valid date`);
        else data[field.key] = parsedDate;
      } else if (raw) {
        data[field.key] = raw;
      }
    }
    if (!data.plannedStartDate) messages.push('Planned Start Date is required');
    if (!data.plannedEndDate) messages.push('Planned End Date is required');
    if (
      data.plannedStartDate &&
      data.plannedEndDate &&
      data.plannedEndDate < data.plannedStartDate
    ) {
      messages.push('Planned End Date cannot be before Planned Start Date');
    }
    if (messages.length) errors.push({ row: rowNumber, messages });
    else rows.push({ rowNumber, data });
  }
  return { rows, errors, totalRows };
}
