import { redirect } from 'next/navigation';
import { AuthorizationDashboardView } from '@/components/approval-contacts/authorization-dashboard-view';
import { requirePageUser } from '@/lib/auth/session';

export const metadata = { title: 'Authorized People Dashboard' };

export default async function AuthorizationDashboardPage() {
  const user = await requirePageUser();
  if (user.role !== 'admin') redirect('/permits');
  return <AuthorizationDashboardView />;
}
