import ExcelJS from 'exceljs';
import {
  PERMIT_FIELD_LIST,
  FORM_SECTIONS,
  PTWC_APPROVER_NAME,
  REGISTER_TITLE,
  SR_NO_HEADER,
  formatPlanValidity,
  toDateInputValue,
  ymdToUtcDate,
  type PermitDTO,
  type PermitFieldKey,
} from '@wms/shared';
import {
  DATE_FORMAT,
  FIRST_DATA_ROW,
  HEADER_ROW,
  LISTS_SHEET_NAME,
  SHEET_NAME,
  SECTION_ROW,
  SPARE_ROWS,
  TITLE_ROW,
} from './constants';

const FONT = 'Calibri';
const THIN = { style: 'thin', color: { argb: 'FFBFBFBF' } } as const;
const BORDER: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };
function excelDateExpression(value?: string): string {
  const ymd = toDateInputValue(value);
  if (!ymd) return '""';
  const [year, month, day] = ymd.split('-');
  return `DATE(${year},${month},${day})`;
}

function ptwValidityFormula(startDate: string, endDate: string): string {
  const duration = `${endDate}-${startDate}`;
  return `IF(OR(${startDate}="",${endDate}=""),"",IF(${duration}<0,"Invalid date range",IF(${duration}=1,"1 day left",${duration}&" days left")))`;
}

