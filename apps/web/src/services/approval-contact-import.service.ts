import ExcelJS from 'exceljs';
import {
  AUTHORIZATION_STATUS_OPTIONS,
  approvalContactSchema,
  type ApprovalContactDTO,
  type ApprovalContactImportChange,
  type ApprovalContactImportPreview,
  type ApprovalContactImportRecord,
  type ApprovalContactImportResult,
  type ApprovalContactInput,
  type ImportRowError,
} from '@wms/shared';
import { badRequest, conflict } from '@/lib/http/errors';
import { connectDb } from '@/lib/db/mongoose';
import { ApprovalContactModel, type ApprovalContactDoc } from '@/models/ApprovalContact';
import { PermitModel } from '@/models/Permit';
import { normalizeAuthorizationText, normalizeIdentityKey } from './approval-contact.service';
import { normalizeAuthorizationDate } from './authorization-date';
import { addImportedAuthorizationDropdownValues } from './dropdown-values.service';
import { MAX_IMPORT_ROWS } from '@/lib/excel/constants';

const CONTACT_COLUMNS: Array<{
  key: keyof ApprovalContactInput;
  header: string;
}> = [
  { key: 'srNo', header: 'Sr #' },
  { key: 'approvalFormNo', header: 'Approval Form No' },
  { key: 'company', header: 'Company' },
  { key: 'name', header: 'Full Name' },
  { key: 'emiratesId', header: 'Emirates ID/JVUID No' },
  { key: 'phone', header: 'Mobile Number' },
  { key: 'position', header: 'Position' },
  { key: 'wmsRole', header: 'WMS Role' },
  { key: 'instituteName', header: 'Institute Name' },
  { key: 'jvAssessmentDate', header: 'JV Assessment Date' },
  { key: 'wmsValidity', header: 'WMS Validity' },
  { key: 'status', header: 'Status' },
  { key: 'remarks', header: 'Remarks' },
];

const normalizeHeader = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const HEADER_ALIASES = new Map<string, keyof ApprovalContactInput>();
for (const column of CONTACT_COLUMNS) {
  HEADER_ALIASES.set(normalizeHeader(column.header), column.key);
}
for (const [header, key] of [
  ['Sr No', 'srNo'],
  ['Sr. No', 'srNo'],
  ['Sr Number', 'srNo'],
  ['SR#', 'srNo'],
  ['Serial No', 'srNo'],
  ['Serial Number', 'srNo'],
  ['Authorization Sr No', 'srNo'],
  ['Approval Form Number', 'approvalFormNo'],
  ['Approval No', 'approvalFormNo'],
  ['Approval Number', 'approvalFormNo'],
  ['Approval Form #', 'approvalFormNo'],
  ['Approval Form Number No', 'approvalFormNo'],
  ['Name', 'name'],
  ['Emirates ID', 'emiratesId'],
  ['JVUID No', 'emiratesId'],
  ['Emirates ID JVUID No', 'emiratesId'],
  ['Phone', 'phone'],
  ['Mobile', 'phone'],
  ['Institute', 'instituteName'],
  ['Designation', 'position'],
  ['WMS Roles', 'wmsRole'],
  ['Institute Name', 'instituteName'],
  ['JV Assessment', 'jvAssessmentDate'],
  ['Assessment Date', 'jvAssessmentDate'],
  ['JV Assessment Date (JV)', 'jvAssessmentDate'],
  ['WMS Validity Date', 'wmsValidity'],
] as const) {
  HEADER_ALIASES.set(normalizeHeader(header), key);
}

function contactFieldForHeader(header: string): keyof ApprovalContactInput | undefined {
  const normalized = normalizeHeader(header);
  const exact = HEADER_ALIASES.get(normalized);
  if (exact) return exact;

  if (
    normalized.includes('date') &&
    (
      normalized.includes('assessment') ||
      normalized.includes('assesment') ||
      normalized.includes('assess')
    )
  ) {
    return 'jvAssessmentDate';
  }
  if (normalized.includes('jv') && normalized.includes('date')) return 'jvAssessmentDate';
  if (normalized.includes('wms') && normalized.includes('valid')) return 'wmsValidity';
  if (normalized.includes('position') || normalized.includes('designation')) return 'position';
  if (normalized.includes('wms') && normalized.includes('role')) return 'wmsRole';
  if (normalized.includes('institute') || normalized.includes('institution')) return 'instituteName';
  return undefined;
}

