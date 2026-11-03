import type {
  ApprovalContactDTO,
  ApprovalContactStatsDTO,
  ApprovalContactInput,
  ApprovalContactOptionDTO,
  ApprovalContactRole,
  Paginated,
  PermitInput,
} from '@wms/shared';
import { PERMIT_FIELD_LIST } from '@wms/shared';
import { connectDb } from '@/lib/db/mongoose';
import { badRequest, conflict, notFound } from '@/lib/http/errors';
import { assertObjectId } from '@/lib/utils/object-id';
import { ApprovalContactModel, type ApprovalContactDoc } from '@/models/ApprovalContact';
import { PermitModel } from '@/models/Permit';
import { normalizeAuthorizationDate } from './authorization-date';
import { escapeRegex } from '@/lib/utils/object-id';

const CONTACT_FIELDS = ['performingAuthority', 'validationBy', 'approvedBy'] as const;

export function normalizeIdentityKey(value: string): string {
  return normalizeAuthorizationText(value).replace(/[\s-]/g, '').toUpperCase();
}

export function normalizeAuthorizationText(value: string): string {
  return value.trim().replace(/^'/, '').trim();
}

function toApprovalContactDTO(doc: ApprovalContactDoc): ApprovalContactDTO {
  const name = normalizeAuthorizationText(doc.name ?? '');
  const phone = normalizeAuthorizationText(doc.phone ?? '');
  return {
    id: String(doc._id),
    srNo: normalizeAuthorizationText(doc.srNo ?? ''),
    approvalFormNo: normalizeAuthorizationText(doc.approvalFormNo ?? ''),
    company: normalizeAuthorizationText(doc.company ?? ''),
    name,
    emiratesId: normalizeAuthorizationText(doc.emiratesId ?? ''),
    phone,
    position: normalizeAuthorizationText(doc.position ?? ''),
    wmsRole: normalizeAuthorizationText(doc.wmsRole ?? ''),
    instituteName: normalizeAuthorizationText(doc.instituteName ?? ''),
    jvAssessmentDate: normalizeAuthorizationDate(doc.jvAssessmentDate ?? ''),
    wmsValidity: normalizeAuthorizationDate(doc.wmsValidity ?? ''),
    status: doc.status?.toLocaleLowerCase() === 'inactive' ? 'Inactive' : 'Active',
    remarks: normalizeAuthorizationText(doc.remarks ?? ''),
    displayValue: `${name} - ${phone}`,
  };
}

async function assertContactCanBeChanged(contact: ApprovalContactDoc): Promise<void> {
  const displayValues = [
    `${contact.name} - ${contact.phone}`,
    `${normalizeAuthorizationText(contact.name ?? '')} - ${normalizeAuthorizationText(contact.phone ?? '')}`,
  ];
  const usedByPermit = await PermitModel.exists({
    $or: CONTACT_FIELDS.map((field) => ({ [field]: { $in: displayValues } })),
  });
  if (usedByPermit) {
    throw badRequest(
      'Cannot change or delete a contact that is selected by a permit. Update those permits first.',
    );
  }
}

export async function listApprovalContacts(
  query: {
    page: number;
    limit: number;
    search?: string;
    position?: string;
    wmsRole?: string;
  },
): Promise<Paginated<ApprovalContactDTO>> {
  await connectDb();
  const filter: Record<string, unknown> = {};
  if (query.search) {
    const search = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = ['name', 'approvalFormNo', 'emiratesId', 'phone', 'position'].map((field) => ({
      [field]: search,
    }));
  }
  if (query.position) filter.position = query.position;
  if (query.wmsRole) filter.wmsRole = query.wmsRole;
  const [docs, total] = await Promise.all([
    ApprovalContactModel.aggregate<ApprovalContactDoc>([
      { $match: filter },
      {
        $addFields: {
          _srNoSort: {
            $convert: {
              input: { $trim: { input: { $ifNull: ['$srNo', ''] } } },
              to: 'long',
              onError: Number.MAX_SAFE_INTEGER,
              onNull: Number.MAX_SAFE_INTEGER,
            },
          },
        },
      },
      { $sort: { _srNoSort: 1, _id: 1 } },
      { $skip: (query.page - 1) * query.limit },
      { $limit: query.limit },
      { $project: { _srNoSort: 0 } },
    ]),
    ApprovalContactModel.countDocuments(filter),
  ]);
  return {
    items: docs.map(toApprovalContactDTO),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function getApprovalContactStats(): Promise<ApprovalContactStatsDTO> {
  await connectDb();
  const [stats] = await ApprovalContactModel.aggregate<ApprovalContactStatsDTO>([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: {
            $cond: [{ $ne: [{ $toLower: { $ifNull: ['$status', 'active'] } }, 'inactive'] }, 1, 0],
          },
        },
        inactive: {
          $sum: {
            $cond: [{ $eq: [{ $toLower: { $ifNull: ['$status', 'active'] } }, 'inactive'] }, 1, 0],
          },
        },
      },
    },
    { $project: { _id: 0, total: 1, active: 1, inactive: 1 } },
  ]);
  return stats ?? { total: 0, active: 0, inactive: 0 };
}

