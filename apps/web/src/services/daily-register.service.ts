import type {
  DailyRegisterDTO,
  DailyRegisterInput,
  SessionUser,
  ImportRowError,
  ImportStats,
  DailyRegisterPermitOptionDTO,
} from '@wms/shared';
import {
  dailyRegisterInputSchema,
  dailyRegisterDateSchema,
  PERMIT_FIELD_LIST,
  ymdToUtcDate,
} from '@wms/shared';
import { assignedSubContractorFor } from '@/lib/auth/permissions';
import { connectDb } from '@/lib/db/mongoose';
import { AppError, badRequest, conflict, forbidden, notFound } from '@/lib/http/errors';
import { toDailyRegisterDTO, toPermitDTO } from '@/lib/mappers';
import { reserveSequence } from '@/models/Counter';
import { DailyRegisterEntryModel } from '@/models/DailyRegisterEntry';
import { PermitModel, type PermitDoc } from '@/models/Permit';
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

export async function listDailyRegisterPermitSubContractors(
  date: string,
  user: SessionUser,
): Promise<string[]> {
  assertCanUseDailyRegister(user);
  const selectedDate = dailyRegisterDateSchema.parse(date);
  await connectDb();
  const assignedSubContractor = assignedSubContractorFor(user);
  const dayStart = ymdToUtcDate(selectedDate);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const values = await PermitModel.distinct('subContractor', {
    importBatchId: { $exists: false },
    status: { $ne: 'Closed' },
    newPtwNumber: { $exists: true, $ne: '' },
    planValidStartDate: { $lt: dayEnd },
    planValidEndDate: { $gte: dayStart },
    ...(assignedSubContractor ? { subContractor: assignedSubContractor } : {}),
  });
  return values
    .filter((value): value is string => typeof value === 'string' && !!value.trim())
    .map((value) => value.trim())
    .sort((left, right) => left.localeCompare(right));
}

export async function listDailyRegisterPermitOptions(
  date: string,
  subContractor: string,
  user: SessionUser,
): Promise<DailyRegisterPermitOptionDTO[]> {
  assertCanUseDailyRegister(user);
  const selectedDate = dailyRegisterDateSchema.parse(date);
  const selectedSubContractor = subContractor.trim();
  if (!selectedSubContractor) throw badRequest('Choose a sub contractor');
  const assignedSubContractor = assignedSubContractorFor(user);
  if (
    assignedSubContractor &&
    selectedSubContractor.toLowerCase() !== assignedSubContractor.toLowerCase()
  ) {
    throw forbidden('You can only select permits for your assigned sub contractor');
  }

  await connectDb();
  const dayStart = ymdToUtcDate(selectedDate);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const permitFields = PERMIT_FIELD_LIST.map((field) => field.key);
  const docs = await PermitModel.find({
    importBatchId: { $exists: false },
    subContractor: new RegExp(`^${escapeRegex(selectedSubContractor)}$`, 'i'),
    status: { $ne: 'Closed' },
    planValidStartDate: { $lt: dayEnd },
    planValidEndDate: { $gte: dayStart },
  })
    .select(['srNo', 'createdAt', 'updatedAt', ...permitFields].join(' '))
    .sort({ newPtwNumber: 1, srNo: 1 })
    .lean<PermitDoc[]>();

  return docs.flatMap((doc) => {
    const permit = toPermitDTO(doc);
    if (!permit.newPtwNumber) return [];
    const data: DailyRegisterInput = {
      plantDivision: permit.plantDivision,
      mainContractor: permit.company,
      subContractor: permit.subContractor,
      department: permit.department,
      discipline: permit.discipline,
      ptwTitle: permit.workTitle,
      workLocation: permit.workLocation,
      equipmentTagNo: permit.equipmentTagNo,
      ptwType: permit.newPtwType,
      ptwNumber: permit.newPtwNumber,
      certificateTypes: Array.isArray(permit.certificateType)
        ? permit.certificateType.join(', ')
        : undefined,
      plannedStartDate: permit.planValidStartDate?.slice(0, 10),
      plannedEndDate: permit.planValidEndDate?.slice(0, 10),
    };
    return [{ permitNumber: permit.newPtwNumber, data }];
  });
}