const CONTACT_FIELD_LABELS: Record<keyof ApprovalContactInput, string> = Object.fromEntries(
  CONTACT_COLUMNS.map(({ key, header }) => [key, header]),
) as Record<keyof ApprovalContactInput, string>;

function cellValueText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return normalizeAuthorizationText(String(value));
  }
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return normalizeAuthorizationText(value.richText.map((part) => part.text).join(''));
    }
    if ('text' in value && typeof value.text === 'string') return normalizeAuthorizationText(value.text);
    if ('result' in value && value.result !== undefined) {
      return cellValueText(value.result as ExcelJS.CellValue);
    }
  }
  return '';
}

function dateCellValueText(value: ExcelJS.CellValue, displayedText = ''): string {
  if (displayedText) {
    const displayedDate = normalizeAuthorizationDate(displayedText);
    if (displayedDate) return displayedDate;
  }
  if (value && typeof value === 'object' && 'result' in value && value.result !== undefined) {
    return dateCellValueText(value.result as ExcelJS.CellValue);
  }
  if (value && typeof value === 'object' && 'text' in value && typeof value.text === 'string') {
    return normalizeAuthorizationDate(value.text);
  }
  if (value && typeof value === 'object' && 'richText' in value && Array.isArray(value.richText)) {
    return normalizeAuthorizationDate(value.richText.map((part) => part.text).join(''));
  }
  if (value instanceof Date || typeof value === 'number' || typeof value === 'string') {
    return normalizeAuthorizationDate(value);
  }
  return '';
}

function findHeaderRow(worksheet: ExcelJS.Worksheet): {
  rowNumber: number;
  columns: Map<keyof ApprovalContactInput, number>;
} | null {
  const searchUntil = Math.min(worksheet.rowCount, 20);
  for (let rowNumber = 1; rowNumber <= searchUntil; rowNumber += 1) {
    const columns = new Map<keyof ApprovalContactInput, number>();
    worksheet.getRow(rowNumber).eachCell((cell, columnNumber) => {
      const key = contactFieldForHeader(cellValueText(cell.value));
      if (key !== undefined && !columns.has(key)) columns.set(key, columnNumber);
    });
    if (columns.has('name') && columns.has('emiratesId')) return { rowNumber, columns };
  }
  return null;
}

function findContactWorksheet(workbook: ExcelJS.Workbook): {
  worksheet: ExcelJS.Worksheet;
  headerRow: number;
  columns: Map<keyof ApprovalContactInput, number>;
} {
  const candidates: Array<{
    worksheet: ExcelJS.Worksheet;
    headerRow: number;
    columns: Map<keyof ApprovalContactInput, number>;
    recognizedFields: number;
  }> = [];
  for (const worksheet of workbook.worksheets) {
    const header = findHeaderRow(worksheet);
    if (!header) continue;
    candidates.push({
      worksheet,
      headerRow: header.rowNumber,
      columns: header.columns,
      recognizedFields: header.columns.size,
    });
  }
  const candidate = candidates.sort(
    (left, right) => right.recognizedFields - left.recognizedFields,
  )[0];
  if (!candidate) {
    throw badRequest('The Excel workbook must include Full Name and Emirates ID/JVUID No columns');
  }
  return {
    worksheet: candidate.worksheet,
    headerRow: candidate.headerRow,
    columns: candidate.columns,
  };
}