export async function listApprovalContactOptions(): Promise<ApprovalContactOptionDTO[]> {
  await connectDb();
  const docs = await ApprovalContactModel.find({})
    .select('name phone')
    .sort({ name: 1, phone: 1 })
    .lean<Array<Pick<ApprovalContactDoc, '_id' | 'name' | 'phone'>>>();
  return docs.map((doc) => ({
    id: String(doc._id),
    name: normalizeAuthorizationText(doc.name),
    phone: normalizeAuthorizationText(doc.phone),
    displayValue: `${normalizeAuthorizationText(doc.name)} - ${normalizeAuthorizationText(doc.phone)}`,
  }));
}

export async function createApprovalContact(
  input: ApprovalContactInput,
): Promise<ApprovalContactDTO> {
  await connectDb();
  const identityKey = normalizeIdentityKey(input.emiratesId);
  if (identityKey && await ApprovalContactModel.exists({ identityKey })) {
    throw conflict('A contact with this Emirates ID/JVUID already exists');
  }
  const doc = await ApprovalContactModel.create({
    ...input,
    ...(identityKey ? { identityKey } : {}),
  });
  return toApprovalContactDTO(doc.toObject() as ApprovalContactDoc);
}

export function parseApprovalContactValue(value: string): { name: string; phone: string } | null {
  const separator = value.lastIndexOf(' - ');
  const name = separator < 0 ? '' : value.slice(0, separator).trim();
  const phone = separator < 0 ? '' : value.slice(separator + 3).trim();
  if (!name || !phone) return null;
  return { name, phone };
}

export function assertImportedApprovalContactValues(input: PermitInput): void {
  for (const field of PERMIT_FIELD_LIST) {
    if (!field.contactRole) continue;
    const value = input[field.key as keyof PermitInput];
    if (typeof value === 'string' && value && !parseApprovalContactValue(value)) {
      throw badRequest(`${field.header} must be formatted as "Name - mobile number"`);
    }
  }
}

export function normalizeImportedApprovalContactValues(input: PermitInput): PermitInput {
  const normalized = { ...input };
  for (const field of PERMIT_FIELD_LIST) {
    if (!field.contactRole) continue;
    const value = input[field.key as keyof PermitInput];
    if (typeof value !== 'string' || !value) continue;
    const parsed = parseApprovalContactValue(value);
    if (!parsed) continue;
    const displayValue = `${parsed.name} - ${parsed.phone}`;
    if (field.key === 'performingAuthority') normalized.performingAuthority = displayValue;
    else if (field.key === 'validationBy') normalized.validationBy = displayValue;
    else if (field.key === 'approvedBy') normalized.approvedBy = displayValue;
  }
  return normalized;
}

export async function ensureImportedApprovalContact(displayValue: string): Promise<void> {
  const parsed = parseApprovalContactValue(displayValue);
  if (!parsed) {
    throw badRequest('Approval contacts must be formatted as "Name - mobile number"');
  }
  await connectDb();
  const existing = await ApprovalContactModel.exists({
    name: parsed.name,
    phone: parsed.phone,
  });
  if (!existing) {
    await ApprovalContactModel.create({
      name: parsed.name,
      phone: parsed.phone,
      emiratesId: '',
    });
  }
}

export async function ensureImportedPermitApprovalContacts(input: PermitInput): Promise<void> {
  for (const field of PERMIT_FIELD_LIST) {
    if (!field.contactRole) continue;
    const value = input[field.key as keyof PermitInput];
    if (typeof value === 'string' && value) await ensureImportedApprovalContact(value);
  }
}

