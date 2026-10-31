import { FilesView } from '@/components/files/files-view';
import { requirePageUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Import / Export History' };

export default async function FilesPage() {
  const user = await requirePageUser();
  if (user.role !== 'admin') redirect('/permits');
  return <FilesView currentUser={user} />;
}
