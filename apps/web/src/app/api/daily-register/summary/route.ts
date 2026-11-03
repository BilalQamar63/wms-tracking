import { z } from 'zod';
import { dailyRegisterDateSchema } from '@wms/shared';
import { requireUser } from '@/lib/auth/session';
import { ok, route, searchParamsToObject } from '@/lib/http/response';
import { getDailyRegisterSummary } from '@/services/daily-register.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const user = await requireUser();
  const query = z.object({ date: dailyRegisterDateSchema.optional() }).parse(searchParamsToObject(req));
  return ok(await getDailyRegisterSummary(user, query.date));
});