function parseContactRow(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  columns: Map<keyof ApprovalContactInput, number>,
): { data: ApprovalContactInput | null; error?: string } {
  const row = worksheet.getRow(rowNumber);
  for (const key of ['jvAssessmentDate', 'wmsValidity'] as const) {
    const column = columns.get(key);
    if (!column) continue;
    const cell = row.getCell(column);
    const rawValue = cell.value as ExcelJS.CellValue;
    const rawText = cellValueText(rawValue);
    if (rawText && !dateCellValueText(rawValue, cell.text)) {
      return {
        data: null,
        error: `${CONTACT_FIELD_LABELS[key]} could not be read as a valid date`,
      };
    }
  }
  const data = Object.fromEntries(
    CONTACT_COLUMNS.map(({ key }) => {
      const column = columns.get(key);
      const value = column ? row.getCell(column).value : '';
      const cellValue = value as ExcelJS.CellValue;
      return [
        key,
        key === 'jvAssessmentDate' || key === 'wmsValidity'
          ? dateCellValueText(cellValue, column ? row.getCell(column).text : '')
          : cellValueText(cellValue),
      ];
    }),
  );
  const status = typeof data.status === 'string' ? data.status.trim() : '';
  data.status = status
    ? AUTHORIZATION_STATUS_OPTIONS.find(
        (option) => option.toLocaleLowerCase() === status.toLocaleLowerCase(),
      ) ?? status
    : '';
  const meaningfulFields = Object.entries(data).filter(
    ([key, value]) =>
      key !== 'srNo' &&
      key !== 'approvalFormNo' &&
      key !== 'status' &&
      !!value,
  );
  if (meaningfulFields.length === 0) return { data: null };

  const parsed = approvalContactSchema.safeParse(data);
  if (!parsed.success) {
    return {
      data: null,
      error: parsed.error.issues.map((issue) => issue.message).join('; '),
    };
  }
  return { data: parsed.data };
}

function getChangedFields(
  incoming: ApprovalContactInput,
  existing: ApprovalContactDoc,
): ApprovalContactImportChange[] {
  return CONTACT_COLUMNS.flatMap(({ key }) => {
    const oldValue = key === 'status'
      ? (existing.status?.toLocaleLowerCase() === 'inactive' ? 'Inactive' : 'Active')
      : key === 'jvAssessmentDate' || key === 'wmsValidity'
        ? normalizeAuthorizationDate(existing[key] ?? '')
        : normalizeAuthorizationText(existing[key] ?? '');
    const newValue = incoming[key] ?? '';
    return oldValue === newValue
      ? []
      : [{ key, label: CONTACT_FIELD_LABELS[key], oldValue, newValue }];
  });
}

function legacyContactKey(name: string, phone: string): string {
  const normalizedName = name.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  const normalizedPhone = phone.replace(/[^\d+]/g, '');
  return `${normalizedName}|${normalizedPhone}`;
}

