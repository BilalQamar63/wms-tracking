import { requireUser } from '@/lib/auth/session';
import { ok, route } from '@/lib/http/response';
import { permitFiltersSchema } from '@wms/shared';
import { getPermitDashboardStats } from '@/services/dashboard.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const user = await requireUser();
  const filters = permitFiltersSchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  return ok(await getPermitDashboardStats(filters, user));
});
