import mongoose from 'mongoose';
import { Schema, model, models, type Model, type SchemaDefinition, type Types } from 'mongoose';
import { PERMIT_FIELD_LIST, type PermitDateFieldKey, type PermitFieldKey } from '@wms/shared';

type PermitFields = {
  [K in PermitFieldKey]?: K extends PermitDateFieldKey
    ? Date
    : K extends 'certificateType'
      ? string[]
      : string;
};

export interface PermitDoc extends PermitFields {
  _id: Types.ObjectId;
  srNo: number;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  importBatchId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Field definitions are generated from the shared field config – one source of truth.
const fieldDefinition: SchemaDefinition = Object.fromEntries(
  PERMIT_FIELD_LIST.map((field) => [
    field.key,
    field.type === 'date'
      ? { type: Date }
      : field.type === 'multiselect'
        ? { type: [String], enum: field.options }
        : { type: String, trim: true, ...(field.options ? { enum: field.options } : {}) },
  ]),
);

const permitSchema = new Schema<PermitDoc>(
  {
    srNo: { type: Number, required: true, unique: true },
    ...fieldDefinition,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    importBatchId: { type: Schema.Types.ObjectId, ref: 'FileRecord', index: true },
  },
  { timestamps: true },
);

permitSchema.index({ status: 1, closedDate: -1 });
permitSchema.index({ newPtwNumber: 1 });
permitSchema.index({ company: 1 });
permitSchema.index({ importBatchId: 1, status: 1 });

export const PermitModel: Model<PermitDoc> = (() => {
  const cachedModel = models.Permit as Model<PermitDoc> | undefined;
  if (cachedModel && PERMIT_FIELD_LIST.some((field) => !cachedModel.schema.path(field.key))) {
    mongoose.deleteModel('Permit');
  }
  return (
    (models.Permit as Model<PermitDoc> | undefined) ?? model<PermitDoc>('Permit', permitSchema)
  );
})();
