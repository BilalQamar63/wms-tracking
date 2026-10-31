import { requireUser } from '@/lib/auth/session';
import { badRequest } from '@/lib/http/errors';
import { ok, route } from '@/lib/http/response';
import { previewPermitFile } from '@/services/file.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = route(async (req) => {
  const user = await requireUser();
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('Attach an Excel file in the "file" field');
  return ok(await previewPermitFile(file, user));
});
