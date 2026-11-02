import type {
  DailyRegisterDTO,
  DailyRegisterInput,
  SessionUser,
  ImportRowError,
  ImportStats,
} from '@wms/shared';
import { dailyRegisterInputSchema, dailyRegisterDateSchema } from '@wms/shared';
import { assignedSubContractorFor } from '@/lib/auth/permissions';
import { connectDb } from '@/lib/db/mongoose';
import { AppError, badRequest, conflict, forbidden, notFound } from '@/lib/http/errors';
import { toDailyRegisterDTO } from '@/lib/mappers';
import { reserveSequence } from '@/models/Counter';
import { DailyRegisterEntryModel } from '@/models/DailyRegisterEntry';
import { FileRecordModel } from '@/models/FileRecord';
import { assertObjectId, escapeRegex } from '@/lib/utils/object-id';
import {
  buildDailyRegisterWorkbook,
  parseDailyRegisterWorkbook,
} from '@/lib/excel/daily-register-workbook';
import { getEnv } from '@/lib/env';
import { timestampForFileName } from '@/lib/utils/file-name';

function assertEntryDate(date: string, input: DailyRegisterInput): void {
  const parsedDate = dailyRegisterDateSchema.parse(date);
  if (!input.plannedStartDate || !input.plannedEndDate) {
    throw badRequest('Planned Start Date and Planned End Date are required');
  }
  if (input.plannedEndDate < input.plannedStartDate) {
    throw badRequest('Planned End Date cannot be before Planned Start Date');
  }
  if (parsedDate < input.plannedStartDate || parsedDate > input.plannedEndDate) {
    throw badRequest('Register date must be within the permit planned start and end dates');
  }
}

function assertCanUseDailyRegister(user: SessionUser): void {
  if (user.role !== 'admin' && !assignedSubContractorFor(user)) {
    throw forbidden('A subcontractor assignment is required to use the daily register');
  }
}

function applyAssignment(input: DailyRegisterInput, user: SessionUser): DailyRegisterInput {
  const assignedSubContractor = assignedSubContractorFor(user);
  if (!assignedSubContractor) return input;
  if (
    input.subContractor &&
    input.subContractor.trim().toLowerCase() !== assignedSubContractor.toLowerCase()
  ) {
    throw badRequest(`Sub Contractor must be "${assignedSubContractor}" for your account`);
  }
  return { ...input, subContractor: assignedSubContractor };
}

