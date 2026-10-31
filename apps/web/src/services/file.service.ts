import type {
  FileKind,
  FileQuery,
  FileRecordDTO,
  ImportFieldApproval,
  ImportPreviewDTO,
  ImportResultDTO,
  Paginated,
  SessionUser,
  PermitFieldKey,
} from '@wms/shared';
import { ymdToUtcDate } from '@wms/shared';
import type { FilterQuery } from 'mongoose';
import { assignedSubContractorFor } from '@/lib/auth/permissions';
import { connectDb } from '@/lib/db/mongoose';
import { parsePermitWorkbook } from '@/lib/excel/workbook-parser';
import { buildPermitWorkbook } from '@/lib/excel/workbook-builder';
import { getEnv } from '@/lib/env';
import { badRequest, forbidden, notFound } from '@/lib/http/errors';
import { toFileRecordDTO } from '@/lib/mappers';
import { timestampForFileName } from '@/lib/utils/file-name';
import { assertObjectId } from '@/lib/utils/object-id';
import { FileRecordModel, type FileRecordDoc } from '@/models/FileRecord';
import {
  applyReviewedImport,
  findPermitsForExport,
  previewCurrentRegisterImport,
} from './permit.service';
import type { PermitFilters, PermitImportDayDTO } from '@wms/shared';
import { PermitModel } from '@/models/Permit';

const POPULATE = { path: 'createdBy', select: 'name isDeleted assignedSubContractor' };
const MAX_STORED_ERRORS = 100;

