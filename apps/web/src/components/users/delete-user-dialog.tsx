'use client';

import { useEffect, useState } from 'react';
import type { UserDTO } from '@wms/shared';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { apiFetch, toQueryString } from '@/lib/api-client';

interface Props {
  user: UserDTO | null;
  allUsers: UserDTO[];
  onClose: () => void;
  onDeleted: () => void;
}

/** Delete a user – optionally replacing them so their records move to another user. */
export function DeleteUserDialog({ user, allUsers, onClose, onDeleted }: Props) {
  const toast = useToast();
  const [replacementId, setReplacementId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setReplacementId(''), [user]);

  if (!user) return null;

  const candidates = allUsers
    .filter((u) => u.id !== user.id && u.isActive)
    .map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }));

  async function confirm() {
    if (!user) return;
    setBusy(true);
    try {
      await apiFetch(`/api/users/${user.id}${toQueryString({ replacementUserId: replacementId })}`, { method: 'DELETE' });
      toast.success(replacementId ? 'User replaced and removed' : 'User deleted');
      onDeleted();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete the user');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Delete ${user.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="danger" onClick={confirm} loading={busy}>
            {replacementId ? 'Replace & delete' : 'Delete user'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-slate-600">
        <p>
          This user will lose access immediately. They own <b>{user.permitCount ?? 0}</b> permit record(s).
        </p>
        <FormField label="Replace with (optional)" htmlFor="replacement">
          <Select id="replacement" placeholder="Keep records under the deleted user" options={candidates} value={replacementId} onChange={(e) => setReplacementId(e.target.value)} />
        </FormField>
        <p className="text-xs text-slate-500">
          {replacementId
            ? 'All permits and import / export history owned by this user will be re-assigned to the selected user.'
            : 'Their records stay in place and show the name as a deleted user.'}
        </p>
      </div>
    </Modal>
  );
}