async function assertUniqueNumber(
  date: string,
  ptwNumber: string | undefined,
  excludeId?: string,
): Promise<void> {
  if (!ptwNumber) return;
  const existing = await DailyRegisterEntryModel.findOne({
    date,
    ptwNumber: new RegExp(`^${escapeRegex(ptwNumber)}$`, 'i'),
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select('_id')
    .lean();
  if (existing) throw conflict(`PTW Number "${ptwNumber}" already exists in this date's register`);
}

async function createEntry(
  date: string,
  input: DailyRegisterInput,
  user: SessionUser,
): Promise<DailyRegisterDTO> {
  assertEntryDate(date, input);
  const scopedInput = applyAssignment(input, user);
  await assertUniqueNumber(date, scopedInput.ptwNumber);
  const srNo = await reserveSequence(`daily-register:${date}`);
  const cleanInput = Object.fromEntries(
    Object.entries(scopedInput).filter(([, value]) => value !== undefined && value !== ''),
  );
  const entry = await DailyRegisterEntryModel.create({
    ...cleanInput,
    date,
    srNo,
    createdBy: user.id,
    updatedBy: user.id,
  });
  return toDailyRegisterDTO(entry);
}

export async function listDailyRegister(date: string, user: SessionUser): Promise<DailyRegisterDTO[]> {
  assertCanUseDailyRegister(user);
  const selectedDate = dailyRegisterDateSchema.parse(date);
  await connectDb();
  const assignedSubContractor = assignedSubContractorFor(user);
  const docs = await DailyRegisterEntryModel.find({
    date: selectedDate,
    ...(assignedSubContractor ? { subContractor: assignedSubContractor } : {}),
  })
    .sort({ srNo: 1 })
    .lean();
  return docs.map((doc) => toDailyRegisterDTO(doc));
}

export async function addDailyRegisterEntry(
  date: string,
  input: DailyRegisterInput,
  user: SessionUser,
): Promise<DailyRegisterDTO> {
  assertCanUseDailyRegister(user);
  await connectDb();
  const entry = await createEntry(date, input, user);
  await FileRecordModel.create({
    kind: 'add',
    originalName: 'Daily register manual entry',
    bytes: 0,
    rowCount: 1,
    dailyDate: date,
    subContractors: entry.subContractor ? [entry.subContractor] : [],
    createdBy: user.id,
  });
  return entry;
}

async function getEntryForUser(id: string, user: SessionUser) {
  assertObjectId(id, 'Daily register entry');
  const assignedSubContractor = assignedSubContractorFor(user);
  const doc = await DailyRegisterEntryModel.findOne({
    _id: id,
    ...(assignedSubContractor ? { subContractor: assignedSubContractor } : {}),
  }).lean();
  if (!doc) throw notFound('Daily register entry');
  return doc;
}

export async function updateDailyRegisterEntry(
  id: string,
  input: DailyRegisterInput,
  user: SessionUser,
): Promise<DailyRegisterDTO> {
  assertCanUseDailyRegister(user);
  await connectDb();
  const existing = await getEntryForUser(id, user);
  assertEntryDate(existing.date, input);
  const scopedInput = applyAssignment(input, user);
  await assertUniqueNumber(existing.date, scopedInput.ptwNumber, id);
  const cleanInput = Object.fromEntries(
    Object.entries(scopedInput).filter(([, value]) => value !== undefined && value !== ''),
  );
  const updated = await DailyRegisterEntryModel.findByIdAndUpdate(
    id,
    { $set: { ...cleanInput, updatedBy: user.id } },
    { new: true },
  ).lean();
  if (!updated) throw notFound('Daily register entry');
  return toDailyRegisterDTO(updated);
}

export async function deleteDailyRegisterEntry(id: string, user: SessionUser): Promise<void> {
  assertCanUseDailyRegister(user);
  await connectDb();
  const existing = await getEntryForUser(id, user);
  await DailyRegisterEntryModel.deleteOne({ _id: existing._id });
}

export async function exportDailyRegister(
  date: string,
  user: SessionUser,
): Promise<{ buffer: Buffer; fileName: string }> {
  assertCanUseDailyRegister(user);
  const entries = await listDailyRegister(date, user);
  const buffer = await buildDailyRegisterWorkbook(date, entries);
  const fileName = `Daily-PTW-Register_${date}_${timestampForFileName()}.xlsx`;
  await FileRecordModel.create({
    kind: 'export',
    originalName: fileName,
    bytes: buffer.length,
    rowCount: entries.length,
    dailyDate: date,
    subContractors: [...new Set(entries.map((entry) => entry.subContractor).filter(Boolean))],
    createdBy: user.id,
  });
  return { buffer, fileName };
}

function isWithinPermitDates(date: string, input: DailyRegisterInput) {
  return !!input.plannedStartDate && !!input.plannedEndDate &&
    date >= input.plannedStartDate && date <= input.plannedEndDate;
}

export async function importDailyRegister(
  date: string,
  file: File,
  user: SessionUser,
): Promise<{ stats: ImportStats; errors: ImportRowError[] }> {
  assertCanUseDailyRegister(user);
  const selectedDate = dailyRegisterDateSchema.parse(date);
  const maxBytes = getEnv().MAX_UPLOAD_MB * 1024 * 1024;
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) throw badRequest('Only .xlsx and .xlsm files are supported');
  if (!file.size) throw badRequest('The uploaded file is empty');
  if (file.size > maxBytes) throw badRequest(`File is larger than ${getEnv().MAX_UPLOAD_MB} MB`);

  await connectDb();
  const parsed = await parseDailyRegisterWorkbook(Buffer.from(await file.arrayBuffer()));
  const errors = [...parsed.errors];
  const existingNumbers = await DailyRegisterEntryModel.find({
    date: selectedDate,
    ptwNumber: { $exists: true, $ne: '' },
  })
    .select('ptwNumber')
    .lean();
  const seenNumbers = new Set(
    existingNumbers.map((entry) => entry.ptwNumber?.trim().toLowerCase()).filter(Boolean),
  );
  let inserted = 0;
  const userSubContractor = assignedSubContractorFor(user);
  const importedSubContractors = new Set<string>();

  for (const row of parsed.rows) {
    const rowData = dailyRegisterInputSchema.safeParse(row.data);
    if (!rowData.success) {
      errors.push({ row: row.rowNumber, messages: rowData.error.issues.map((issue) => issue.message) });
      continue;
    }
    let data: DailyRegisterInput;
    try {
      data = applyAssignment(rowData.data, user);
    } catch (error) {
      if (!(error instanceof AppError) || error.status !== 400) throw error;
      errors.push({ row: row.rowNumber, messages: [error.message] });
      continue;
    }
    if (!isWithinPermitDates(selectedDate, data)) {
      errors.push({
        row: row.rowNumber,
        messages: ['The selected register date must be within the permit planned start and end dates'],
      });
      continue;
    }
    const number = data.ptwNumber?.trim().toLowerCase();
    if (number && seenNumbers.has(number)) {
      errors.push({
        row: row.rowNumber,
        messages: [`PTW Number "${data.ptwNumber}" already exists in this date's register`],
      });
      continue;
    }
    if (number) seenNumbers.add(number);
    if (data.subContractor) importedSubContractors.add(data.subContractor);
    const srNo = await reserveSequence(`daily-register:${selectedDate}`);
    const cleanInput = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined && value !== ''),
    );
    await DailyRegisterEntryModel.create({
      ...cleanInput,
      date: selectedDate,
      srNo,
      createdBy: user.id,
      updatedBy: user.id,
    });
    inserted += 1;
  }

  const stats = {
    total: parsed.totalRows,
    inserted,
    updated: 0,
    failed: errors.length,
  };
  await FileRecordModel.create({
    kind: 'import',
    originalName: file.name,
    bytes: file.size,
    rowCount: parsed.totalRows,
    dailyDate: selectedDate,
    stats,
    subContractors: [
      ...new Set([
        ...(userSubContractor ? [userSubContractor] : []),
        ...importedSubContractors,
      ]),
    ],
    importErrors: errors.slice(0, 100),
    createdBy: user.id,
  });
  return { stats, errors: errors.slice(0, 100) };
}
