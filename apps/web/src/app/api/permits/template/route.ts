import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { buildPermitWorkbook } from '@/lib/excel/workbook-builder';
import { route } from '@/lib/http/response';
import { XLSX_MIME } from '@/lib/utils/file-name';
import { listDropdownValuesForUser } from '@/services/dropdown-values.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Blank register (headers + dropdowns) – not recorded in the history. */
export const GET = route(async () => {
  const options = await listDropdownValuesForUser(await requireUser());
  const buffer = await buildPermitWorkbook([], undefined, options);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': 'attachment; filename="PTW-Register-Template.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
});
