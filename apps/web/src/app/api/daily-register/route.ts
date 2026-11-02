import { z } from 'zod';
import { dailyRegisterDateSchema, dailyRegisterInputSchema } from '@wms/shared';
import { requireUser } from '@/lib/auth/session';
import { created, ok, route, searchParamsToObject } from '@/lib/http/response';
import { addDailyRegisterEntry, listDailyRegister } from '@/services/daily-register.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  date: dailyRegisterDateSchema,
  data: dailyRegisterInputSchema,
});

export const GET = route(async (req) => {
  const user = await requireUser();
  const query = z.object({ date: dailyRegisterDateSchema }).parse(searchParamsToObject(req));
  return ok(await listDailyRegister(query.date, user));
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const { date, data } = createSchema.parse(await req.json());
  return created(await addDailyRegisterEntry(date, data, user));
});
