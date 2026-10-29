import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { requirePageUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requirePageUser();

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
