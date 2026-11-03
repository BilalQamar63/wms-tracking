import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { ok, route, searchParamsToObject } from '@/lib/http/response';
import { listDailyRegisterDashboard } from '@/services/daily-register.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const filtersSchema = z.object({
  ptwNumber: z.string().max(100).optional(),
  ptwType: z.string().max(255).optional(),
  subContractor: z.string().max(255).optional(),
  shiftDayNight: z.string().max(50).optional(),
  ptwStatus: z.string().max(100).optional(),
});

export const GET = route(async (req) => {
  const user = await requireUser();
  const filters = filtersSchema.parse(searchParamsToObject(req));
  return ok(await listDailyRegisterDashboard(user, filters));
});
