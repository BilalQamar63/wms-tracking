import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface ApprovalContactHistoryDoc {
  _id: Types.ObjectId;
  kind: 'import' | 'export';
  fileName: string;
  bytes: number;
  rowCount: number;
  added?: number;
  updated?: number;
  unchanged?: number;
  skipped?: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const approvalContactHistorySchema = new Schema<ApprovalContactHistoryDoc>(
  {
    kind: { type: String, enum: ['import', 'export'], required: true, index: true },
    fileName: { type: String, required: true },
    bytes: { type: Number, required: true, default: 0 },
    rowCount: { type: Number, required: true, default: 0 },
    added: Number,
    updated: Number,
    unchanged: Number,
    skipped: Number,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

approvalContactHistorySchema.index({ createdAt: -1 });

export const ApprovalContactHistoryModel: Model<ApprovalContactHistoryDoc> =
  (models.ApprovalContactHistory as Model<ApprovalContactHistoryDoc> | undefined) ??
  model<ApprovalContactHistoryDoc>('ApprovalContactHistory', approvalContactHistorySchema);
