import { redirect } from 'next/navigation';
import { ApprovalContactHistoryView } from '@/components/approval-contacts/approval-contact-history-view';
import { requirePageUser } from '@/lib/auth/session';

export const metadata = { title: 'Authorized People Import / Export History' };

export default async function AuthorizationHistoryPage() {
  const user = await requirePageUser();
  if (user.role !== 'admin') redirect('/permits');
  return <ApprovalContactHistoryView />;
}
