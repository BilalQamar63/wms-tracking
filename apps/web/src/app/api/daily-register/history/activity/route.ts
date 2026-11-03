import { fileQuerySchema } from '@wms/shared';
import { requireUser } from '@/lib/auth/session';
import { ok, route, searchParamsToObject } from '@/lib/http/response';
import { listFiles } from '@/services/file.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const user = await requireUser();
  const query = fileQuerySchema.parse(searchParamsToObject(req));
  return ok(await listFiles(query, user, true));
});
