import { z } from 'zod';
import { dailyRegisterDateSchema } from '@wms/shared';
import { requireUser } from '@/lib/auth/session';
import { ok, route, searchParamsToObject } from '@/lib/http/response';
import { listDailyRegisterSubContractors } from '@/services/daily-register.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const user = await requireUser();
  const { dateFrom, dateTo } = z
    .object({
      dateFrom: dailyRegisterDateSchema,
      dateTo: dailyRegisterDateSchema,
    })
    .refine((value) => value.dateFrom <= value.dateTo, {
      path: ['dateTo'],
      message: 'End date cannot be before start date',
    })
    .parse(searchParamsToObject(req));
  return ok(await listDailyRegisterSubContractors(dateFrom, dateTo, user));
});
