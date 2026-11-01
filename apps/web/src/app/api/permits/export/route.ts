import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  PERMIT_FIELD_LIST,
  permitFiltersSchema,
  type PermitFieldKey,
} from '@wms/shared';
import { requireAdmin } from '@/lib/auth/session';
import { route, searchParamsToObject } from '@/lib/http/response';
import { XLSX_MIME } from '@/lib/utils/file-name';
import { exportPermitFile } from '@/services/file.service';
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
    fields: z.string().optional(),
    exportPtwTypes: z.string().optional(),
  })
  .transform((query) => ({
    ...query,
    fields: query.fields
      ? query.fields.split(',').map((field) => field.trim())
      : PERMIT_FIELD_LIST.filter((field) => field.exportToExcel !== false).map(
          (field) => field.key as PermitFieldKey,
        ),
    exportPtwTypes: query.exportPtwTypes
      ? query.exportPtwTypes.split(',').map((field) => field.trim())
      : undefined,
  }))
  .pipe(
    z.object({
      ...permitFiltersSchema.shape,
      fields: z.array(fieldKeySchema).min(1, 'Select at least one Excel field'),
      exportPtwTypes: z
        .array(z.string().trim().min(1))
        .min(1, 'Select at least one PTW type')
        .optional(),
    }),
  );

export const GET = route(async (req) => {
  const user = await requireAdmin();
  const query = exportQuerySchema.parse(searchParamsToObject(req));
  const dropdownValues = await getPermitDropdownValues();
  const exportPtwTypes = query.exportPtwTypes ?? dropdownValues.newPtwType ?? [];
  if (
    exportPtwTypes.length === 0 ||
    exportPtwTypes.some((ptwType) => !dropdownValues.newPtwType?.includes(ptwType))
  ) {
    throw badRequest('One or more selected PTW types are no longer configured');
  }
  const { fields, ...filters } = query;
  const { buffer, fileName } = await exportPermitFile(filters, user, fields, exportPtwTypes);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
});
