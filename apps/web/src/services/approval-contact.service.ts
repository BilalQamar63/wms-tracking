import type {
  ApprovalContactDTO,
  ApprovalContactInput,
  ApprovalContactRole,
  PermitInput,
  SessionUser,
} from '@wms/shared';
import { PERMIT_FIELD_LIST } from '@wms/shared';
import { assignedSubContractorFor } from '@/lib/auth/permissions';
import { connectDb } from '@/lib/db/mongoose';
import { badRequest, notFound } from '@/lib/http/errors';
import { assertObjectId } from '@/lib/utils/object-id';
import { ApprovalContactModel, type ApprovalContactDoc } from '@/models/ApprovalContact';
import { PermitModel } from '@/models/Permit';
import { assertConfiguredSubContractor } from './dropdown-values.service';

function toApprovalContactDTO(doc: ApprovalContactDoc): ApprovalContactDTO {
  return {
    id: String(doc._id),
    role: doc.role,
    name: doc.name,
    phone: doc.phone,
    subContractor: doc.subContractor,
    displayValue: `${doc.name} - ${doc.phone}`,
  };
}

async function assertContactCanBeChanged(contact: ApprovalContactDoc): Promise<void> {
  const usedByPermit = await PermitModel.exists({
    [contact.role]: `${contact.name} - ${contact.phone}`,
    subContractor: contact.subContractor,
  });
  if (usedByPermit) {
    throw badRequest(
      'Cannot edit or delete a contact that is selected by a permit. Update those permits first.',
    );
  }
}

export async function listApprovalContacts(
  user: SessionUser,
  requestedSubContractor?: string,
): Promise<ApprovalContactDTO[]> {
  await connectDb();
  const assignedSubContractor = assignedSubContractorFor(user);
  const subContractor = assignedSubContractor ?? requestedSubContractor;
  const docs = await ApprovalContactModel.find(
    subContractor ? { subContractor } : {},
  )
    .sort({ subContractor: 1, role: 1, name: 1, phone: 1 })
    .lean<ApprovalContactDoc[]>();
  return docs.map(toApprovalContactDTO);
}

export async function createApprovalContact(
  input: ApprovalContactInput,
): Promise<ApprovalContactDTO> {
  await connectDb();
  await assertConfiguredSubContractor(input.subContractor);
  const doc = await ApprovalContactModel.create(input);
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
    if (typeof value !== 'string' || !value) continue;
    if (!parseApprovalContactValue(value)) {
      throw badRequest(`${field.header} must be formatted as "Name - mobile number"`);
    }
    if (!input.subContractor) {
      throw badRequest(`Select a sub contractor before importing ${field.header}`);
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

export async function ensureImportedApprovalContact(
  role: ApprovalContactRole,
  displayValue: string,
  subContractor: string | undefined,
): Promise<void> {
  if (!subContractor) {
    throw badRequest(`Select a sub contractor before importing ${role}`);
  }
  const parsed = parseApprovalContactValue(displayValue);
  if (!parsed) {
    throw badRequest('Approval contacts must be formatted as "Name - mobile number"');
  }
  const { name, phone } = parsed;
  await connectDb();
  await assertConfiguredSubContractor(subContractor);
  const existing = await ApprovalContactModel.exists({ role, name, phone, subContractor });
  if (!existing) {
    await ApprovalContactModel.create({ role, name, phone, subContractor });
  }
}

export async function ensureImportedPermitApprovalContacts(
  input: PermitInput,
  subContractor = input.subContractor,
): Promise<void> {
  for (const field of PERMIT_FIELD_LIST) {
    if (!field.contactRole) continue;
    const value = input[field.key as keyof PermitInput];
    if (typeof value !== 'string' || !value) continue;
    await ensureImportedApprovalContact(field.contactRole, value, subContractor);
  }
}

export async function updateApprovalContact(
  id: string,
  input: ApprovalContactInput,
): Promise<ApprovalContactDTO> {
  assertObjectId(id, 'Approval contact');
  await connectDb();
  await assertConfiguredSubContractor(input.subContractor);
  const existing = await ApprovalContactModel.findById(id).lean<ApprovalContactDoc | null>();
  if (!existing) throw notFound('Approval contact');
  if (
    existing.role !== input.role ||
    existing.name !== input.name ||
    existing.phone !== input.phone ||
    existing.subContractor !== input.subContractor
  ) {
    await assertContactCanBeChanged(existing);
  }
  const doc = await ApprovalContactModel.findByIdAndUpdate(id, { $set: input }, {
    new: true,
    runValidators: true,
  }).lean<ApprovalContactDoc | null>();
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

export function createApprovalContactSelectionValidator() {
  const contactsBySubContractor = new Map<
    string,
    Promise<Map<ApprovalContactRole, Set<string>>>
  >();

  return async (
    role: ApprovalContactRole,
    subContractor: string | undefined,
    displayValue: string,
  ): Promise<void> => {
    if (!subContractor) {
      throw badRequest(`Select a sub contractor before selecting ${role}`);
    }

    let contactsPromise = contactsBySubContractor.get(subContractor);
    if (!contactsPromise) {
      contactsPromise = connectDb().then(async () => {
        const contacts = await ApprovalContactModel.find({ subContractor })
          .select('role name phone')
          .lean<Array<Pick<ApprovalContactDoc, 'role' | 'name' | 'phone'>>>();
        const byRole = new Map<ApprovalContactRole, Set<string>>();
        for (const contact of contacts) {
          const values = byRole.get(contact.role) ?? new Set<string>();
          values.add(`${contact.name} - ${contact.phone}`);
          byRole.set(contact.role, values);
        }
        return byRole;
      });
      contactsBySubContractor.set(subContractor, contactsPromise);
    }

    const contacts = await contactsPromise;
    if (!contacts.get(role)?.has(displayValue)) {
      throw badRequest(`The selected ${role} is not available for ${subContractor}`);
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
    selected.map(({ role, value }) =>
      validateSelection(role, subContractor, value),
    ),
  );
}
