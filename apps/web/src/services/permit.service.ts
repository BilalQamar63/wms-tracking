import type { FilterQuery } from 'mongoose';
import {
  PERMIT_FIELD_LIST,
  getTodayYmd,
  toDateInputValue,
  ymdToUtcDate,
  type ImportFieldApproval,
  type ImportPreviewDTO,
  type ImportPreviewFieldDTO,
  type ImportPreviewRowDTO,
  type Paginated,
  type PermitDTO,
  type PermitFilters,
  type PermitInput,
  type PermitQuery,
  type PermitRegisterSummaryDTO,
} from '@wms/shared';
import { connectDb } from '@/lib/db/mongoose';
import { badRequest, conflict, notFound } from '@/lib/http/errors';
import { permitInputToPartialSet, permitInputToUpdate, toPermitDTO } from '@/lib/mappers';
import { assertObjectId, escapeRegex } from '@/lib/utils/object-id';
import { reserveSequence } from '@/models/Counter';
import { PermitModel, type PermitDoc } from '@/models/Permit';
import { FileRecordModel } from '@/models/FileRecord';
import type { ParsedPermitRow } from '@/lib/excel/workbook-parser';

const POPULATE = [
  { path: 'createdBy', select: 'name isDeleted' },
  { path: 'updatedBy', select: 'name isDeleted' },
];

const SEARCH_FIELDS = [
  'company',
  'workActivity',
  'previousPtwNumber',
  'newPtwNumber',
  'workLocation',
  'equipmentTagNo',
  'approvedByPtwc',
] as const;

export async function getCurrentRegisterSummary(): Promise<PermitRegisterSummaryDTO> {
  await connectDb();
  const today = ymdToUtcDate(getTodayYmd());
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const [counts, latestPermit, latestImport] = await Promise.all([
    PermitModel.aggregate<{
      total: number;
      active: number;
      closed: number;
      notClosed: number;
    }>([
      { $match: { importBatchId: { $exists: false } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$status', 'Closed'] },
                    { $lte: ['$planValidStartDate', new Date(tomorrow.getTime() - 1)] },
                    { $gte: ['$planValidEndDate', today] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          closed: { $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] } },
          notClosed: { $sum: { $cond: [{ $eq: ['$status', 'Not Closed'] }, 1, 0] } },
        },
      },
    ]),
    PermitModel.findOne({ importBatchId: { $exists: false } })
      .sort({ updatedAt: -1 })
      .select('updatedAt')
      .lean<Pick<PermitDoc, 'updatedAt'> | null>(),
    FileRecordModel.findOne({ kind: 'import' })
      .sort({ createdAt: -1 })
      .select('createdAt')
      .lean<{ createdAt: Date } | null>(),
  ]);
  const totals = counts[0];
  const latestUpdatedAt = [latestPermit?.updatedAt, latestImport?.createdAt]
    .filter((date): date is Date => date instanceof Date)
    .sort((left, right) => right.getTime() - left.getTime())[0];

  return {
    total: totals?.total ?? 0,
    active: totals?.active ?? 0,
    closed: totals?.closed ?? 0,
    notClosed: totals?.notClosed ?? 0,
    updatedAt: latestUpdatedAt?.toISOString() ?? null,
  };
}

function buildFilter(filters: PermitFilters, batchId?: string): FilterQuery<PermitDoc> {
  const filter: FilterQuery<PermitDoc> = {};
  const conditions: FilterQuery<PermitDoc>[] = [];
  filter.importBatchId = batchId ? batchId : { $exists: false };

  if (filters.search) {
    const regex = new RegExp(escapeRegex(filters.search), 'i');
    conditions.push({ $or: SEARCH_FIELDS.map((field) => ({ [field]: regex })) });
  }
  if (filters.status === 'Closed') {
    filter.status = 'Closed';
  } else if (filters.status === 'Overdue') {
    conditions.push({
      status: { $ne: 'Closed' },
      planValidEndDate: { $lt: ymdToUtcDate(getTodayYmd()) },
    });
  } else if (filters.status === 'Active' || filters.status === 'Not Closed') {
    conditions.push({
      status: { $ne: 'Closed' },
      $or: [
        { planValidEndDate: { $gte: ymdToUtcDate(getTodayYmd()) } },
        { planValidEndDate: { $exists: false } },
      ],
    });
  }
  if (filters.department) filter.department = filters.department;
  if (filters.discipline) filter.discipline = filters.discipline;
  if (filters.plantDivision) filter.plantDivision = filters.plantDivision;
  if (filters.company) filter.company = filters.company;
  if (filters.subContractor) filter.subContractor = filters.subContractor;
  if (filters.ptwType) filter.newPtwType = filters.ptwType;

  if (filters.fieldKey && filters.fieldValue) {
    const field = PERMIT_FIELD_LIST.find((item) => item.key === filters.fieldKey);
    if (field?.type === 'date') {
      const start = ymdToUtcDate(filters.fieldValue);
      filter[filters.fieldKey] = {
        $gte: start,
        $lt: new Date(start.getTime() + 86_400_000),
      };
    } else if (field && field.type !== 'computed') {
      filter[filters.fieldKey] = new RegExp(escapeRegex(filters.fieldValue), 'i');
    }
  }

  if (filters.dateFrom || filters.dateTo) {
    filter.closedDate = {
      ...(filters.dateFrom ? { $gte: ymdToUtcDate(filters.dateFrom) } : {}),
      ...(filters.dateTo
        ? { $lt: new Date(ymdToUtcDate(filters.dateTo).getTime() + 86_400_000) }
        : {}),
    };
  }
  if (conditions.length > 0) filter.$and = conditions;
  return filter;
}

