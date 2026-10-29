import { redirect } from 'next/navigation';
import { UsersView } from '@/components/users/users-view';
import { requirePageUser } from '@/lib/auth/session';

export const metadata = { title: 'Users' };

export default async function UsersPage() {
  const user = await requirePageUser();
  if (user.role !== 'admin') redirect('/permits');
  return <UsersView currentUser={user} />;
}
