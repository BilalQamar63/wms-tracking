import { z } from 'zod';
import { NextResponse } from 'next/server';
import {
  PERMIT_FIELD_LIST,
  permitFiltersSchema,
  type PermitFieldKey,
} from '@wms/shared';
import { requireAdmin } from '@/lib/auth/session';
import { route, searchParamsToObject } from '@/lib/http/response';
import { XLSX_MIME } from '@/lib/utils/file-name';
import { exportCompanyPermits } from '@/services/dashboard.service';
import { getPermitDropdownValues } from '@/services/dropdown-values.service';
import { badRequest } from '@/lib/http/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const fieldKeySchema = z
  .string()
  .refine(
    (key): key is PermitFieldKey =>
      PERMIT_FIELD_LIST.some((field) => field.key === key && field.exportToExcel !== false),
    'Unknown Excel field',
  );
const exportQuerySchema = permitFiltersSchema
  .extend({
    exportStatus: z.enum(['all', 'active', 'closed', 'overdue']),
    mainContractor: z.string().trim().min(1).max(255),
    rowSubContractor: z.string().trim().min(1).max(255),
    fields: z.string().optional(),
    ptwTypes: z.string().optional(),
  })
  .transform((query) => ({
    ...query,
    fields: query.fields
      ? query.fields.split(',').map((field) => field.trim())
      : PERMIT_FIELD_LIST.filter((field) => field.exportToExcel !== false).map(
          (field) => field.key as PermitFieldKey,
        ),
    ptwTypes: query.ptwTypes
      ? query.ptwTypes.split(',').map((value) => value.trim())
      : undefined,
  }))
  .pipe(
    z.object({
      ...permitFiltersSchema.shape,
      exportStatus: z.enum(['all', 'active', 'closed', 'overdue']),
      mainContractor: z.string().trim().min(1).max(255),
      rowSubContractor: z.string().trim().min(1).max(255),
      fields: z.array(fieldKeySchema).min(1, 'Select at least one Excel field'),
      ptwTypes: z.array(z.string().trim().min(1)).min(1, 'Select at least one PTW type').optional(),
    }),
  );

export const GET = route(async (req) => {
  const user = await requireAdmin();
  const query = exportQuerySchema.parse(searchParamsToObject(req));
  const configuredPtwTypes = (await getPermitDropdownValues()).newPtwType ?? [];
  const ptwTypes = query.ptwTypes ?? configuredPtwTypes;
  if (ptwTypes.length === 0 || ptwTypes.some((ptwType) => !configuredPtwTypes.includes(ptwType))) {
    throw badRequest('One or more selected PTW types are no longer configured');
  }
  const result = await exportCompanyPermits(
    query,
    query.exportStatus,
    query.mainContractor,
    query.rowSubContractor,
    query.fields,
    ptwTypes,
    user,
  );

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
});
