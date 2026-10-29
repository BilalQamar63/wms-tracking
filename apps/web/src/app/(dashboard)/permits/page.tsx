import { PermitsView } from '@/components/permits/permits-view';
import { requirePageUser } from '@/lib/auth/session';

export const metadata = { title: 'PTW Register' };

export default async function PermitsPage() {
  const user = await requirePageUser();
  return <PermitsView canManage={user.role === 'admin'} />;
}
