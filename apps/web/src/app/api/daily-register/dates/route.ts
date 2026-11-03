import { z } from 'zod';
import { dailyRegisterDateSchema } from '@wms/shared';
import { requireUser } from '@/lib/auth/session';
import { ok, route, searchParamsToObject } from '@/lib/http/response';
import { getDailyRegisterDateNavigation } from '@/services/daily-register.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const user = await requireUser();
  const { date } = z
    .object({ date: dailyRegisterDateSchema })
    .parse(searchParamsToObject(req));
  return ok(await getDailyRegisterDateNavigation(date, user));
});
