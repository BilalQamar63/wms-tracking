import type { FilterQuery } from 'mongoose';
import {
  ymdToUtcDate,
  type Paginated,
  type PermitDTO,
  type PermitFilters,
  type PermitInput,
  type PermitQuery,
} from '@wms/shared';
import { connectDb } from '@/lib/db/mongoose';
import { conflict, notFound } from '@/lib/http/errors';
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

function buildFilter(filters: PermitFilters, batchId?: string): FilterQuery<PermitDoc> {
  const filter: FilterQuery<PermitDoc> = {};
  filter.importBatchId = batchId ? batchId : { $exists: false };

  if (filters.search) {
    const regex = new RegExp(escapeRegex(filters.search), 'i');
    filter.$or = SEARCH_FIELDS.map((field) => ({ [field]: regex }));
  }
  if (filters.status) filter.status = filters.status;
  if (filters.department) filter.department = filters.department;
  if (filters.discipline) filter.discipline = filters.discipline;
  if (filters.plantDivision) filter.plantDivision = filters.plantDivision;

  if (filters.dateFrom || filters.dateTo) {
    filter.closedDate = {
      ...(filters.dateFrom ? { $gte: ymdToUtcDate(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { $lte: ymdToUtcDate(filters.dateTo) } : {}),
    };
  }
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
): Promise<PermitDTO[]> {
  await connectDb();
  const docs = await PermitModel.find(buildFilter(filters, batchId))
    .sort({ srNo: 1 })
    .lean<PermitDoc[]>();
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

export interface UpsertResult {
  inserted: number;
  updated: number;
}

/**
 * Bulk import. A row whose "New PTW Number" matches an existing permit updates that permit
 * (only the cells that contain a value); every other row is inserted with a new Sr No.
 * If the same PTW number appears twice in the file, the last occurrence wins.
 */
export async function upsertPermits(
  rows: ParsedPermitRow[],
  userId: string,
): Promise<UpsertResult> {
  if (rows.length === 0) return { inserted: 0, updated: 0 };
  await connectDb();

  // De-duplicate by PTW number inside the file (last one wins).
  const byNumber = new Map<string, ParsedPermitRow>();
  const unnumbered: ParsedPermitRow[] = [];
  for (const row of rows) {
    const key = row.data.newPtwNumber?.toLowerCase();
    if (key) byNumber.set(key, row);
    else unnumbered.push(row);
  }

  const unique = [...byNumber.values(), ...unnumbered];

  const numbers = [...byNumber.keys()];
  const existing = numbers.length
    ? await PermitModel.find({
        importBatchId: { $exists: false },
        newPtwNumber: { $in: [...byNumber.values()].map((r) => r.data.newPtwNumber as string) },
      })
        .select('_id newPtwNumber')
        .lean()
    : [];
  const existingByNumber = new Map(
    existing.map((doc) => [doc.newPtwNumber?.toLowerCase(), doc._id]),
  );

  const toInsert = unique.filter((r) => !existingByNumber.has(r.data.newPtwNumber?.toLowerCase()));
  const toUpdate = unique.filter((r) => existingByNumber.has(r.data.newPtwNumber?.toLowerCase()));

  const firstSr = toInsert.length ? await reserveSequence('permit', toInsert.length) : 0;

  const operations = [
    ...toInsert.map((row, index) => ({
      insertOne: {
        document: {
          ...permitInputToPartialSet(row.data),
          srNo: firstSr + index,
          createdBy: userId,
          updatedBy: userId,
        },
      },
    })),
    ...toUpdate.map((row) => ({
      updateOne: {
        filter: { _id: existingByNumber.get(row.data.newPtwNumber?.toLowerCase()) },
        update: { $set: { ...permitInputToPartialSet(row.data), updatedBy: userId } },
      },
    })),
  ];

  // Cast: Mongoose's bulkWrite generics don't model the dynamic field set.
  await PermitModel.bulkWrite(operations as never, { ordered: false });
  return { inserted: toInsert.length, updated: toUpdate.length };
}

/** Saves the exact successfully parsed rows as an independently selectable import batch. */
export async function createPermitSnapshot(
  rows: ParsedPermitRow[],
  batchId: string,
  userId: string,
): Promise<number> {
  if (rows.length === 0) return 0;
  await connectDb();

  const firstSr = await reserveSequence('permit', rows.length);
  const documents = rows.map((row, index) => ({
    ...permitInputToPartialSet(row.data),
    srNo: firstSr + index,
    importBatchId: batchId,
    createdBy: userId,
    updatedBy: userId,
  }));
  await PermitModel.insertMany(documents, { ordered: true });
  return documents.length;
}