export async function previewApprovalContactImport(
  file: File,
): Promise<ApprovalContactImportPreview> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw badRequest('Upload an .xlsx Excel file');
  }
  if (file.size === 0) throw badRequest('The Excel file is empty');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  if (workbook.worksheets.length === 0) {
    throw badRequest('The Excel workbook does not contain a worksheet');
  }
  const { worksheet, headerRow, columns } = findContactWorksheet(workbook);
  const errors: ImportRowError[] = [];
  if (!columns.has('jvAssessmentDate')) {
    errors.push({
      row: headerRow,
      messages: [
        'JV Assessment Date column was not recognized; imported records will keep this field blank.',
      ],
    });
  }
  const parsedRecords: Array<{ rowNumber: number; data: ApprovalContactInput }> = [];
  const seenKeys = new Set<string>();
  let totalRows = 0;

  for (let rowNumber = headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const parsedRow = parseContactRow(worksheet, rowNumber, columns);
    if (parsedRow.error) {
      totalRows += 1;
      errors.push({
        row: rowNumber,
        messages: [parsedRow.error],
      });
      continue;
    }
    const { data } = parsedRow;
    if (!data) continue;

    totalRows += 1;
    if (totalRows > MAX_IMPORT_ROWS) {
      throw badRequest(`The contact sheet cannot contain more than ${MAX_IMPORT_ROWS} data rows`);
    }
    const identityKey = normalizeIdentityKey(data.emiratesId);
    if (identityKey && seenKeys.has(identityKey)) {
      errors.push({
        row: rowNumber,
        messages: ['This Emirates ID/JVUID appears more than once in the Excel file'],
      });
      continue;
    }
    if (identityKey) seenKeys.add(identityKey);
    parsedRecords.push({ rowNumber, data });
  }

  await connectDb();
  const keys = parsedRecords
    .map(({ data }) => normalizeIdentityKey(data.emiratesId))
    .filter(Boolean);
  const existingDocs = keys.length
    ? await ApprovalContactModel.find({ identityKey: { $in: keys } }).lean<ApprovalContactDoc[]>()
    : [];
  const existingByKey = new Map(existingDocs.map((doc) => [doc.identityKey ?? '', doc]));

  const legacyDocs = parsedRecords.length
    ? await ApprovalContactModel.find({
        $and: [
          { $or: [{ identityKey: { $exists: false } }, { identityKey: '' }] },
          { $or: [{ emiratesId: { $exists: false } }, { emiratesId: '' }] },
        ],
      })
        .sort({ createdAt: 1, _id: 1 })
        .lean<ApprovalContactDoc[]>()
    : [];
  const legacyByContact = new Map<string, ApprovalContactDoc[]>();
  for (const doc of legacyDocs) {
    const key = legacyContactKey(doc.name ?? '', doc.phone ?? '');
    const matches = legacyByContact.get(key) ?? [];
    matches.push(doc);
    legacyByContact.set(key, matches);
  }
  const existingByRow = new Map<number, ApprovalContactDoc>();
  for (const { rowNumber, data } of parsedRecords) {
    const key = normalizeIdentityKey(data.emiratesId);
    const existing = key ? existingByKey.get(key) : undefined;
    if (existing) {
      existingByRow.set(rowNumber, existing);
      continue;
    }
    const legacyMatches =
      data.name && data.phone
        ? legacyByContact.get(legacyContactKey(data.name, data.phone))
        : undefined;
    const legacyMatch = legacyMatches?.shift();
    if (legacyMatch) existingByRow.set(rowNumber, legacyMatch);
  }

  const records: ApprovalContactImportRecord[] = parsedRecords.map(({ rowNumber, data }) => {
    const existing = existingByRow.get(rowNumber);
    const importData = { ...data };
    if (existing) {
      const sourceRow = worksheet.getRow(rowNumber);
      for (const { key } of CONTACT_COLUMNS) {
        const oldValue = existing[key] ?? '';
        const rawValue = columns.has(key)
          ? sourceRow.getCell(columns.get(key)!).value as ExcelJS.CellValue
          : null;
        const rawText = key === 'jvAssessmentDate' || key === 'wmsValidity'
          ? dateCellValueText(rawValue, columns.has(key) ? sourceRow.getCell(columns.get(key)!).text : '')
          : cellValueText(rawValue);
        if (!columns.has(key) || !rawText) {
          if (key === 'status') {
            importData.status =
              oldValue.toLocaleLowerCase() === 'inactive' ? 'Inactive' : 'Active';
          } else if (key === 'jvAssessmentDate' || key === 'wmsValidity') {
            importData[key] = normalizeAuthorizationDate(oldValue);
          } else {
            importData[key] = normalizeAuthorizationText(oldValue);
          }
        }
      }
    }
    return {
      rowNumber,
      data: importData,
      expectedContactId: existing ? String(existing._id) : null,
      expectedUpdatedAt: existing?.updatedAt?.toISOString() ?? null,
    };
  });
  const rows: ApprovalContactImportPreview['rows'] = records.map(({ rowNumber, data }) => {
    const existing = existingByRow.get(rowNumber);
    const changes = existing
      ? getChangedFields(data, existing)
      : CONTACT_COLUMNS.flatMap(({ key }) =>
          data[key]
            ? [{ key, label: CONTACT_FIELD_LABELS[key], oldValue: '', newValue: data[key] }]
            : [],
        );
    return {
      rowNumber,
      action: !existing ? 'add' : changes.length ? 'update' : 'unchanged',
      name: data.name,
      emiratesId: data.emiratesId,
      expectedUpdatedAt: existing?.updatedAt?.toISOString() ?? null,
      changes,
    };
  });

  return {
    fileName: file.name,
    totalRows,
    records,
    rows,
    errors,
    counts: {
      added: rows.filter((row) => row.action === 'add').length,
      updated: rows.filter((row) => row.action === 'update').length,
      unchanged: rows.filter((row) => row.action === 'unchanged').length,
    },
  };
}

