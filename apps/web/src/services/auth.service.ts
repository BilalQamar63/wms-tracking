import bcrypt from 'bcryptjs';
import type { LoginInput, SessionUser } from '@wms/shared';
import { connectDb } from '@/lib/db/mongoose';
import { unauthorized } from '@/lib/http/errors';
import { UserModel } from '@/models/User';

export const PASSWORD_ROUNDS = 12;

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, PASSWORD_ROUNDS);

export async function verifyAdminCredentials({ email, password }: LoginInput): Promise<boolean> {
  await connectDb();
  const user = await UserModel.findOne({
    email: email.trim().toLowerCase(),
    role: 'admin',
    isDeleted: false,
    isActive: true,
  }).select('+passwordHash');
  return user ? bcrypt.compare(password, user.passwordHash) : false;
}

export async function authenticate({ email, password }: LoginInput): Promise<SessionUser> {
  await connectDb();
  const user = await UserModel.findOne({ email, isDeleted: false, isActive: true }).select(
    '+passwordHash name email role assignedSubContractor',
  );

  // Same message for unknown user / wrong password – avoids account enumeration.
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) throw unauthorized('Invalid email or password');

  user.lastLoginAt = new Date();
  await user.save();
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    assignedSubContractor: user.assignedSubContractor,
  };
}
