import { DailyRegisterDashboardView } from '@/components/daily-register/daily-register-dashboard-view';
import { requirePageUser } from '@/lib/auth/session';
import { forbidden } from '@/lib/http/errors';
import { getEnv } from '@/lib/env';
import { getTodayYmd } from '@wms/shared';

export const metadata = { title: 'Daily Permit Tracking Dashboard' };

export default async function DailyRegisterDashboardPage() {
  const user = await requirePageUser();
  if (user.role !== 'admin' && !user.assignedSubContractor) {
    throw forbidden('A subcontractor assignment is required to use the daily register');
  }

  const appTimeZone = getEnv().APP_TIMEZONE;
  const today = getTodayYmd(new Date(), appTimeZone);
  return <DailyRegisterDashboardView initialDate={today} />;
}