export async function listFiles(query: FileQuery): Promise<Paginated<FileRecordDTO>> {
  await connectDb();
  const filter: FilterQuery<FileRecordDoc> = {};
  if (query.kind) filter.kind = query.kind;
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {
      ...(query.dateFrom ? { $gte: ymdToUtcDate(query.dateFrom) } : {}),
      // inclusive end-of-day
      ...(query.dateTo ? { $lt: new Date(ymdToUtcDate(query.dateTo).getTime() + 86_400_000) } : {}),
    };
  }

  const [docs, total] = await Promise.all([
    FileRecordModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate(POPULATE)
      .select('-importErrors')
      .lean<FileRecordDoc[]>(),
    FileRecordModel.countDocuments(filter),
  ]);

  return {
    items: docs.map(toFileRecordDTO),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function listPermitImportDays(): Promise<PermitImportDayDTO[]> {
  await connectDb();
  const files = await FileRecordModel.find({ kind: 'import' })
    .sort({ createdAt: -1 })
    .select('_id originalName createdAt snapshotAvailable stats')
    .lean<
      Array<
        Pick<FileRecordDoc, '_id' | 'originalName' | 'createdAt' | 'snapshotAvailable' | 'stats'>
      >
    >();
  if (files.length === 0) return [];

  const counts = await PermitModel.aggregate<{ _id: string; total: number; closed: number }>([
    { $match: { importBatchId: { $exists: true } } },
    {
      $group: {
        _id: { $toString: '$importBatchId' },
        total: { $sum: 1 },
        closed: { $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] } },
      },
    },
  ]);
  const countsById = new Map(counts.map((count) => [count._id, count]));
  const grouped = new Map<string, PermitImportDayDTO>();
  const dateFormatter = new Intl.DateTimeFormat('en', {
    timeZone: getEnv().APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  for (const file of files) {
    const id = String(file._id);
    const count = countsById.get(id);
    const dateParts = dateFormatter.formatToParts(file.createdAt);
    const dateValues = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
    const date = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
    const day = grouped.get(date) ?? { date, total: 0, closed: 0, batches: [] };
    const batch = {
      id,
      originalName: file.originalName,
      createdAt: file.createdAt.toISOString(),
      total: count?.total ?? 0,
      closed: count?.closed ?? 0,
      available: file.snapshotAvailable === true,
      stats: file.stats,
    };
    day.batches.push(batch);
    day.total += batch.total;
    day.closed += batch.closed;
    grouped.set(date, day);
  }

  return [...grouped.values()];
}

async function getFileDoc(id: string): Promise<FileRecordDoc> {
  assertObjectId(id, 'File');
  await connectDb();
  const doc = await FileRecordModel.findById(id).populate(POPULATE).lean<FileRecordDoc>();
  if (!doc) throw notFound('File');
  return doc;
}

function assertValidImportFile(file: File): void {
  const maxBytes = getEnv().MAX_UPLOAD_MB * 1024 * 1024;
  if (!/\.(xlsx|xlsm)$/i.test(file.name))
    throw badRequest('Only .xlsx and .xlsm files are supported');
  if (file.size === 0) throw badRequest('The uploaded file is empty');
  if (file.size > maxBytes) throw badRequest(`File is larger than ${getEnv().MAX_UPLOAD_MB} MB`);
}

async function parseImportFile(file: File) {
  assertValidImportFile(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  return parsePermitWorkbook(buffer);
}

/** Parses an upload and previews changes without modifying the current register. */
function filterRowsForAssignment(
  rows: Awaited<ReturnType<typeof parseImportFile>>['rows'],
  assignedSubContractor: string | undefined,
) {
  if (!assignedSubContractor) return { rows, errors: [] as ImportPreviewDTO['errors'] };
  const allowed: typeof rows = [];
  const errors: ImportPreviewDTO['errors'] = [];
  for (const row of rows) {
    if (row.data.subContractor?.trim().toLowerCase() === assignedSubContractor.toLowerCase()) {
      allowed.push(row);
    } else {
      errors.push({
        row: row.rowNumber,
        messages: [`Sub Contractor must be "${assignedSubContractor}" for your account`],
      });
    }
  }
  return { rows: allowed, errors };
}

export async function previewPermitFile(file: File, user: SessionUser): Promise<ImportPreviewDTO> {
  const parsed = await parseImportFile(file);
  const assignedSubContractor = assignedSubContractorFor(user);
  const scoped = filterRowsForAssignment(parsed.rows, assignedSubContractor);
  const preview = await previewCurrentRegisterImport(
    scoped.rows,
    file.name,
    parsed.totalRows,
    [...parsed.errors, ...scoped.errors].slice(0, MAX_STORED_ERRORS),
  );
  if (!assignedSubContractor) return preview;

  const existingRows = preview.rows.filter((row) => row.action === 'update');
  return {
    ...preview,
    rows: preview.rows.filter((row) => row.action === 'add'),
    errors: [
      ...preview.errors,
      ...existingRows.map((row) => ({
        row: row.rowNumber,
        messages: ['This permit already exists. Users can only add new permits.'],
      })),
    ].slice(0, MAX_STORED_ERRORS),
  };
}

/** Applies the reviewed fields and records an audit entry, without creating a permit snapshot. */
export async function commitPermitFile(
  file: File,
  user: SessionUser,
  approvals: ImportFieldApproval[],
  addRowNumbers: number[],
): Promise<ImportResultDTO> {
  const parsed = await parseImportFile(file);
  const assignedSubContractor = assignedSubContractorFor(user);
  const scoped = filterRowsForAssignment(parsed.rows, assignedSubContractor);
  let importRows = scoped.rows;
  let importApprovals = approvals;
  let importErrors = [...parsed.errors, ...scoped.errors];

  if (assignedSubContractor) {
    if (approvals.length > 0) {
      throw badRequest('Users can only add new permits and cannot update existing permits');
    }
    const preview = await previewCurrentRegisterImport(
      importRows,
      file.name,
      parsed.totalRows,
      importErrors,
    );
    const existingRows = preview.rows.filter((row) => row.action === 'update');
    importErrors = [
      ...preview.errors,
      ...existingRows.map((row) => ({
        row: row.rowNumber,
        messages: ['This permit already exists. Users can only add new permits.'],
      })),
    ];
    const allowedRows = new Set(
      preview.rows.filter((row) => row.action === 'add').map((row) => row.rowNumber),
    );
    if (addRowNumbers.some((rowNumber) => !allowedRows.has(rowNumber))) {
      throw badRequest('Only new permits for your assigned sub contractor can be added');
    }
    importRows = importRows.filter((row) => allowedRows.has(row.rowNumber));
    importApprovals = [];
  }

  const { inserted, updated, addedPermits } = await applyReviewedImport(
    importRows,
    importApprovals,
    addRowNumbers,
    user.id,
  );
  const stats = {
    total: parsed.totalRows,
    inserted,
    updated,
    failed: importErrors.length,
  };

  const record = await FileRecordModel.create({
    kind: 'import',
    originalName: file.name,
    bytes: file.size,
    rowCount: parsed.totalRows,
    snapshotAvailable: false,
    stats,
    subContractors: [
      ...new Set(importRows.map((row) => row.data.subContractor?.trim()).filter(Boolean)),
    ] as string[],
    importedPermits: addedPermits,
    importErrors: importErrors.slice(0, MAX_STORED_ERRORS),
    createdBy: user.id,
  });

  const saved = await getFileDoc(String(record._id));
  return { file: toFileRecordDTO(saved), stats, errors: importErrors.slice(0, MAX_STORED_ERRORS) };
}

/** Builds an Excel download and records export metadata in MongoDB. */
export async function exportPermitFile(
  filters: PermitFilters,
  user: SessionUser,
  fieldKeys?: readonly PermitFieldKey[],
  ptwTypes?: readonly string[],
): Promise<{ buffer: Buffer; fileName: string }> {
  const permits = await findPermitsForExport(filters, filters.batchId, ptwTypes);
  const buffer = await buildPermitWorkbook(permits, fieldKeys);
  const fileName = `PTW-Register_${timestampForFileName()}.xlsx`;

  const record = await FileRecordModel.create({
    kind: 'export' satisfies FileKind,
    originalName: fileName,
    bytes: buffer.length,
    rowCount: permits.length,
    subContractors: [...new Set(permits.map((permit) => permit.subContractor).filter(Boolean))],
    createdBy: user.id,
  });

  return { buffer, fileName };
}

export async function getFileDetails(id: string): Promise<FileRecordDTO> {
  return toFileRecordDTO(await getFileDoc(id));
}

/** Only admins or the user who created the record may delete it. */
export async function deleteFile(id: string, user: SessionUser): Promise<void> {
  if (user.role !== 'admin') throw forbidden('Administrator access required');
  const doc = await getFileDoc(id);

  if (doc.kind === 'import') await PermitModel.deleteMany({ importBatchId: id });
  await FileRecordModel.deleteOne({ _id: id });
}
