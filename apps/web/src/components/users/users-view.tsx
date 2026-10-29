'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { SessionUser, UserDTO } from '@wms/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { useUsers } from '@/hooks/use-users';
import { DeleteUserDialog } from './delete-user-dialog';
import { UserFormDialog } from './user-form-dialog';

export function UsersView({ currentUser }: { currentUser: SessionUser }) {
  const { data, error, isLoading, mutate: refresh } = useUsers();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserDTO | null>(null);
  const [deleting, setDeleting] = useState<UserDTO | null>(null);

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage who can access the register. Deleting a user can hand their records to a replacement."
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Add user
          </Button>
        }
      />

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {error ? (
          <EmptyState title="Could not load users">{error.message}</EmptyState>
        ) : isLoading ? (
          <EmptyState title="Loading…" />
        ) : data && data.length > 0 ? (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Permits</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {user.name} {user.id === currentUser.id && <span className="text-xs text-slate-400">(you)</span>}
                    </p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </td>
                  <td className="px-4 py-3"><Badge tone={user.role === 'admin' ? 'purple' : 'slate'}>{user.role}</Badge></td>
                  <td className="px-4 py-3"><Badge tone={user.isActive ? 'green' : 'red'}>{user.isActive ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-4 py-3 tabular-nums">{user.permitCount ?? 0}</td>
                  <td className="px-4 py-3 text-slate-500">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(user); setFormOpen(true); }} aria-label={`Edit ${user.name}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {user.id !== currentUser.id && (
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(user)} aria-label={`Delete ${user.name}`}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="No users" />
        )}
      </section>

      <UserFormDialog open={formOpen} user={editing} onClose={() => setFormOpen(false)} onSaved={() => refresh()} />
      <DeleteUserDialog user={deleting} allUsers={data ?? []} onClose={() => setDeleting(null)} onDeleted={() => refresh()} />
    </>
  );
}
