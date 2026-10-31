import { Schema, model, models, type Model, type Types } from 'mongoose';
import { SUB_CONTRACTORS, USER_ROLES, type Role } from '@wms/shared';

export interface UserDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  assignedSubContractor?: string;
  isActive: boolean;
  /** Soft-delete flag – records created by the user keep a valid reference. */
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  /** User that took over this user's records when they were deleted. */
  replacedBy?: Types.ObjectId;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: 'user', required: true },
    assignedSubContractor: { type: String, trim: true, enum: SUB_CONTRACTORS },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    replacedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

// Email must be unique among live users only, so a deleted user's email can be re-used.
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

export const UserModel: Model<UserDoc> =
  (models.User as Model<UserDoc> | undefined) ?? model<UserDoc>('User', userSchema);
