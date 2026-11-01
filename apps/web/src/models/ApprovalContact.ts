import { Schema, model, models, type Model, type Types } from 'mongoose';
import { APPROVAL_CONTACT_ROLES, type ApprovalContactRole } from '@wms/shared';

export interface ApprovalContactDoc {
  _id: Types.ObjectId;
  role: ApprovalContactRole;
  name: string;
  phone: string;
  subContractor: string;
  createdAt: Date;
  updatedAt: Date;
}

const approvalContactSchema = new Schema<ApprovalContactDoc>(
  {
    role: { type: String, enum: APPROVAL_CONTACT_ROLES, required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    subContractor: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

approvalContactSchema.index({ subContractor: 1, role: 1, name: 1 });

export const ApprovalContactModel: Model<ApprovalContactDoc> =
  (models.ApprovalContact as Model<ApprovalContactDoc> | undefined) ??
  model<ApprovalContactDoc>('ApprovalContact', approvalContactSchema);
