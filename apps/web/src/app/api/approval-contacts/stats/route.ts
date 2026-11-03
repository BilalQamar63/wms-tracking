import { requireAdmin } from '@/lib/auth/session';
import { ok, route } from '@/lib/http/response';
import { getApprovalContactStats } from '@/services/approval-contact.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireAdmin();
  return ok(await getApprovalContactStats());
});
