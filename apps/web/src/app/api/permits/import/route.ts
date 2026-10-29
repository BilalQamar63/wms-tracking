import { requireAdmin } from '@/lib/auth/session';
import { badRequest } from '@/lib/http/errors';
import { created, route } from '@/lib/http/response';
import { importPermitFile } from '@/services/file.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = route(async (req) => {
  const user = await requireAdmin();
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('Attach an Excel file in the "file" field');
  return created(await importPermitFile(file, user));
});
