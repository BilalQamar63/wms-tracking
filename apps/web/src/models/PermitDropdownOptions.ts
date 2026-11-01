import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface PermitDropdownOptionsDoc {
  _id: Types.ObjectId;
  fieldKey: string;
  values: string[];
  createdAt: Date;
  updatedAt: Date;
}

const permitDropdownOptionsSchema = new Schema<PermitDropdownOptionsDoc>(
  {
    fieldKey: { type: String, required: true, unique: true },
    values: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const PermitDropdownOptionsModel: Model<PermitDropdownOptionsDoc> =
  (models.PermitDropdownOptions as Model<PermitDropdownOptionsDoc> | undefined) ??
  model<PermitDropdownOptionsDoc>('PermitDropdownOptions', permitDropdownOptionsSchema);
