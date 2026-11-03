import { DashboardView } from '@/components/dashboard/dashboard-view';
import { requirePageUser } from '@/lib/auth/session';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const user = await requirePageUser();
  return <DashboardView canExport={user.role === 'admin'} />;
}
