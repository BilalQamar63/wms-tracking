import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { buildPermitWorkbook } from '@/lib/excel/workbook-builder';
import { route } from '@/lib/http/response';
import { XLSX_MIME } from '@/lib/utils/file-name';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Blank register (headers + dropdowns) – not recorded in the history. */
export const GET = route(async () => {
  await requireUser();
  const buffer = await buildPermitWorkbook([]);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': 'attachment; filename="PTW-Register-Template.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
});
