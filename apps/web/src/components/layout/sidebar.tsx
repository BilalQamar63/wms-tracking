'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ClipboardList, FileSpreadsheet, LogOut, Users } from 'lucide-react';
import type { SessionUser } from '@wms/shared';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils/cn';

const NAV = [
  { href: '/permits', label: 'PTW Register', icon: ClipboardList, adminOnly: false },
  { href: '/files', label: 'Import / Export History', icon: FileSpreadsheet, adminOnly: false },
  { href: '/users', label: 'Users', icon: Users, adminOnly: true },
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
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">W</div>
        <span className="font-semibold text-slate-900">WMS Tracking</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.filter((item) => !item.adminOnly || user.role === 'admin').map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith(href) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
        <p className="truncate text-xs text-slate-500">{user.email}</p>
        <button onClick={logout} className="mt-3 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