/** Writes every dropdown option list to a hidden sheet and returns the range reference per field. */
function addListsSheet(
  workbook: ExcelJS.Workbook,
  fields: typeof PERMIT_FIELD_LIST,
): Map<string, string> {
  const sheet = workbook.addWorksheet(LISTS_SHEET_NAME, { state: 'hidden' });
  const ranges = new Map<string, string>();
  let column = 1;

  for (const field of fields) {
    if (!['select', 'radio', 'multiselect'].includes(field.type) || !field.options) continue;
    const letter = sheet.getColumn(column).letter;
    sheet.getCell(1, column).value = field.header;
    field.options.forEach((option, index) => {
      sheet.getCell(index + 2, column).value =
        field.key === 'ptwcStatus' ? `${option} by ${PTWC_APPROVER_NAME}` : option;
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
export async function buildPermitWorkbook(
  permits: PermitDTO[],
  fieldKeys?: readonly PermitFieldKey[],
): Promise<Buffer> {
  const selectedFields = PERMIT_FIELD_LIST.filter(
    (field) =>
      field.exportToExcel !== false &&
      (!fieldKeys || fieldKeys.includes(field.key as PermitFieldKey)),
  );
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WMS Tracking';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(SHEET_NAME);
  const lists = addListsSheet(workbook, selectedFields);
  const lastColumn = selectedFields.length + 1;

  // Title
  sheet.mergeCells(TITLE_ROW, 1, TITLE_ROW, lastColumn);
  const title = sheet.getCell(TITLE_ROW, 1);
  title.value = REGISTER_TITLE;
  title.font = { name: FONT, size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  sheet.getRow(TITLE_ROW).height = 24;

  // Section headings span each contiguous field group, matching the permit form layout.
  const sectionRow = sheet.getRow(SECTION_ROW);
  sectionRow.height = 24;
  let firstFieldIndex = 0;
  for (const section of FORM_SECTIONS) {
    const sectionFields = selectedFields.filter((field) => field.section === section.id);
    if (!sectionFields.length) continue;
    const firstColumn =
      firstFieldIndex === 0 ? (section.id === 'planning' ? 1 : 2) : firstFieldIndex + 2;
    const lastColumnInSection = firstFieldIndex + sectionFields.length + 1;
    for (let column = firstColumn; column <= lastColumnInSection; column += 1) {
      const cell = sectionRow.getCell(column);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      cell.border = BORDER;
    }
    sheet.mergeCells(SECTION_ROW, firstColumn, SECTION_ROW, lastColumnInSection);
    const sectionCell = sectionRow.getCell(firstColumn);
    sectionCell.value = section.title;
    sectionCell.font = { name: FONT, size: 11, bold: true, color: { argb: 'FFFF0000' } };
    sectionCell.alignment = { horizontal: 'center', vertical: 'middle' };
    firstFieldIndex += sectionFields.length;
  }

  // Header
  const headers = [SR_NO_HEADER, ...selectedFields.map((field) => field.header)];
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
  selectedFields.forEach((field, index) => {
    sheet.getColumn(index + 2).width = field.width;
    if (field.type === 'date') sheet.getColumn(index + 2).numFmt = DATE_FORMAT;
  });
  const startDateIndex = selectedFields.findIndex((field) => field.key === 'planValidStartDate');
  const endDateIndex = selectedFields.findIndex((field) => field.key === 'planValidEndDate');
  const validityIndex = selectedFields.findIndex((field) => field.key === 'ptwValidity');
  const hasValidityColumn = validityIndex >= 0;
  const startDateColumn = startDateIndex >= 0 ? sheet.getColumn(startDateIndex + 2).letter : '';
  const endDateColumn = endDateIndex >= 0 ? sheet.getColumn(endDateIndex + 2).letter : '';

  // Data rows
  permits.forEach((permit, rowIndex) => {
    const row = sheet.getRow(FIRST_DATA_ROW + rowIndex);
    row.getCell(1).value = permit.srNo;
    let certificateText = '';
    selectedFields.forEach((field, index) => {
      if (field.key === 'ptwValidity' && hasValidityColumn) {
        const rowNumber = FIRST_DATA_ROW + rowIndex;
        const startDate = startDateColumn
          ? `${startDateColumn}${rowNumber}`
          : excelDateExpression(permit.planValidStartDate);
        const endDate = endDateColumn
          ? `${endDateColumn}${rowNumber}`
          : excelDateExpression(permit.planValidEndDate);
        row.getCell(index + 2).value = {
          formula: ptwValidityFormula(startDate, endDate),
          result: formatPlanValidity(permit.planValidStartDate, permit.planValidEndDate),
        };
        return;
      }
      const raw =
        field.fixedValue ??
        (field.type === 'computed'
          ? formatPlanValidity(permit.planValidStartDate, permit.planValidEndDate)
          : (permit[field.key as keyof PermitDTO] as string | string[] | undefined));
      if (!raw) return;
      const cell = row.getCell(index + 2);
      if (field.key === 'certificateType' && Array.isArray(raw)) {
        certificateText = raw.join(', ');
        cell.value = certificateText;
        return;
      }
      if (field.key === 'ptwcStatus') {
        cell.value = `${raw} by ${PTWC_APPROVER_NAME}`;
        return;
      }
      if (field.type === 'date') {
        cell.value = ymdToUtcDate(raw as string);
        cell.numFmt = DATE_FORMAT;
      } else {
        cell.value = Array.isArray(raw) ? raw.join('; ') : raw;
      }
    });
    const certificateFieldIndex = selectedFields.findIndex(
      (field) => field.key === 'certificateType',
    );
    if (certificateFieldIndex >= 0 && certificateText) {
      const width = selectedFields[certificateFieldIndex]?.width ?? 36;
      row.height = Math.max(32, Math.ceil(certificateText.length / width) * 16 + 4);
    }
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

      const field = c > 1 ? selectedFields[c - 2] : undefined;
      if (!field) continue;
      if (
        field.key === 'ptwValidity' &&
        startDateColumn &&
        endDateColumn &&
        (cell.value === null || cell.value === undefined)
      ) {
        cell.value = {
          formula: ptwValidityFormula(`${startDateColumn}${r}`, `${endDateColumn}${r}`),
          result: '',
        };
      }
      if (field.type === 'date') cell.numFmt = DATE_FORMAT;
      if (
        (field.type === 'select' || field.type === 'radio' || field.type === 'multiselect') &&
        lists.has(field.key)
      ) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          showErrorMessage: field.type !== 'multiselect',
          errorStyle: 'stop',
          errorTitle: 'Invalid value',
          error: `Please choose a value from the list for "${field.header}".`,
          formulae: [lists.get(field.key) as string],
          ...(field.type === 'multiselect'
            ? {
                showInputMessage: true,
                promptTitle: 'Multiple certificates',
                prompt: 'Enter certificate names separated by commas.',
              }
            : {}),
        };
      }
    }
    if (row.height === undefined) row.height = 32;
  }

  sheet.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: HEADER_ROW, column: lastColumn },
  };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
