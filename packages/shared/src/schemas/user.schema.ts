import { z } from 'zod';
import { SUB_CONTRACTORS, USER_ROLES } from '../constants/options';

const email = z.string().trim().toLowerCase().email('Enter a valid email address');
const password = z.string().min(8, 'Password must be at least 8 characters').max(72);
const emptyToUndefined = (v: unknown): unknown => (typeof v === 'string' && v === '' ? undefined : v);
const ymd = z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional());

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email,
  password,
  role: z.enum(USER_ROLES).default('user'),
  assignedSubContractor: z.preprocess(
    emptyToUndefined,
    z.enum(SUB_CONTRACTORS).optional(),
  ),
}).superRefine((user, ctx) => {
  if (user.role === 'user' && !user.assignedSubContractor) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['assignedSubContractor'],
      message: 'Select a sub contractor for this user',
    });
  }
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email,
  /** Leave empty to keep the current password. */
  password: z.preprocess(emptyToUndefined, password.optional()),
  role: z.enum(USER_ROLES),
  assignedSubContractor: z.preprocess(
    emptyToUndefined,
    z.enum(SUB_CONTRACTORS).optional(),
  ),
  isActive: z.boolean(),
}).superRefine((user, ctx) => {
  if (user.role === 'user' && !user.assignedSubContractor) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['assignedSubContractor'],
      message: 'Select a sub contractor for this user',
    });
  }
});

export const deleteUserQuerySchema = z.object({
  /** When provided, all records owned by the deleted user are re-assigned to this user. */
  replacementUserId: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user id').optional(),
  ),
});

export const fileQuerySchema = z.object({
  kind: z.preprocess(emptyToUndefined, z.enum(['import', 'export', 'add']).optional()),
  dateFrom: ymd,
  dateTo: ymd,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type FileQuery = z.infer<typeof fileQuerySchema>;
