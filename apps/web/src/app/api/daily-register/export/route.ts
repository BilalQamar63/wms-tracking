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
  const { dateFrom, dateTo, shifts, subContractors } = z
    .object({
      dateFrom: dailyRegisterDateSchema,
      dateTo: dailyRegisterDateSchema,
      shifts: z.array(z.enum(['day', 'night'])).min(1),
      subContractors: z.array(z.string().trim().min(1).max(255)).optional(),
    })
    .refine((value) => value.dateFrom <= value.dateTo, {
      path: ['dateTo'],
      message: 'End date cannot be before start date',
    })
    .parse({
      ...searchParamsToObject(req),
      shifts: req.nextUrl.searchParams.getAll('shift'),
      subContractors: req.nextUrl.searchParams.getAll('subContractor'),
    });
  const { buffer, fileName } = await exportDailyRegister(
    { dateFrom, dateTo, shifts, ...(subContractors?.length ? { subContractors } : {}) },
    user,
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
});