export async function commitApprovalContactImport(
  records: ApprovalContactImportRecord[],
  updateExisting: boolean,
): Promise<ApprovalContactImportResult> {
  const validRecords: ApprovalContactImportRecord[] = [];
  const seenKeys = new Set<string>();
  for (const record of records) {
    const parsed = approvalContactSchema.safeParse(record.data);
    if (!parsed.success) {
      throw badRequest(`Excel row ${record.rowNumber}: ${parsed.error.issues[0]?.message}`);
    }
    const key = normalizeIdentityKey(parsed.data.emiratesId);
    if (key && seenKeys.has(key)) {
      throw badRequest(`Excel row ${record.rowNumber}: duplicate Emirates ID/JVUID`);
    }
    if (key) seenKeys.add(key);
    validRecords.push({
      rowNumber: record.rowNumber,
      data: parsed.data,
      expectedContactId: record.expectedContactId,
      expectedUpdatedAt: record.expectedUpdatedAt,
    });
  }

  await connectDb();
  const keys = validRecords
    .map(({ data }) => normalizeIdentityKey(data.emiratesId))
    .filter(Boolean);
  const existingDocs = keys.length
    ? await ApprovalContactModel.find({ identityKey: { $in: keys } }).lean<ApprovalContactDoc[]>()
    : [];
  const existingByKey = new Map(existingDocs.map((doc) => [doc.identityKey ?? '', doc]));
  const expectedContactIds = validRecords
    .map(({ expectedContactId }) => expectedContactId)
    .filter((id): id is string => id !== null);
  const expectedDocs = expectedContactIds.length
    ? await ApprovalContactModel.find({ _id: { $in: expectedContactIds } }).lean<ApprovalContactDoc[]>()
    : [];
  const expectedById = new Map(expectedDocs.map((doc) => [String(doc._id), doc]));
  const updates: Array<{
    id: ApprovalContactDoc['_id'];
    expectedUpdatedAt: Date;
    data: ApprovalContactInput;
    identityKey: string;
  }> = [];
  const additions: Array<{ data: ApprovalContactInput; identityKey: string }> = [];
  let unchanged = 0;
  let skipped = 0;

  for (const record of validRecords) {
    const identityKey = normalizeIdentityKey(record.data.emiratesId);
    const identityMatch = identityKey ? existingByKey.get(identityKey) : undefined;
    const expectedMatch = record.expectedContactId
      ? expectedById.get(record.expectedContactId)
      : undefined;
    if (record.expectedContactId && !expectedMatch) {
      throw conflict(
        `The contact on Excel row ${record.rowNumber} was removed after the preview; upload the file again`,
      );
    }
    if (record.expectedContactId && identityMatch && String(identityMatch._id) !== record.expectedContactId) {
      throw conflict(
        `A contact on Excel row ${record.rowNumber} changed after the preview; upload the file again`,
      );
    }
    if (!record.expectedContactId && identityMatch) {
      throw conflict(
        `A contact on Excel row ${record.rowNumber} was added after the preview; upload the file again`,
      );
    }
    const existing = expectedMatch ?? identityMatch;
    if (!existing) {
      if (record.expectedUpdatedAt !== null) {
        throw conflict(
          `The contact on Excel row ${record.rowNumber} was removed after the preview; upload the file again`,
        );
      }
      additions.push({ data: record.data, identityKey });
      continue;
    }
    if (!record.expectedUpdatedAt) {
      throw conflict(`The contact on Excel row ${record.rowNumber} has no update timestamp`);
    }
    if (existing.updatedAt?.toISOString() !== record.expectedUpdatedAt) {
      throw conflict(
        `The contact on Excel row ${record.rowNumber} changed after the preview; upload the file again`,
      );
    }
    const changes = getChangedFields(record.data, existing);
    if (changes.length === 0) {
      unchanged += 1;
      continue;
    }
    if (!updateExisting) {
      skipped += 1;
      continue;
    }
    if (changes.some(({ key }) => key === 'name' || key === 'phone')) {
      const oldDisplayValue = `${existing.name} - ${existing.phone}`;
      const usedByPermit = await PermitModel.exists({
        $or: [
          { performingAuthority: oldDisplayValue },
          { validationBy: oldDisplayValue },
          { approvedBy: oldDisplayValue },
        ],
      });
      if (usedByPermit) {
        throw conflict(
          `The contact on Excel row ${record.rowNumber} is selected by a permit and its name or mobile number cannot be changed`,
        );
      }
    }
    updates.push({
      id: existing._id,
      expectedUpdatedAt: existing.updatedAt,
      data: record.data,
      identityKey,
    });
  }

  const operations = [
    ...additions.map(({ data, identityKey }) => ({
      insertOne: {
        document: { ...data, ...(identityKey ? { identityKey } : {}) },
      },
    })),
    ...updates.map(({ id, expectedUpdatedAt, data, identityKey }) => ({
      updateOne: {
        filter: { _id: id, updatedAt: expectedUpdatedAt },
        update: { $set: { ...data, identityKey } },
      },
    })),
  ];
  await addImportedAuthorizationDropdownValues(
    validRecords.map(({ data }) => ({
      position: data.position,
      wmsRole: data.wmsRole,
      instituteName: data.instituteName,
    })),
  );
  if (operations.length > 0) {
    const result = await ApprovalContactModel.bulkWrite(operations, { ordered: true });
    if (result.matchedCount !== updates.length || result.insertedCount !== additions.length) {
      throw conflict('The contact list changed during import; upload the Excel file again');
    }
  }

  return { added: additions.length, updated: updates.length, unchanged, skipped };
}

