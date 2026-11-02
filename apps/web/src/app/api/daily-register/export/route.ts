import { NextResponse } from 'next/server';
import { z } from 'zod';
import { dailyRegisterDateSchema } from '@wms/shared';
import { requireUser } from '@/lib/auth/session';
import { route, searchParamsToObject } from '@/lib/http/response';
import { XLSX_MIME } from '@/lib/utils/file-name';
import { exportDailyRegister } from '@/services/daily-register.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const user = await requireUser();
  const { date } = z
    .object({ date: dailyRegisterDateSchema })
    .parse(searchParamsToObject(req));
  const { buffer, fileName } = await exportDailyRegister(date, user);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
});