async function assertUniquePtwNumber(
  newPtwNumber: string | undefined,
  excludeId?: string,
  batchId?: string,
) {
  if (!newPtwNumber) return;
  const existing = await PermitModel.findOne({
    importBatchId: batchId ?? { $exists: false },
    newPtwNumber: new RegExp(`^${escapeRegex(newPtwNumber)}$`, 'i'),
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select('_id')
    .lean();
  if (existing) throw conflict(`New PTW Number "${newPtwNumber}" already exists`);
}

export async function listPermits(query: PermitQuery): Promise<Paginated<PermitDTO>> {
  await connectDb();
  const filter = buildFilter(query, query.batchId);
  const sort = { [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1, _id: -1 } as const;

  const [docs, total] = await Promise.all([
    PermitModel.find(filter)
      .sort(sort)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate(POPULATE)
      .lean<PermitDoc[]>(),
    PermitModel.countDocuments(filter),
  ]);

  return {
    items: docs.map(toPermitDTO),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function findPermitsForExport(
  filters: PermitFilters,
  batchId?: string,
  ptwTypes?: readonly string[],
): Promise<PermitDTO[]> {
  await connectDb();
  const filter = buildFilter(ptwTypes?.length ? { ...filters, ptwType: '' } : filters, batchId);
  const query = ptwTypes?.length
    ? ({ $and: [filter, { newPtwType: { $in: [...ptwTypes] } }] } as FilterQuery<PermitDoc>)
    : filter;
  const docs = await PermitModel.find(query).sort({ srNo: 1 }).lean<PermitDoc[]>();
  return docs.map(toPermitDTO);
}

export async function getPermit(id: string): Promise<PermitDTO> {
  assertObjectId(id, 'Permit');
  await connectDb();
  const doc = await PermitModel.findById(id).populate(POPULATE).lean<PermitDoc>();
  if (!doc) throw notFound('Permit');
  return toPermitDTO(doc);
}

export async function createPermit(
  input: PermitInput,
  userId: string,
  batchId?: string,
): Promise<PermitDTO> {
  await connectDb();
  if (batchId) {
    assertObjectId(batchId, 'Import');
    const batch = await FileRecordModel.findOne({
      _id: batchId,
      kind: 'import',
      snapshotAvailable: true,
    })
      .select('_id')
      .lean();
    if (!batch) throw notFound('Imported snapshot');
  }
  await assertUniquePtwNumber(input.newPtwNumber, undefined, batchId);

  const srNo = await reserveSequence('permit');
  const { set } = permitInputToUpdate(input);
  const doc = await PermitModel.create({
    ...set,
    srNo,
    ...(batchId ? { importBatchId: batchId } : {}),
    createdBy: userId,
    updatedBy: userId,
  });
  return getPermit(String(doc._id));
}

export async function updatePermit(
  id: string,
  input: PermitInput,
  userId: string,
): Promise<PermitDTO> {
  assertObjectId(id, 'Permit');
  await connectDb();
  const existingPermit = await PermitModel.findById(id).select('importBatchId').lean();
  if (!existingPermit) throw notFound('Permit');
  await assertUniquePtwNumber(
    input.newPtwNumber,
    id,
    existingPermit.importBatchId ? String(existingPermit.importBatchId) : undefined,
  );

  const { set, unset } = permitInputToUpdate(input);
  const updated = await PermitModel.findByIdAndUpdate(
    id,
    { $set: { ...set, updatedBy: userId }, $unset: unset },
    { new: true },
  )
    .select('_id')
    .lean();
  if (!updated) throw notFound('Permit');
  return getPermit(id);
}

export async function deletePermit(id: string): Promise<void> {
  assertObjectId(id, 'Permit');
  await connectDb();
  const result = await PermitModel.findByIdAndDelete(id).select('_id').lean();
  if (!result) throw notFound('Permit');
}

export async function deleteCurrentRegister(): Promise<number> {
  await connectDb();
  const result = await PermitModel.deleteMany({ importBatchId: { $exists: false } });
  return result.deletedCount;
}

function comparableValue(
  value: unknown,
  field: (typeof PERMIT_FIELD_LIST)[number],
): string | string[] | null {
  if (value === undefined || value === null || value === '') return null;
  if (field.type === 'date') return toDateInputValue(value as string | Date) || null;
  if (field.type === 'multiselect' && Array.isArray(value)) {
    return value.map(String).sort((a, b) => a.localeCompare(b));
  }
  if (field.key === 'status' && value === 'Not Start Yet') return 'Not Closed';
  return String(value).trim();
}

function sameValue(left: string | string[] | null, right: string | string[] | null): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function findCurrentPermitsForRows(rows: ParsedPermitRow[]): Promise<PermitDoc[]> {
  const numbers = [
    ...new Set(rows.map((row) => row.data.newPtwNumber?.trim()).filter(Boolean) as string[]),
  ];
  if (numbers.length === 0) return [];

  const docs = await PermitModel.find({
    importBatchId: { $exists: false },
    $or: numbers.map((number) => ({
      newPtwNumber: new RegExp(`^${escapeRegex(number)}$`, 'i'),
    })),
  }).lean<PermitDoc[]>();
  const matchedByNumber = new Map<string, number>();
  for (const doc of docs) {
    const key = doc.newPtwNumber?.trim().toLowerCase();
    if (key) matchedByNumber.set(key, (matchedByNumber.get(key) ?? 0) + 1);
  }
  const duplicate = [...matchedByNumber.entries()].find(([, count]) => count > 1);
  if (duplicate) {
    throw conflict(`New PTW Number "${duplicate[0]}" matches multiple current permits`);
  }
  return docs;
}

function makeImportPreviewRows(
  rows: ParsedPermitRow[],
  existingPermits: PermitDoc[],
): ImportPreviewRowDTO[] {
  const existingByNumber = new Map<string, PermitDoc>();
  for (const permit of existingPermits) {
    const key = permit.newPtwNumber?.trim().toLowerCase();
    if (key) existingByNumber.set(key, permit);
  }

  return rows.map(({ rowNumber, data }) => {
    const number = data.newPtwNumber?.trim();
    const existing = number ? existingByNumber.get(number.toLowerCase()) : undefined;
    const dto = existing ? toPermitDTO(existing) : undefined;
    const fields: ImportPreviewFieldDTO[] = [];

    for (const field of PERMIT_FIELD_LIST) {
      if (field.type === 'computed') continue;
      const newRaw = data[field.key as keyof PermitInput];
      if (newRaw === undefined || newRaw === '') continue;
      const newValue = comparableValue(newRaw, field);
      const oldValue = dto ? comparableValue(dto[field.key as keyof PermitDTO], field) : null;
      if (existing && sameValue(oldValue, newValue)) continue;
      fields.push({
        key: field.key,
        header: field.header,
        type: field.type,
        oldValue,
        newValue,
      });
    }

    return {
      rowNumber,
      action: existing ? 'update' : 'add',
      newPtwNumber: number,
      existingSrNo: existing?.srNo,
      fields,
    };
  });
}

/** Compares a parsed workbook with permits in the current register without changing data. */
export async function previewCurrentRegisterImport(
  rows: ParsedPermitRow[],
  fileName: string,
  totalRows: number,
  errors: ImportPreviewDTO['errors'],
): Promise<ImportPreviewDTO> {
  await connectDb();
  const existing = await findCurrentPermitsForRows(rows);
  return {
    fileName,
    totalRows,
    rows: makeImportPreviewRows(rows, existing),
    errors,
  };
}

/** Applies only reviewed changes and selected new rows to the current register. */
export async function applyReviewedImport(
  rows: ParsedPermitRow[],
  approvals: ImportFieldApproval[],
  addRowNumbers: number[],
  userId: string,
): Promise<{ inserted: number; updated: number }> {
  await connectDb();
  const existing = await findCurrentPermitsForRows(rows);
  const previewRows = makeImportPreviewRows(rows, existing);
  const previewByNumber = new Map(previewRows.map((row) => [row.rowNumber, row]));
  const parsedByNumber = new Map(rows.map((row) => [row.rowNumber, row]));
  const selectedAdds = new Set(addRowNumbers);
  const selectedApprovals = new Map(approvals.map((approval) => [approval.rowNumber, approval]));

  if (selectedAdds.size !== addRowNumbers.length) {
    throw badRequest('A new permit row was selected more than once');
  }
  if (selectedApprovals.size !== approvals.length) {
    throw badRequest('An import row was reviewed more than once');
  }
  for (const rowNumber of selectedAdds) {
    if (!previewByNumber.has(rowNumber) || previewByNumber.get(rowNumber)?.action !== 'add') {
      throw conflict(`Excel row ${rowNumber} no longer matches the import preview`);
    }
  }
  for (const approval of approvals) {
    if (previewByNumber.get(approval.rowNumber)?.action !== 'update') {
      throw badRequest(`Excel row ${approval.rowNumber} is not valid for this import`);
    }
  }

  if ([...selectedAdds].some((rowNumber) => selectedApprovals.has(rowNumber))) {
    throw badRequest('A permit row cannot be selected as both an update and a new permit');
  }

  const operations: Record<string, unknown>[] = [];
  for (const preview of previewRows) {
    const parsedRow = parsedByNumber.get(preview.rowNumber);
    if (!parsedRow) continue;

    if (preview.action === 'add') {
      if (!selectedAdds.has(preview.rowNumber)) continue;
      operations.push({
        insertOne: {
          document: {
            ...permitInputToPartialSet(parsedRow.data),
            srNo: 0,
            createdBy: userId,
            updatedBy: userId,
          },
        },
      });
      continue;
    }

    const approval = selectedApprovals.get(preview.rowNumber);
    if (!approval?.fields.length) continue;
    const existingPermit = existing.find(
      (permit) =>
        permit.newPtwNumber?.trim().toLowerCase() === preview.newPtwNumber?.trim().toLowerCase(),
    );
    if (!existingPermit) {
      throw conflict(`The current permit for Excel row ${preview.rowNumber} no longer exists`);
    }

    const approvedKeys = new Set<string>();
    const set: Record<string, unknown> = {};
    const expectedCurrentValues: Record<string, unknown> = {};
    for (const fieldApproval of approval.fields) {
      if (approvedKeys.has(fieldApproval.key)) {
        throw badRequest(`Duplicate field approval for Excel row ${preview.rowNumber}`);
      }
      approvedKeys.add(fieldApproval.key);
      const changedField = preview.fields.find((field) => field.key === fieldApproval.key);
      if (!changedField || !sameValue(changedField.oldValue, fieldApproval.expectedOldValue)) {
        throw conflict(
          `The current permit for Excel row ${preview.rowNumber} changed after the review was opened`,
        );
      }
      const field = PERMIT_FIELD_LIST.find((item) => item.key === fieldApproval.key);
      if (!field || field.fixedValue !== undefined || field.type === 'computed') {
        throw badRequest(`Field "${fieldApproval.key}" cannot be updated from an import`);
      }
      const value = parsedRow.data[field.key as keyof PermitInput];
      if (value === undefined || value === '') {
        throw badRequest(`Field "${field.header}" has no incoming value`);
      }
      set[field.key] = field.type === 'date' ? ymdToUtcDate(value as string) : value;
      expectedCurrentValues[field.key] = existingPermit[field.key as keyof PermitDoc] ?? null;
    }

    if (Object.keys(set).length === 0) continue;
    operations.push({
      updateOne: {
        filter: { _id: existingPermit._id, ...expectedCurrentValues },
        update: {
          $set: { ...set, updatedBy: userId },
          $unset: { ptwValidity: 1 },
        },
      },
    });
  }

  const insertOperations = operations.filter((operation) => 'insertOne' in operation);
  if (insertOperations.length > 0) {
    const firstSr = await reserveSequence('permit', insertOperations.length);
    insertOperations.forEach((operation, index) => {
      const insert = operation.insertOne as { document: Record<string, unknown> };
      insert.document.srNo = firstSr + index;
    });
  }

  if (operations.length > 0) {
    const result = await PermitModel.bulkWrite(operations as never, { ordered: true });
    const updateCount = operations.length - insertOperations.length;
    if (result.matchedCount !== updateCount || result.insertedCount !== insertOperations.length) {
      throw conflict(
        'A permit changed while the import was being applied; review the workbook again',
      );
    }
  }
  return {
    inserted: insertOperations.length,
    updated: operations.length - insertOperations.length,
  };
}
