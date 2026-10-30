import { z } from 'zod';
import { NextResponse } from 'next/server';
import { PERMIT_FIELD_LIST, permitFiltersSchema, type PermitFieldKey } from '@wms/shared';
import { requireUser } from '@/lib/auth/session';
import { route, searchParamsToObject } from '@/lib/http/response';
import { XLSX_MIME } from '@/lib/utils/file-name';
import { exportCompanyPermits } from '@/services/dashboard.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const fieldKeySchema = z
  .string()
  .refine(
    (key): key is PermitFieldKey => PERMIT_FIELD_LIST.some((field) => field.key === key),
    'Unknown Excel field',
  );
const exportQuerySchema = permitFiltersSchema
  .extend({
    exportStatus: z.enum(['all', 'active', 'closed']),
    mainContractor: z.string().trim().min(1).max(255),
    rowSubContractor: z.string().trim().min(1).max(255),
    fields: z.string().optional(),
  })
  .transform((query) => ({
    ...query,
    fields: query.fields
      ? query.fields.split(',').map((field) => field.trim())
      : PERMIT_FIELD_LIST.map((field) => field.key as PermitFieldKey),
  }))
  .pipe(
    z.object({
      ...permitFiltersSchema.shape,
      exportStatus: z.enum(['all', 'active', 'closed']),
      mainContractor: z.string().trim().min(1).max(255),
      rowSubContractor: z.string().trim().min(1).max(255),
      fields: z.array(fieldKeySchema).min(1, 'Select at least one Excel field'),
    }),
  );

export const GET = route(async (req) => {
  const user = await requireUser();
  const query = exportQuerySchema.parse(searchParamsToObject(req));
  const result = await exportCompanyPermits(
    query,
    query.exportStatus,
    query.mainContractor,
    query.rowSubContractor,
    query.fields,
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
