import { redirect } from 'next/navigation';
import { DropdownValuesView } from '@/components/approval-contacts/approval-contacts-view';
import { requirePageUser } from '@/lib/auth/session';

export const metadata = { title: 'Dropdown Values' };

export default async function DropdownValuesPage() {
  const user = await requirePageUser();
  if (user.role !== 'admin') redirect('/permits');
  return <DropdownValuesView />;
}
