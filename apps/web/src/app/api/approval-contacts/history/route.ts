import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/session';
import { ok, route, searchParamsToObject } from '@/lib/http/response';
import { listApprovalContactHistory } from '@/services/approval-contact-history.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = route(async (req) => {
  await requireAdmin();
  const query = querySchema.parse(searchParamsToObject(req));
  return ok(await listApprovalContactHistory(query.page, query.limit));
});
