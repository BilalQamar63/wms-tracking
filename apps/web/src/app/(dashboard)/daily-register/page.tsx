import { DailyRegisterView } from '@/components/daily-register/daily-register-view';
import { getEnv } from '@/lib/env';
import { requirePageUser } from '@/lib/auth/session';
import { forbidden } from '@/lib/http/errors';
import { dailyRegisterDateSchema } from '@wms/shared';

export const metadata = { title: 'Daily PTW Register' };

export default async function DailyRegisterPage({
  searchParams,
}: {
  searchParams?: { date?: string; edit?: string };
}) {
  const user = await requirePageUser();
  if (user.role !== 'admin' && !user.assignedSubContractor) {
    throw forbidden('A subcontractor assignment is required to use the daily register');
  }
  return (
    <DailyRegisterView
      isAdmin={user.role === 'admin'}
      assignedSubContractor={user.assignedSubContractor}
      appTimeZone={getEnv().APP_TIMEZONE}
      initialDate={
        searchParams?.date && dailyRegisterDateSchema.safeParse(searchParams.date).success
          ? searchParams.date
          : undefined
      }
      initialEditId={searchParams?.edit}
    />
  );
}
