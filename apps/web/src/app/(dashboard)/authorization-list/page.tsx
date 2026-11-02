import { redirect } from 'next/navigation';
import { AuthorizationListView } from '@/components/approval-contacts/approval-contacts-view';
import { requirePageUser } from '@/lib/auth/session';

export const metadata = { title: 'Authorization List' };

export default async function AuthorizationListPage() {
  const user = await requirePageUser();
  if (user.role !== 'admin') redirect('/permits');
  return <AuthorizationListView />;
}
