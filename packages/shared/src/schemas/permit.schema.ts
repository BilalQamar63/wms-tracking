import { z } from 'zod';
import { PERMIT_FIELD_LIST, type PermitFieldDef } from '../constants/permit-fields';
import { getTodayYmd } from '../utils/date';
import type { PermitInput } from '../types';

const emptyToUndefined = (value: unknown): unknown =>
  (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)
    ? undefined
    : value;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

function buildFieldSchema(
  field: PermitFieldDef,
  optionOverrides?: Readonly<Record<string, readonly string[]>>,
): z.ZodTypeAny {
  let base: z.ZodTypeAny;
  const options = optionOverrides?.[field.key] ?? field.options;

  if (field.fixedValue !== undefined) {
    base = z.literal(field.fixedValue, {
      errorMap: () => ({ message: `Must be ${field.fixedValue}` }),
    });
    return z.preprocess((value) => emptyToUndefined(value) ?? field.fixedValue, base);
  }

  switch (field.type) {
    case 'select':
    case 'radio': {
      if (options?.length) {
        base = z.enum(options as [string, ...string[]], {
          errorMap: () => ({ message: `Must be one of: ${options.join(', ')}` }),
        });
      } else {
        base = z.string().trim().max(field.maxLength ?? 255);
      }
      break;
    }
    case 'multiselect': {
      if (options?.length) {
        base = z.array(z.enum(options as [string, ...string[]])).max(options.length);
      } else {
        base = z.array(z.string()).max(0);
      }
      break;
    }
    case 'date':
      base = z.string().regex(DATE_PATTERN, 'Use the format YYYY-MM-DD');
      break;
    case 'computed':
      base = z.never();
      break;
    default:
      base = z
        .string()
        .trim()
        .max(field.maxLength ?? 255, `Maximum ${field.maxLength ?? 255} characters`);
  }

  if (field.required) {
    return z.preprocess(
      emptyToUndefined,
      z.string({ required_error: `${field.header} is required` }).pipe(base),
    );
  }

  return z.preprocess(emptyToUndefined, base.optional());
}

/**
 * Validation schema for creating / replacing a permit record.
 * Used by the form (client), the REST API (server) and the Excel importer.
 */
export function createPermitInputSchema(
  optionOverrides?: Readonly<Record<string, readonly string[]>>,
) {
  const shape = Object.fromEntries(
    PERMIT_FIELD_LIST.map((field) => [
      field.key,
      buildFieldSchema(field, optionOverrides),
    ]),
  );
  return z.object(shape).superRefine((value, ctx) => {
    const { planValidStartDate: start, planValidEndDate: end } = value as PermitInput;
    const today = getTodayYmd();
    for (const field of PERMIT_FIELD_LIST) {
      if (
        field.type === 'date' &&
        field.key !== 'planValidStartDate' &&
        field.key !== 'planValidEndDate' &&
        field.key !== 'closedDate' &&
        typeof value[field.key as keyof typeof value] === 'string' &&
        (value[field.key as keyof typeof value] as string) > today
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field.key],
          message: 'Date cannot be in the future',
        });
      }
    }
    if (start && end && end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['planValidEndDate'],
        message: 'End date cannot be before the start date',
      });
    }
  }) as unknown as z.ZodType<PermitInput, z.ZodTypeDef, unknown>;
}

export const permitInputSchema = createPermitInputSchema();

const optionalString = z.preprocess(emptyToUndefined, z.string().trim().optional());
const optionalDate = z.preprocess(
  emptyToUndefined,
  z.string().regex(DATE_PATTERN, 'Use the format YYYY-MM-DD').optional(),
);

export const permitFiltersSchema = z.object({
  search: optionalString,
  status: optionalString,
  department: optionalString,
  discipline: optionalString,
  plantDivision: optionalString,
  company: optionalString,
  subContractor: optionalString,
  ptwType: optionalString,
  fieldKey: z
    .string()
    .refine(
      (key) => PERMIT_FIELD_LIST.some((field) => field.key === key && field.type !== 'computed'),
      'Unknown permit field',
    )
    .optional(),
  fieldValue: optionalString,
  dateFrom: optionalDate,
  dateTo: optionalDate,
  batchId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
});

export const permitQuerySchema = permitFiltersSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['srNo', 'closedDate', 'createdAt', 'company']).default('srNo'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PermitFilters = z.infer<typeof permitFiltersSchema>;
export type PermitQuery = z.infer<typeof permitQuerySchema>;
