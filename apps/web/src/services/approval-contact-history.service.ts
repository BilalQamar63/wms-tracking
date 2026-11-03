import type { ApprovalContactHistoryDTO, Paginated, UserRef } from '@wms/shared';
import { connectDb } from '@/lib/db/mongoose';
import { ApprovalContactHistoryModel, type ApprovalContactHistoryDoc } from '@/models/ApprovalContactHistory';

type PopulatedHistory = ApprovalContactHistoryDoc & {
  createdBy?: (ApprovalContactHistoryDoc['createdBy'] & { name: string; isDeleted: boolean }) | null;
};

function toHistoryDTO(doc: PopulatedHistory): ApprovalContactHistoryDTO {
  const user = doc.createdBy;
  const createdBy: UserRef | undefined =
    user && typeof user === 'object' && 'name' in user
      ? { id: String(user._id), name: user.name, isDeleted: user.isDeleted }
      : undefined;
  return {
    id: String(doc._id),
    kind: doc.kind,
    fileName: doc.fileName,
    bytes: doc.bytes,
    rowCount: doc.rowCount,
    added: doc.added,
    updated: doc.updated,
    unchanged: doc.unchanged,
    skipped: doc.skipped,
    createdBy,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listApprovalContactHistory(
  page: number,
  limit: number,
): Promise<Paginated<ApprovalContactHistoryDTO>> {
  await connectDb();
  const [docs, total] = await Promise.all([
    ApprovalContactHistoryModel.find({})
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'createdBy', select: 'name isDeleted' })
      .lean<PopulatedHistory[]>(),
    ApprovalContactHistoryModel.countDocuments(),
  ]);
  return {
    items: docs.map(toHistoryDTO),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
