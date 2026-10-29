import { Schema, model, models, type Model, type Types } from 'mongoose';
import type { FileKind, ImportRowError, ImportStats } from '@wms/shared';

export interface FileRecordDoc {
  _id: Types.ObjectId;
  kind: FileKind;
  originalName: string;
  /** Present only on legacy records created before file storage was removed. */
  publicId?: string;
  bytes: number;
  rowCount: number;
  snapshotAvailable?: boolean;
  stats?: ImportStats;
  importErrors?: ImportRowError[];
  createdBy?: Types.ObjectId;
  /** Creation time == the import / export date shown in the history list. */
  createdAt: Date;
  updatedAt: Date;
}

const fileRecordSchema = new Schema<FileRecordDoc>(
  {
    kind: { type: String, enum: ['import', 'export'], required: true, index: true },
    originalName: { type: String, required: true },
    publicId: { type: String },
    bytes: { type: Number, default: 0 },
    rowCount: { type: Number, default: 0 },
    snapshotAvailable: { type: Boolean, default: false },
    stats: {
      type: new Schema(
        { total: Number, inserted: Number, updated: Number, failed: Number },
        { _id: false },
      ),
    },
    importErrors: {
      type: [new Schema({ row: Number, messages: [String] }, { _id: false })],
      default: undefined,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true },
);

fileRecordSchema.index({ createdAt: -1 });

export const FileRecordModel: Model<FileRecordDoc> =
  (models.FileRecord as Model<FileRecordDoc> | undefined) ??
  model<FileRecordDoc>('FileRecord', fileRecordSchema);
