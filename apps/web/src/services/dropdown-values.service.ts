import {
  PERMIT_FIELD_LIST,
  type SessionUser,
} from '@wms/shared';
import { assignedSubContractorFor } from '@/lib/auth/permissions';
import { connectDb } from '@/lib/db/mongoose';
import { badRequest, notFound } from '@/lib/http/errors';
import { PermitDropdownOptionsModel, type PermitDropdownOptionsDoc } from '@/models/PermitDropdownOptions';
import { UserModel } from '@/models/User';
import { ApprovalContactModel } from '@/models/ApprovalContact';
import { PermitModel } from '@/models/Permit';

export const PERMIT_DROPDOWN_FIELDS = PERMIT_FIELD_LIST.filter(
  (field) =>
    ['select', 'radio', 'multiselect'].includes(field.type) &&
    !field.contactRole &&
    field.options?.length,
);

export type PermitDropdownValues = Record<string, string[]>;

const DEFAULT_OPTIONS = Object.fromEntries(
  PERMIT_DROPDOWN_FIELDS.map((field) => [field.key, [...(field.options ?? [])]]),
);

export function getDefaultPermitDropdownValues(): PermitDropdownValues {
  return Object.fromEntries(
    Object.entries(DEFAULT_OPTIONS).map(([fieldKey, values]) => [fieldKey, [...values]]),
  );
}

export async function getPermitDropdownValues(): Promise<PermitDropdownValues> {
  await connectDb();
  const docs = await PermitDropdownOptionsModel.find({
    fieldKey: { $in: PERMIT_DROPDOWN_FIELDS.map((field) => field.key) },
  }).lean<PermitDropdownOptionsDoc[]>();
  const options = getDefaultPermitDropdownValues();
  for (const doc of docs) options[doc.fieldKey] = doc.values;
  const contacts = await ApprovalContactModel.find({})
    .select('role name phone')
    .lean<Array<{ role: string; name: string; phone: string }>>();
  for (const contact of contacts) {
    const values = options[contact.role] ?? [];
    const displayValue = `${contact.name} - ${contact.phone}`;
    if (!values.includes(displayValue)) values.push(displayValue);
    options[contact.role] = values;
  }
  return options;
}

export async function getPermitDropdownFieldValues(fieldKey: string): Promise<string[]> {
  const values = await getPermitDropdownValues();
  const fieldValues = values[fieldKey];
  if (!fieldValues) throw badRequest(`"${fieldKey}" is not a configurable dropdown field`);
  return fieldValues;
}

export async function savePermitDropdownValues(
  fieldKey: string,
  values: string[],
): Promise<string[]> {
  const field = PERMIT_DROPDOWN_FIELDS.find((item) => item.key === fieldKey);
  if (!field) throw notFound('Dropdown field');
  await connectDb();

  const normalized = values.map((value) => value.trim());
  if (normalized.some((value) => !value)) throw badRequest('Dropdown values cannot be empty');
  if (normalized.some((value) => value.length > (field.maxLength ?? 255))) {
    throw badRequest(`Dropdown values for ${field.header} are too long`);
  }
  if (new Set(normalized.map((value) => value.toLocaleLowerCase())).size !== normalized.length) {
    throw badRequest('Dropdown values must be unique');
  }
  const previousValues = await getPermitDropdownFieldValues(fieldKey);
  const removedValues = previousValues.filter((value) => !normalized.includes(value));
  if (removedValues.length > 0) {
    const usedPermit = await PermitModel.exists({
      [fieldKey]: { $in: removedValues },
    });
    if (usedPermit) {
      throw badRequest(
        `Cannot remove values already used by permits in ${field.header}. Update those permits first.`,
      );
    }
  }
  if (field.key === 'subContractor') {
    const [assigned, usedByPermits, usedByContacts] = await Promise.all([
      UserModel.distinct('assignedSubContractor', {
        assignedSubContractor: { $exists: true, $ne: '' },
        isDeleted: false,
      }),
      PermitModel.distinct('subContractor'),
      ApprovalContactModel.distinct('subContractor'),
    ]);
    const referenced = [...assigned, ...usedByPermits, ...usedByContacts].filter(
      (value): value is string => typeof value === 'string',
    );
    const removed = [...new Set(referenced)].filter((value) => !normalized.includes(value));
    if (removed.length > 0) {
      throw badRequest(
        `Cannot remove sub contractors used by users, permits, or contacts: ${removed.join(', ')}`,
      );
    }
  }
  if (field.fixedValue && !normalized.includes(field.fixedValue)) {
    throw badRequest(`${field.fixedValue} is a required value and cannot be removed`);
  }
  if (field.required && field.defaultValue && !normalized.includes(field.defaultValue)) {
    throw badRequest(`${field.defaultValue} is a required default and cannot be removed`);
  }
  const requiredChoices: Record<string, string[]> = {
    status: ['Not Closed', 'Closed'],
    ptwcStatus: ['Approved', 'Rejected'],
  };
  const missingChoices = (requiredChoices[fieldKey] ?? []).filter(
    (value) => !normalized.includes(value),
  );
  if (missingChoices.length > 0) {
    throw badRequest(
      `System status values cannot be removed: ${missingChoices.join(', ')}`,
    );
  }

  await PermitDropdownOptionsModel.findOneAndUpdate(
    { fieldKey },
    { $set: { values: normalized } },
    { upsert: true, new: true, runValidators: true },
  );
  return normalized;
}

export async function listDropdownValuesForUser(user: SessionUser) {
  const allValues = await getPermitDropdownValues();
  const assignedSubContractor = assignedSubContractorFor(user);
  if (assignedSubContractor) {
    const options: PermitDropdownValues = {
      ...allValues,
      subContractor: [assignedSubContractor],
    };
    const contacts = await ApprovalContactModel.find({ subContractor: assignedSubContractor })
      .select('role name phone')
      .lean<Array<{ role: string; name: string; phone: string }>>();
    for (const role of ['performingAuthority', 'validationBy', 'approvedBy']) {
      options[role] = contacts
        .filter((contact) => contact.role === role)
        .map((contact) => `${contact.name} - ${contact.phone}`);
    }
    return options;
  }
  return allValues;
}

export async function assertConfiguredSubContractor(value?: string): Promise<void> {
  if (!value) return;
  const values = await getPermitDropdownFieldValues('subContractor');
  if (!values.includes(value)) {
    throw badRequest(`"${value}" is not a configured sub contractor`);
  }
}