export interface DailyRegisterExportFilters {
  dateFrom: string;
  dateTo: string;
  shifts: Array<'day' | 'night'>;
  subContractors?: string[];
}

function assertDateRange(dateFrom: string, dateTo: string): void {
  dailyRegisterDateSchema.parse(dateFrom);
  dailyRegisterDateSchema.parse(dateTo);
  if (dateFrom > dateTo) throw badRequest('Start date cannot be after end date');
}

export async function listDailyRegisterSubContractors(
  dateFrom: string,
  dateTo: string,
  user: SessionUser,
): Promise<string[]> {
  assertCanUseDailyRegister(user);
  assertDateRange(dateFrom, dateTo);
  await connectDb();
  const assignedSubContractor = assignedSubContractorFor(user);
  const values = await DailyRegisterEntryModel.distinct('subContractor', {
    date: { $gte: dateFrom, $lte: dateTo },
    subContractor: assignedSubContractor ?? { $exists: true, $ne: '' },
  });
  return values.filter((value): value is string => typeof value === 'string' && !!value.trim())
    .sort((left, right) => left.localeCompare(right));
}

export async function listDailyRegisterForExport(
  filters: DailyRegisterExportFilters,
  user: SessionUser,
): Promise<DailyRegisterDTO[]> {
  assertCanUseDailyRegister(user);
  assertDateRange(filters.dateFrom, filters.dateTo);
  await connectDb();
  const assignedSubContractor = assignedSubContractorFor(user);
  if (
    assignedSubContractor &&
    filters.subContractors?.some((value) => value.toLowerCase() !== assignedSubContractor.toLowerCase())
  ) {
    throw forbidden('You can only export your assigned sub contractor');
  }
  const shiftMatches = filters.shifts.map((shift) => ({
    shiftDayNight: shift === 'day' ? /^\s*day\b/i : /^\s*night\b/i,
  }));
  const docs = await DailyRegisterEntryModel.find({
    date: { $gte: filters.dateFrom, $lte: filters.dateTo },
    ...(assignedSubContractor ? { subContractor: assignedSubContractor } : {}),
    ...(!assignedSubContractor && filters.subContractors
      ? { subContractor: { $in: filters.subContractors } }
      : {}),
    $or: shiftMatches,
  })
    .sort({ date: 1, srNo: 1 })
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
  const unsetClearedFields = Object.fromEntries(
    Object.entries(scopedInput)
      .filter(([, value]) => value === '')
      .map(([key]) => [key, 1]),
  );
  const updated = await DailyRegisterEntryModel.findByIdAndUpdate(
    id,
    {
      $set: { ...cleanInput, updatedBy: user.id },
      ...(Object.keys(unsetClearedFields).length ? { $unset: unsetClearedFields } : {}),
    },
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
  filters: DailyRegisterExportFilters,
  user: SessionUser,
): Promise<{ buffer: Buffer; fileName: string }> {
  assertCanUseDailyRegister(user);
  const entries = await listDailyRegisterForExport(filters, user);
  const buffer = await buildDailyRegisterWorkbook(filters.dateFrom, entries, filters.dateTo);
  const dateLabel = filters.dateFrom === filters.dateTo
    ? filters.dateFrom
    : `${filters.dateFrom}_to_${filters.dateTo}`;
  const fileName = `Daily-PTW-Register_${dateLabel}_${timestampForFileName()}.xlsx`;
  await FileRecordModel.create({
    kind: 'export',
    originalName: fileName,
    bytes: buffer.length,
    rowCount: entries.length,
    ...(filters.dateFrom === filters.dateTo ? { dailyDate: filters.dateFrom } : {}),
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
