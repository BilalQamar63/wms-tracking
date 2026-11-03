import { FilesView } from '@/components/files/files-view';
import { requirePageUser } from '@/lib/auth/session';
import { forbidden } from '@/lib/http/errors';

export const metadata = { title: 'Daily Permit Entry History' };

export default async function DailyRegisterHistoryPage() {
  const user = await requirePageUser();
  if (user.role !== 'admin' && !user.assignedSubContractor) {
    throw forbidden('A subcontractor assignment is required to use the daily register');
  }
  return (
    <FilesView
      currentUser={user}
      endpoint="/api/daily-register/history/activity"
      title="Daily Permit Entry History"
      description="Review daily-register Excel imports and exports, plus permits manually added to a daily register."
    />
  );
}