export async function updateApprovalContact(
  id: string,
  input: ApprovalContactInput,
): Promise<ApprovalContactDTO> {
  assertObjectId(id, 'Approval contact');
  await connectDb();
  const existing = await ApprovalContactModel.findById(id).lean<ApprovalContactDoc | null>();
  if (!existing) throw notFound('Approval contact');

  const identityKey = normalizeIdentityKey(input.emiratesId);
  if (identityKey && identityKey !== existing.identityKey) {
    if (await ApprovalContactModel.exists({ identityKey, _id: { $ne: id } })) {
      throw conflict('A contact with this Emirates ID/JVUID already exists');
    }
  }

  if (existing.name !== input.name || existing.phone !== input.phone) {
    await assertContactCanBeChanged(existing);
  }

  const doc = await ApprovalContactModel.findByIdAndUpdate(
    id,
    {
      $set: {
        ...input,
        ...(!identityKey && existing.emiratesId ? { emiratesId: existing.emiratesId } : {}),
        ...(identityKey ? { identityKey } : {}),
      },
    },
    { new: true, runValidators: true },
  ).lean<ApprovalContactDoc | null>();
  if (!doc) throw notFound('Approval contact');
  return toApprovalContactDTO(doc);
}

export async function deleteApprovalContact(id: string): Promise<void> {
  assertObjectId(id, 'Approval contact');
  await connectDb();
  const existing = await ApprovalContactModel.findById(id).lean<ApprovalContactDoc | null>();
  if (!existing) throw notFound('Approval contact');
  await assertContactCanBeChanged(existing);
  await ApprovalContactModel.findByIdAndDelete(id);
}

export async function deleteApprovalContacts(ids: string[]): Promise<number> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) throw badRequest('Select at least one authorization to delete');
  uniqueIds.forEach((id) => assertObjectId(id, 'Authorization'));

  await connectDb();
  const contacts = await ApprovalContactModel.find({ _id: { $in: uniqueIds } })
    .lean<ApprovalContactDoc[]>();
  if (contacts.length !== uniqueIds.length) {
    throw notFound('One or more selected authorizations');
  }

  await assertApprovalContactsCanBeDeleted(contacts);

  const result = await ApprovalContactModel.deleteMany({ _id: { $in: uniqueIds } });
  if (result.deletedCount !== uniqueIds.length) {
    throw conflict('The authorization list changed during deletion; refresh and try again');
  }
  return result.deletedCount;
}

export async function deleteAllApprovalContacts(): Promise<number> {
  await connectDb();
  const contacts = await ApprovalContactModel.find({}).lean<ApprovalContactDoc[]>();
  if (contacts.length === 0) return 0;

  await assertApprovalContactsCanBeDeleted(contacts);

  const ids = contacts.map((contact) => contact._id);
  const result = await ApprovalContactModel.deleteMany({ _id: { $in: ids } });
  if (result.deletedCount !== ids.length) {
    throw conflict('The authorization list changed during deletion; refresh and try again');
  }
  return result.deletedCount;
}

async function assertApprovalContactsCanBeDeleted(
  contacts: ApprovalContactDoc[],
): Promise<void> {
  const displayValues = contacts.flatMap((contact) => [
    `${contact.name} - ${contact.phone}`,
    `${normalizeAuthorizationText(contact.name ?? '')} - ${normalizeAuthorizationText(contact.phone ?? '')}`,
  ]);
  const usedByPermit = await PermitModel.exists({
    $or: CONTACT_FIELDS.map((field) => ({ [field]: { $in: displayValues } })),
  });
  if (usedByPermit) {
    throw badRequest(
      'Cannot delete selected authorizations that are used by permits. Remove them from those permits first.',
    );
  }
}

export function createApprovalContactSelectionValidator() {
  let contactsPromise: Promise<Set<string>> | undefined;

  return async (
    _role: ApprovalContactRole,
    _subContractor: string | undefined,
    displayValue: string,
  ): Promise<void> => {
    contactsPromise ??= connectDb().then(async () => {
      const contacts = await ApprovalContactModel.find({})
        .select('name phone')
        .lean<Array<Pick<ApprovalContactDoc, 'name' | 'phone'>>>();
      return new Set(
        contacts.flatMap((contact) => [
          `${contact.name} - ${contact.phone}`,
          `${normalizeAuthorizationText(contact.name)} - ${normalizeAuthorizationText(contact.phone)}`,
        ]),
      );
    });

    if (!(await contactsPromise).has(displayValue)) {
      throw badRequest('The selected approval contact is not available');
    }
  };
}

export async function assertPermitApprovalContacts(
  input: PermitInput,
  subContractor = input.subContractor,
  validateSelection = createApprovalContactSelectionValidator(),
): Promise<void> {
  const selected: Array<{ role: ApprovalContactRole; value: string }> = [];
  for (const field of PERMIT_FIELD_LIST) {
    if (!field.contactRole) continue;
    const value = input[field.key as keyof PermitInput];
    if (typeof value === 'string' && value) {
      selected.push({ role: field.contactRole, value });
    }
  }
  await Promise.all(
    selected.map(({ role, value }) => validateSelection(role, subContractor, value)),
  );
}
