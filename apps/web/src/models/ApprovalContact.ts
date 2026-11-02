import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface ApprovalContactDoc {
  _id: Types.ObjectId;
  srNo: string;
  approvalFormNo: string;
  company: string;
  name: string;
  emiratesId: string;
  identityKey?: string;
  phone: string;
  position: string;
  wmsRole: string;
  instituteName: string;
  jvAssessmentDate: string;
  wmsValidity: string;
  status: string;
  remarks: string;
  createdAt: Date;
  updatedAt: Date;
}

const approvalContactSchema = new Schema<ApprovalContactDoc>(
  {
    srNo: { type: String, trim: true, default: '' },
    approvalFormNo: { type: String, trim: true, default: '' },
    company: { type: String, trim: true, default: '' },
    name: { type: String, trim: true, default: '', maxlength: 160 },
    emiratesId: { type: String, trim: true, default: '' },
    identityKey: { type: String, trim: true },
    phone: { type: String, trim: true, default: '', maxlength: 40 },
    position: { type: String, trim: true, default: '' },
    wmsRole: { type: String, trim: true, default: '' },
    instituteName: { type: String, trim: true, default: '' },
    jvAssessmentDate: { type: String, trim: true, default: '' },
    wmsValidity: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    remarks: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

approvalContactSchema.index(
  { identityKey: 1 },
  { unique: true, partialFilterExpression: { identityKey: { $type: 'string' } } },
);
approvalContactSchema.index({ name: 1, phone: 1 });

export const ApprovalContactModel: Model<ApprovalContactDoc> =
  (models.ApprovalContact as Model<ApprovalContactDoc> | undefined) ??
  model<ApprovalContactDoc>('ApprovalContact', approvalContactSchema);
