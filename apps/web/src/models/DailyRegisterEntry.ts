import { Schema, model, models, type Model, type Types } from 'mongoose';
import { DAILY_REGISTER_FIELDS } from '@wms/shared';
import type { DailyRegisterInput } from '@wms/shared';

export interface DailyRegisterEntryDoc extends DailyRegisterInput {
  _id: Types.ObjectId;
  date: string;
  srNo: number;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const fieldDefinition = Object.fromEntries(
  DAILY_REGISTER_FIELDS.filter((field) => field.type !== 'computed').map((field) => [
    field.key,
    { type: String, trim: true },
  ]),
);

const dailyRegisterEntrySchema = new Schema<DailyRegisterEntryDoc>(
  {
    date: { type: String, required: true, index: true },
    srNo: { type: Number, required: true },
    ...fieldDefinition,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

dailyRegisterEntrySchema.index({ date: 1, srNo: 1 }, { unique: true });
dailyRegisterEntrySchema.index({ date: 1, subContractor: 1 });
dailyRegisterEntrySchema.index({ date: 1, ptwNumber: 1 });

export const DailyRegisterEntryModel: Model<DailyRegisterEntryDoc> =
  (models.DailyRegisterEntry as Model<DailyRegisterEntryDoc> | undefined) ??
  model<DailyRegisterEntryDoc>('DailyRegisterEntry', dailyRegisterEntrySchema);
