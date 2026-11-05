import {
  AUTHORIZATION_LIST_DROPDOWN_FIELDS,
  isApprovalContactEligibleForRole,
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
import { normalizeAuthorizationText } from './approval-contact.service';

export const PERMIT_DROPDOWN_FIELDS = PERMIT_FIELD_LIST.filter(
  (field) =>
    ['select', 'radio', 'multiselect'].includes(field.type) &&
    !field.contactRole &&
    field.options?.length,
);

export const CONFIGURABLE_DROPDOWN_FIELDS = [
  ...PERMIT_DROPDOWN_FIELDS,
  ...AUTHORIZATION_LIST_DROPDOWN_FIELDS,
];
const AUTHORIZATION_FIELD_KEYS = new Set<string>(
  AUTHORIZATION_LIST_DROPDOWN_FIELDS.map((field) => field.key),
);
export type PermitDropdownValues = Record<string, string[]>;

const DEFAULT_OPTIONS = Object.fromEntries(
  PERMIT_DROPDOWN_FIELDS.map((field) => [field.key, [...(field.options ?? [])]]),
);
for (const field of AUTHORIZATION_LIST_DROPDOWN_FIELDS) DEFAULT_OPTIONS[field.key] = [];

export function getDefaultPermitDropdownValues(): PermitDropdownValues {
  return Object.fromEntries(
    Object.entries(DEFAULT_OPTIONS).map(([fieldKey, values]) => [fieldKey, [...values]]),
  );
}

export async function getPermitDropdownValues(): Promise<PermitDropdownValues> {
  await connectDb();
  const docs = await PermitDropdownOptionsModel.find({
    fieldKey: { $in: CONFIGURABLE_DROPDOWN_FIELDS.map((field) => field.key) },
  }).lean<PermitDropdownOptionsDoc[]>();
  const options = getDefaultPermitDropdownValues();
  for (const doc of docs) options[doc.fieldKey] = doc.values;
  const contacts = await ApprovalContactModel.find({})
    .select('name phone position wmsRole instituteName')
    .sort({ name: 1, phone: 1 })
    .lean<Array<{
      name: string;
      phone: string;
      position: string;
      wmsRole: string;
      instituteName: string;
    }>>();
  const contactRoles = ['performingAuthority', 'validationBy', 'approvedBy'] as const;
  for (const role of contactRoles) {
    options[role] = [
      ...new Set(
        contacts
          .filter((contact) => isApprovalContactEligibleForRole(contact.wmsRole, role))
          .map(
            (contact) =>
              `${normalizeAuthorizationText(contact.name)} - ${normalizeAuthorizationText(contact.phone)}`,
          ),
      ),
    ];
  }
  for (const field of AUTHORIZATION_LIST_DROPDOWN_FIELDS) {
    const storedValues = contacts
      .map((contact) => normalizeAuthorizationText(contact[field.key] ?? ''))
      .filter(Boolean);
    options[field.key] = [
      ...new Map(
        [...(options[field.key] ?? []), ...storedValues].map((value) => [
          value.toLocaleLowerCase(),
          value,
        ]),
      ).values(),
    ];
  }
  return options;
}

export async function addImportedAuthorizationDropdownValues(
  records: Array<{ position: string; wmsRole: string; instituteName: string }>,
): Promise<void> {
  const [availableOptions, storedOptions] = await Promise.all([
    getPermitDropdownValues(),
    PermitDropdownOptionsModel.find({
      fieldKey: { $in: AUTHORIZATION_LIST_DROPDOWN_FIELDS.map((field) => field.key) },
    }).lean<PermitDropdownOptionsDoc[]>(),
  ]);
  const storedByField = new Map(storedOptions.map((option) => [option.fieldKey, option.values]));
  for (const field of AUTHORIZATION_LIST_DROPDOWN_FIELDS) {
    const importedValues = records
      .map((record) => normalizeAuthorizationText(record[field.key]))
      .filter(Boolean);
    const merged = [
      ...new Map(
        [
          ...(storedByField.get(field.key) ?? []),
          ...(availableOptions[field.key] ?? []),
          ...importedValues,
        ].map((value) => [
          value.toLocaleLowerCase(),
          value,
        ]),
      ).values(),
    ];
    const stored = storedByField.get(field.key) ?? [];
    if (
      merged.length !== stored.length ||
      merged.some((value, index) => value !== stored[index])
    ) {
      await savePermitDropdownValues(field.key, merged);
    }
  }
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
  const field = CONFIGURABLE_DROPDOWN_FIELDS.find((item) => item.key === fieldKey);
  if (!field) throw notFound('Dropdown field');
  const permitField = PERMIT_DROPDOWN_FIELDS.find((item) => item.key === fieldKey);
  await connectDb();

  const normalized = values.map((value) => value.trim());
  if (normalized.some((value) => !value)) throw badRequest('Dropdown values cannot be empty');
  const maxLength = permitField?.maxLength ?? (AUTHORIZATION_FIELD_KEYS.has(fieldKey) ? 200 : 255);
  if (normalized.some((value) => value.length > maxLength)) {
    throw badRequest(`Dropdown values for ${field.header} are too long`);
  }
  if (new Set(normalized.map((value) => value.toLocaleLowerCase())).size !== normalized.length) {
    throw badRequest('Dropdown values must be unique');
  }
  const previousValues = await getPermitDropdownFieldValues(fieldKey);
  const removedValues = previousValues.filter((value) => !normalized.includes(value));
  if (removedValues.length > 0) {
    if (AUTHORIZATION_FIELD_KEYS.has(fieldKey)) {
      const usedByAuthorization = await ApprovalContactModel.exists({
        [fieldKey]: { $in: removedValues },
      });
      if (usedByAuthorization) {
        throw badRequest(
          `Cannot remove values already used by authorization records in ${field.header}. Update those records first.`,
        );
      }
    } else {
      const usedPermit = await PermitModel.exists({
        [fieldKey]: { $in: removedValues },
      });
      if (usedPermit) {
        throw badRequest(
          `Cannot remove values already used by permits in ${field.header}. Update those permits first.`,
        );
      }
    }
  }
  if (permitField?.key === 'subContractor') {
    const [assigned, usedByPermits] = await Promise.all([
      UserModel.distinct('assignedSubContractor', {
        assignedSubContractor: { $exists: true, $ne: '' },
        isDeleted: false,
      }),
      PermitModel.distinct('subContractor'),
    ]);
    const referenced = [...assigned, ...usedByPermits].filter(
      (value): value is string => typeof value === 'string',
    );
    const removed = [...new Set(referenced)].filter((value) => !normalized.includes(value));
    if (removed.length > 0) {
      throw badRequest(
        `Cannot remove sub contractors used by users, permits, or contacts: ${removed.join(', ')}`,
      );
    }
  }
  if (permitField?.fixedValue && !normalized.includes(permitField.fixedValue)) {
    throw badRequest(`${permitField.fixedValue} is a required value and cannot be removed`);
  }
  if (permitField?.required && permitField.defaultValue && !normalized.includes(permitField.defaultValue)) {
    throw badRequest(`${permitField.defaultValue} is a required default and cannot be removed`);
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
    return {
      ...allValues,
      subContractor: [assignedSubContractor],
    };
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
