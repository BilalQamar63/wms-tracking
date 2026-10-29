import { requireUser } from '@/lib/auth/session';
import { ok, route } from '@/lib/http/response';
import { getPermitDashboardStats } from '@/services/dashboard.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireUser();
  return ok(await getPermitDashboardStats());
});
