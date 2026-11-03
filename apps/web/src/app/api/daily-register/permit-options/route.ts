import { z } from 'zod';
import { dailyRegisterDateSchema } from '@wms/shared';
import { requireUser } from '@/lib/auth/session';
import { ok, route, searchParamsToObject } from '@/lib/http/response';
import { listDailyRegisterPermitOptions } from '@/services/daily-register.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const user = await requireUser();
  const { date, subContractor } = z
    .object({
      date: dailyRegisterDateSchema,
      subContractor: z.string().trim().min(1).max(255),
    })
    .parse(searchParamsToObject(req));
  return ok(await listDailyRegisterPermitOptions(date, subContractor, user));
});
