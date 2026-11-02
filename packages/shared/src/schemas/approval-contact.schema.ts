import { z } from 'zod';
import { AUTHORIZATION_STATUS_OPTIONS } from '../constants/options';

const dateOnly = z.string()
  .refine(
    (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
    'Use the format YYYY-MM-DD',
  )
  .refine((value) => {
    if (!value) return true;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Enter a valid date');

export const approvalContactSchema = z.object({
  srNo: z.string().trim().max(40).default(''),
  approvalFormNo: z.string().trim().max(100).default(''),
  company: z.string().trim().max(200).default(''),
  name: z.string().trim().max(160).default(''),
  emiratesId: z.string().trim().max(100).default(''),
  phone: z.string().trim().max(40).default(''),
  position: z.string().trim().max(200).default(''),
  wmsRole: z.string().trim().max(200).default(''),
  instituteName: z.string().trim().max(200).default(''),
  jvAssessmentDate: dateOnly.default(''),
  wmsValidity: dateOnly.default(''),
  status: z.enum(AUTHORIZATION_STATUS_OPTIONS).default('Active'),
  remarks: z.string().trim().max(1000).default(''),
});

export type ApprovalContactInput = z.infer<typeof approvalContactSchema>;
