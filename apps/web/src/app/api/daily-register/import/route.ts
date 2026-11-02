import { dailyRegisterDateSchema } from '@wms/shared';
import { requireUser } from '@/lib/auth/session';
import { badRequest } from '@/lib/http/errors';
import { ok, route } from '@/lib/http/response';
import { importDailyRegister } from '@/services/daily-register.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = route(async (req) => {
  const user = await requireUser();
  const form = await req.formData();
  const date = dailyRegisterDateSchema.parse(String(form.get('date') ?? ''));
  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('Attach an Excel file in the "file" field');
  return ok(await importDailyRegister(date, file, user));
});
