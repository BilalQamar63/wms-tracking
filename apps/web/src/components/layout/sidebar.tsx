'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import type { SessionUser } from '@wms/shared';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils/cn';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
  { href: '/permits', label: 'PTW Register', icon: ClipboardList, adminOnly: false },
  { href: '/files', label: 'Import / Export History', icon: FileSpreadsheet, adminOnly: true },
  { href: '/users', label: 'Users', icon: Users, adminOnly: true },
  { href: '/dropdown-values', label: 'Dropdown Values', icon: SlidersHorizontal, adminOnly: true },
] as const;

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:min-h-0 md:w-64 md:self-start md:border-b-0 md:border-r">
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4 md:h-16 md:px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          W
        </div>
        <span className="font-semibold text-slate-900">WMS Tracking</span>
      </div>

      <nav className="flex gap-1 overflow-x-auto p-2 md:min-h-0 md:flex-1 md:flex-col md:gap-1 md:overflow-y-auto md:overflow-x-hidden md:p-3">
        {NAV.filter((item) => !item.adminOnly || user.role === 'admin').map(
          ({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:gap-3',
                pathname.startsWith(href)
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ),
        )}
      </nav>

      <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 md:block md:p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
          {user.assignedSubContractor && (
            <p className="mt-1 truncate text-xs text-slate-500">{user.assignedSubContractor}</p>
          )}
        </div>
        <button
          onClick={logout}
          className="flex shrink-0 items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 md:mt-3 md:px-0"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
