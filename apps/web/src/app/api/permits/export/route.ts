import { NextResponse } from 'next/server';
import { permitFiltersSchema } from '@wms/shared';
import { requireUser } from '@/lib/auth/session';
import { route, searchParamsToObject } from '@/lib/http/response';
import { XLSX_MIME } from '@/lib/utils/file-name';
import { exportPermitFile } from '@/services/file.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = route(async (req) => {
  const user = await requireUser();
  const filters = permitFiltersSchema.parse(searchParamsToObject(req));
  const { buffer, fileName } = await exportPermitFile(filters, user);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
});
