'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ClipboardList,
  ClipboardCheck,
  ChevronDown,
  CalendarDays,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogOut,
  SlidersHorizontal,
  Users,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import type { SessionUser } from '@wms/shared';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils/cn';

const PERMIT_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
  { href: '/permits', label: 'PTW Register', icon: ClipboardList, adminOnly: false },
  { href: '/files', label: 'Import / Export History', icon: FileSpreadsheet, adminOnly: true },
] as const;

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [permitsOpen, setPermitsOpen] = useState(
    pathname === '/dashboard' ||
      pathname.startsWith('/dashboard/') ||
      pathname.startsWith('/permits') ||
      pathname.startsWith('/daily-register') ||
      pathname.startsWith('/files') ||
      pathname.startsWith('/authorization-list') ||
      pathname.startsWith('/authorization-history'),
  );
  const [fieldsOpen, setFieldsOpen] = useState(pathname.startsWith('/dropdown-values'));
  const [authorizedPeopleOpen, setAuthorizedPeopleOpen] = useState(
    pathname.startsWith('/authorization-list') || pathname.startsWith('/authorization-history'),
  );

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

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
        <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Master Permits
        </p>
        <div>
          <button
            type="button"
            aria-expanded={permitsOpen}
            aria-controls="manage-permits-links"
            onClick={() => setPermitsOpen((open) => !open)}
            className="flex w-full shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 md:gap-3"
          >
            <ClipboardList className="h-4 w-4" />
            <span className="flex-1">Manage Permits</span>
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', permitsOpen && 'rotate-180')}
              aria-hidden
            />
          </button>
          {permitsOpen && (
            <div id="manage-permits-links" className="mt-1 flex flex-col gap-1 md:pl-3">
              {PERMIT_NAV.filter((item) => !item.adminOnly || user.role === 'admin').map(
                ({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:gap-3',
                      isActive(href)
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                ),
              )}
            </div>
          )}
        </div>

        {user.role === 'admin' && (
          <div>
            <button
              type="button"
              aria-expanded={authorizedPeopleOpen}
              aria-controls="authorized-people-links"
              onClick={() => setAuthorizedPeopleOpen((open) => !open)}
              className="flex w-full shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 md:gap-3"
            >
              <UserRound className="h-4 w-4" />
              <span className="flex-1">Authorized People</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  authorizedPeopleOpen && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
            {authorizedPeopleOpen && (
              <div id="authorized-people-links" className="mt-1 flex flex-col gap-1 md:pl-3">
                {[
                  { href: '/authorization-list', label: 'Authorized List', icon: ClipboardCheck },
                  {
                    href: '/authorization-history',
                    label: 'Import / Export History',
                    icon: History,
                  },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:gap-3',
                      isActive(href)
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {user.role === 'admin' && (
          <div>
            <button
              type="button"
              aria-expanded={fieldsOpen}
              aria-controls="manage-fields-links"
              onClick={() => setFieldsOpen((open) => !open)}
              className="flex w-full shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 md:gap-3"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="flex-1">Manage Fields</span>
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', fieldsOpen && 'rotate-180')}
                aria-hidden
              />
            </button>
            {fieldsOpen && (
              <div id="manage-fields-links" className="mt-1 flex flex-col gap-1 md:pl-3">
                <Link
                  href="/dropdown-values"
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:gap-3',
                    isActive('/dropdown-values')
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Dropdown Values
                </Link>
              </div>
            )}
          </div>
        )}

        {user.role === 'admin' && (
          <Link
            href="/users"
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:gap-3',
              isActive('/users')
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            <Users className="h-4 w-4" />
            Users
          </Link>
        )}
        <div className="my-2 border-t border-slate-200" />
        {(user.role === 'admin' || user.assignedSubContractor) && (
          <>
            <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Daily Permit Tracking
            </p>
            <Link
              href="/daily-register"
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:gap-3',
                isActive('/daily-register')
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <CalendarDays className="h-4 w-4" />
              Daily Register
            </Link>
          </>
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
