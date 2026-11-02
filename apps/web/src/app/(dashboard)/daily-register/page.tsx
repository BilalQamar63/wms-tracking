import { DailyRegisterView } from '@/components/daily-register/daily-register-view';
import { getEnv } from '@/lib/env';
import { requirePageUser } from '@/lib/auth/session';
import { forbidden } from '@/lib/http/errors';

export const metadata = { title: 'Daily PTW Register' };

export default async function DailyRegisterPage() {
  const user = await requirePageUser();
  if (user.role !== 'admin' && !user.assignedSubContractor) {
    throw forbidden('A subcontractor assignment is required to use the daily register');
  }
  return (
    <DailyRegisterView
      isAdmin={user.role === 'admin'}
      assignedSubContractor={user.assignedSubContractor}
      appTimeZone={getEnv().APP_TIMEZONE}
    />
  );
}
