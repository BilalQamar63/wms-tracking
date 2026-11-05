import { z } from 'zod';
import { dailyRegisterDateSchema, dailyRegisterInputSchema } from '@wms/shared';
import { requireUser } from '@/lib/auth/session';
import { ok, route } from '@/lib/http/response';
import {
  deleteDailyRegisterEntry,
  updateDailyRegisterEntry,
} from '@/services/daily-register.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

const updateSchema = z.object({
  date: dailyRegisterDateSchema,
  data: dailyRegisterInputSchema,
});

export const PUT = route<Params>(async (req, { params }) => {
  const user = await requireUser();
  const { date, data } = updateSchema.parse(await req.json());
  return ok(await updateDailyRegisterEntry(params.id, date, data, user));
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireUser();
  await deleteDailyRegisterEntry(params.id, user);
  return ok({ deleted: true });
});
