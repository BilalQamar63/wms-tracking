import { FilesView } from '@/components/files/files-view';
import { requirePageUser } from '@/lib/auth/session';

export const metadata = { title: 'Import / Export History' };

export default async function FilesPage() {
  const user = await requirePageUser();
  return <FilesView currentUser={user} />;
}
