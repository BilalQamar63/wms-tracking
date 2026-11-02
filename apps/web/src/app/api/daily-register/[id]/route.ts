import { dailyRegisterInputSchema } from '@wms/shared';
import { requireUser } from '@/lib/auth/session';
import { ok, route } from '@/lib/http/response';
import {
  deleteDailyRegisterEntry,
  updateDailyRegisterEntry,
} from '@/services/daily-register.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

export const PUT = route<Params>(async (req, { params }) => {
  const user = await requireUser();
  const input = dailyRegisterInputSchema.parse(await req.json());
  return ok(await updateDailyRegisterEntry(params.id, input, user));
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireUser();
  await deleteDailyRegisterEntry(params.id, user);
  return ok({ deleted: true });
});
