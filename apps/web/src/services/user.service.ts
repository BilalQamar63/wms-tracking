import type { CreateUserInput, SessionUser, UpdateUserInput, UserDTO } from '@wms/shared';
import { connectDb } from '@/lib/db/mongoose';
import { badRequest, conflict, notFound } from '@/lib/http/errors';
import { toUserDTO } from '@/lib/mappers';
import { assertObjectId } from '@/lib/utils/object-id';
import { FileRecordModel } from '@/models/FileRecord';
import { PermitModel } from '@/models/Permit';
import { UserModel, type UserDoc } from '@/models/User';
import { hashPassword } from './auth.service';

async function countActiveAdmins(excludeId?: string): Promise<number> {
  return UserModel.countDocuments({
    role: 'admin',
    isActive: true,
    isDeleted: false,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
}

async function assertEmailAvailable(email: string, excludeId?: string): Promise<void> {
  const taken = await UserModel.exists({
    email,
    isDeleted: false,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (taken) throw conflict('A user with this email already exists');
}

async function findLiveUser(id: string): Promise<UserDoc> {
  assertObjectId(id, 'User');
  const user = await UserModel.findOne({ _id: id, isDeleted: false }).lean<UserDoc>();
  if (!user) throw notFound('User');
  return user;
}

export async function listUsers(): Promise<UserDTO[]> {
  await connectDb();
  const [users, counts] = await Promise.all([
    UserModel.find({ isDeleted: false }).sort({ createdAt: 1 }).lean<UserDoc[]>(),
    PermitModel.aggregate<{ _id: unknown; count: number }>([
      { $group: { _id: '$createdBy', count: { $sum: 1 } } },
    ]),
  ]);
  const countById = new Map(counts.map((c) => [String(c._id), c.count]));
  return users.map((user) => toUserDTO(user, countById.get(String(user._id)) ?? 0));
}

export async function createUser(input: CreateUserInput): Promise<UserDTO> {
  await connectDb();
  await assertEmailAvailable(input.email);
  const doc = await UserModel.create({
    name: input.name,
    email: input.email,
    role: input.role,
    assignedSubContractor:
      input.role === 'user' ? input.assignedSubContractor : undefined,
    passwordHash: await hashPassword(input.password),
  });
  return toUserDTO(doc.toObject() as UserDoc, 0);
}

export async function updateUser(id: string, input: UpdateUserInput, actor: SessionUser): Promise<UserDTO> {
  await connectDb();
  const target = await findLiveUser(id);
  await assertEmailAvailable(input.email, id);

  const losesAdmin = target.role === 'admin' && (input.role !== 'admin' || !input.isActive);
  if (losesAdmin && (await countActiveAdmins(id)) === 0) {
    throw conflict('At least one active administrator is required');
  }
  if (actor.id === id && !input.isActive) {
    throw badRequest('You cannot deactivate your own account');
  }

  const update: Partial<UserDoc> = {
    name: input.name,
    email: input.email,
    role: input.role,
    isActive: input.isActive,
  };
  if (input.role === 'user') update.assignedSubContractor = input.assignedSubContractor;
  if (input.password) update.passwordHash = await hashPassword(input.password);

  const saved = await UserModel.findByIdAndUpdate(
    id,
    {
      $set: update,
      ...(input.role === 'admin' ? { $unset: { assignedSubContractor: 1 } } : {}),
    },
    { new: true },
  ).lean<UserDoc>();
  if (!saved) throw notFound('User');
  return toUserDTO(saved);
}

/**
 * Deletes (soft) a user. When `replacementUserId` is given, every permit and file record
 * owned by the deleted user is re-assigned to the replacement first – so history is never orphaned.
 * Without a replacement the records keep pointing to the (soft-deleted) user and are shown as "deleted user".
 *
 * The re-assignment is idempotent, so the operation is safe to retry if it is interrupted.
 */
export async function deleteUser(
  id: string,
  replacementUserId: string | undefined,
  actor: SessionUser,
): Promise<{ reassigned: { permits: number; files: number } }> {
  await connectDb();
  const target = await findLiveUser(id);

  if (actor.id === id) throw badRequest('You cannot delete your own account');
  if (replacementUserId === id) throw badRequest('Replacement user must be a different user');

  if (target.role === 'admin' && target.isActive && (await countActiveAdmins(id)) === 0) {
    throw conflict('You cannot delete the last active administrator');
  }

  const reassigned = { permits: 0, files: 0 };

  if (replacementUserId) {
    assertObjectId(replacementUserId, 'Replacement user');
    const replacement = await UserModel.exists({
      _id: replacementUserId,
      isDeleted: false,
      isActive: true,
    });
    if (!replacement) throw badRequest('Replacement user must be an active user');

    const [created, updated, files] = await Promise.all([
      PermitModel.updateMany({ createdBy: id }, { $set: { createdBy: replacementUserId } }),
      PermitModel.updateMany({ updatedBy: id }, { $set: { updatedBy: replacementUserId } }),
      FileRecordModel.updateMany({ createdBy: id }, { $set: { createdBy: replacementUserId } }),
    ]);
    reassigned.permits = Math.max(created.modifiedCount, updated.modifiedCount);
    reassigned.files = files.modifiedCount;
  }

  await UserModel.updateOne(
    { _id: id },
    {
      $set: {
        isDeleted: true,
        isActive: false,
        deletedAt: new Date(),
        deletedBy: actor.id,
        ...(replacementUserId ? { replacedBy: replacementUserId } : {}),
      },
    },
  );

  return { reassigned };
}