export async function exportApprovalContacts(): Promise<Buffer> {
  await connectDb();
  const docs = await ApprovalContactModel.find({})
    .sort({ srNo: 1, _id: 1 })
    .lean<ApprovalContactDoc[]>();
  docs.sort((left, right) => {
    const leftSrNo = normalizeAuthorizationText(left.srNo ?? '');
    const rightSrNo = normalizeAuthorizationText(right.srNo ?? '');
    const leftNumber = Number(leftSrNo);
    const rightNumber = Number(rightSrNo);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }
    return (left.name ?? '').localeCompare(right.name ?? '');
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Approval Contacts');
  worksheet.columns = CONTACT_COLUMNS.map(({ key, header }) => ({
    header,
    key,
    width: Math.min(35, Math.max(header.length + 2, 18)),
    ...(key === 'jvAssessmentDate' || key === 'wmsValidity'
      ? { style: { numFmt: 'yyyy-mm-dd' } }
      : {}),
  }));
  worksheet.getRow(1).font = { bold: true };
  for (const doc of docs) {
    const contact = doc as ApprovalContactDoc & Partial<ApprovalContactDTO>;
    const row: Record<string, string | Date> = {};
    for (const { key } of CONTACT_COLUMNS) {
      row[key] = key === 'status'
        ? (contact.status?.toLocaleLowerCase() === 'inactive' ? 'Inactive' : 'Active')
        : normalizeAuthorizationText(contact[key] ?? '');
    }
    row.srNo = contact.srNo || '';
    for (const key of ['jvAssessmentDate', 'wmsValidity'] as const) {
      const value = contact[key];
      if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        row[key] = new Date(`${value}T00:00:00.000Z`);
      }
    }
    worksheet.addRow(row);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
