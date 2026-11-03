import { requireUser } from '@/lib/auth/session';
import { ok, route } from '@/lib/http/response';
import { getDailyRegisterDashboardFilterOptions } from '@/services/daily-register.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await requireUser();
  return ok(await getDailyRegisterDashboardFilterOptions(user));
});
