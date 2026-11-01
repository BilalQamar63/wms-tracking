import { z } from 'zod';
import { APPROVAL_CONTACT_ROLES } from '../constants/options';

export const approvalContactSchema = z.object({
  role: z.enum(APPROVAL_CONTACT_ROLES),
  name: z.string().trim().min(1, 'Name is required').max(80),
  phone: z.string().trim().min(1, 'Mobile number is required').max(40),
  subContractor: z.string().trim().min(1, 'Select a sub contractor'),
});

export type ApprovalContactInput = z.infer<typeof approvalContactSchema>;
