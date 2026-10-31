import type { Types } from 'mongoose';
import {
  formatPlanValidity,
  PERMIT_FIELD_LIST,
  ymdToUtcDate,
  type FileRecordDTO,
  type PermitDTO,
  type PermitInput,
  type UserDTO,
  type UserRef,
} from '@wms/shared';
import type { FileRecordDoc } from '@/models/FileRecord';
import type { PermitDoc } from '@/models/Permit';
import type { UserDoc } from '@/models/User';

type PopulatedUser = Pick<UserDoc, 'name' | 'isDeleted' | 'assignedSubContractor'> & {
  _id: Types.ObjectId;
};

const isPopulated = (value: unknown): value is PopulatedUser =>
  typeof value === 'object' && value !== null && 'name' in value;

export function toUserRef(value: unknown): UserRef | undefined {
  if (!isPopulated(value)) return undefined;
  return {
    id: String(value._id),
    name: value.name,
    isDeleted: value.isDeleted,
    assignedSubContractor: value.assignedSubContractor,
  };
}

export function toPermitDTO(doc: PermitDoc): PermitDTO {
  const dto: PermitDTO = {
    id: String(doc._id),
    srNo: doc.srNo,
    createdBy: toUserRef(doc.createdBy),
    updatedBy: toUserRef(doc.updatedBy),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };

  for (const field of PERMIT_FIELD_LIST) {
    if (field.fixedValue !== undefined) {
      (dto as unknown as Record<string, unknown>)[field.key] = field.fixedValue;
      continue;
    }
    if (field.type === 'computed') {
      (dto as unknown as Record<string, unknown>)[field.key] = formatPlanValidity(
        doc.planValidStartDate,
        doc.planValidEndDate,
      );
      continue;
    }
    const value =
      field.key === 'ptwcStatus'
        ? doc.ptwcStatus ?? (doc.approvedByPtwc ? 'Approved' : undefined)
        : doc[field.key as keyof PermitDoc];
    if (value === undefined || value === null) continue;
    (dto as unknown as Record<string, unknown>)[field.key] =
      field.type === 'date'
        ? (value as Date).toISOString()
        : field.key === 'status' && value === 'Not Start Yet'
          ? 'Not Closed'
          : field.type === 'multiselect' && typeof value === 'string'
            ? value
                .split(/[;|,\r\n]+/)
                .map((item) => item.trim())
                .filter(Boolean)
            : value;
  }
  return dto;
}

/** Splits an input payload into `$set` (values) and `$unset` (cleared fields). */
export function permitInputToUpdate(input: PermitInput): {
  set: Record<string, unknown>;
  unset: Record<string, 1>;
} {
  const set: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};

  for (const field of PERMIT_FIELD_LIST) {
    const value = input[field.key as keyof PermitInput];
    if (field.type === 'computed') {
      unset[field.key] = 1;
    } else if (field.fixedValue !== undefined) {
      set[field.key] = field.fixedValue;
    } else if (value === undefined || value === '') {
      unset[field.key] = 1;
    } else {
      set[field.key] = field.type === 'date' ? ymdToUtcDate(value as string) : value;
    }
  }
  unset.approvedByPtwc = 1;
  return { set, unset };
}

/** Like `permitInputToUpdate` but only keeps provided values (used when importing over existing rows). */
export function permitInputToPartialSet(input: PermitInput): Record<string, unknown> {
  return permitInputToUpdate(input).set;
}

export function toFileRecordDTO(doc: FileRecordDoc): FileRecordDTO {
  return {
    id: String(doc._id),
    kind: doc.kind,
    originalName: doc.originalName,
    bytes: doc.bytes,
    rowCount: doc.rowCount,
    stats: doc.stats,
    subContractors: doc.subContractors,
    importedPermits: doc.importedPermits,
    errors: doc.importErrors,
    createdBy: toUserRef(doc.createdBy),
    createdAt: doc.createdAt.toISOString(),
  };
}

export function toUserDTO(doc: UserDoc, permitCount?: number): UserDTO {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    assignedSubContractor: doc.assignedSubContractor,
    isActive: doc.isActive,
    lastLoginAt: doc.lastLoginAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    permitCount,
  };
}
