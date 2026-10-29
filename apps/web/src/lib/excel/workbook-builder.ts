import ExcelJS from 'exceljs';
import {
  PERMIT_FIELD_LIST,
  REGISTER_TITLE,
  SR_NO_HEADER,
  ymdToUtcDate,
  type PermitDTO,
} from '@wms/shared';
import {
  DATE_FORMAT,
  FIRST_DATA_ROW,
  HEADER_ROW,
  LISTS_SHEET_NAME,
  SHEET_NAME,
  SPARE_ROWS,
  TITLE_ROW,
} from './constants';

const FONT = 'Calibri';
const THIN = { style: 'thin', color: { argb: 'FFBFBFBF' } } as const;
const BORDER: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };

/** Writes every dropdown option list to a hidden sheet and returns the range reference per field. */
function addListsSheet(workbook: ExcelJS.Workbook): Map<string, string> {
  const sheet = workbook.addWorksheet(LISTS_SHEET_NAME, { state: 'hidden' });
  const ranges = new Map<string, string>();
  let column = 1;

  for (const field of PERMIT_FIELD_LIST) {
    if (!['select', 'radio', 'multiselect'].includes(field.type) || !field.options) continue;
    const letter = sheet.getColumn(column).letter;
    sheet.getCell(1, column).value = field.header;
    field.options.forEach((option, index) => {
      sheet.getCell(index + 2, column).value = option;
    });
    ranges.set(
      field.key,
      `${LISTS_SHEET_NAME}!$${letter}$2:$${letter}$${field.options.length + 1}`,
    );
    column += 1;
  }
  return ranges;
}

/**
 * Builds the register workbook – same layout as the original template
 * (title row, header on row 3, data from row 4) with dropdown validation on every select column.
 * Passing an empty list produces a blank import template.
 */
export async function buildPermitWorkbook(permits: PermitDTO[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WMS Tracking';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(SHEET_NAME, {
    views: [{ state: 'frozen', xSplit: 3, ySplit: HEADER_ROW }],
  });
  const lists = addListsSheet(workbook);
  const lastColumn = PERMIT_FIELD_LIST.length + 1;

  // Title
  sheet.mergeCells(TITLE_ROW, 1, TITLE_ROW, lastColumn);
  const title = sheet.getCell(TITLE_ROW, 1);
  title.value = REGISTER_TITLE;
  title.font = { name: FONT, size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  sheet.getRow(TITLE_ROW).height = 24;

  // Header
  const headers = [SR_NO_HEADER, ...PERMIT_FIELD_LIST.map((f) => f.header)];
  const headerRow = sheet.getRow(HEADER_ROW);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDER;
  });
  headerRow.height = 42;

  sheet.getColumn(1).width = 8;
  PERMIT_FIELD_LIST.forEach((field, index) => {
    sheet.getColumn(index + 2).width = field.width;
  });

  // Data rows
  permits.forEach((permit, rowIndex) => {
    const row = sheet.getRow(FIRST_DATA_ROW + rowIndex);
    row.getCell(1).value = permit.srNo;
    PERMIT_FIELD_LIST.forEach((field, index) => {
      const raw = permit[field.key as keyof PermitDTO] as string | string[] | undefined;
      if (!raw) return;
      const cell = row.getCell(index + 2);
      if (field.type === 'date') {
        cell.value = ymdToUtcDate(raw as string);
        cell.numFmt = DATE_FORMAT;
      } else {
        cell.value = Array.isArray(raw) ? raw.join('; ') : raw;
      }
    });
  });

  // Styling + dropdown validation for data rows and spare rows
  const lastRow = FIRST_DATA_ROW + permits.length + SPARE_ROWS - 1;
  for (let r = FIRST_DATA_ROW; r <= lastRow; r += 1) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= lastColumn; c += 1) {
      const cell = row.getCell(c);
      cell.font = { name: FONT, size: 11 };
      cell.border = BORDER;
      cell.alignment = { vertical: 'top', wrapText: true, horizontal: c === 1 ? 'center' : 'left' };

      const field = c > 1 ? PERMIT_FIELD_LIST[c - 2] : undefined;
      if (!field) continue;
      if (field.type === 'date') cell.numFmt = DATE_FORMAT;
      if ((field.type === 'select' || field.type === 'radio') && lists.has(field.key)) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: 'Invalid value',
          error: `Please choose a value from the list for "${field.header}".`,
          formulae: [lists.get(field.key) as string],
        };
      }
      if (field.type === 'multiselect') {
        cell.dataValidation = {
          type: 'textLength',
          operator: 'lessThanOrEqual',
          formulae: [1000],
          allowBlank: true,
          showInputMessage: true,
          promptTitle: 'Multiple certificates',
          prompt: 'Enter multiple values separated by semicolons.',
        };
      }
    }
  }

  sheet.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: HEADER_ROW, column: lastColumn },
  };

  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}
