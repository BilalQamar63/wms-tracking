import { fileQuerySchema } from '@wms/shared';
import { requireUser } from '@/lib/auth/session';
import { ok, route, searchParamsToObject } from '@/lib/http/response';
import { listFiles } from '@/services/file.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  await requireUser();
  return ok(await listFiles(fileQuerySchema.parse(searchParamsToObject(req))));
});
