import { PermitsView } from '@/components/permits/permits-view';
import { getEnv } from '@/lib/env';
import { requirePageUser } from '@/lib/auth/session';

export const metadata = { title: 'PTW Register' };

export default async function PermitsPage() {
  const user = await requirePageUser();
  return (
    <PermitsView
      canManage={user.role === 'admin'}
      canImport={user.role === 'admin' || Boolean(user.assignedSubContractor)}
      assignedSubContractor={user.assignedSubContractor}
      appTimeZone={getEnv().APP_TIMEZONE}
    />
  );
}
