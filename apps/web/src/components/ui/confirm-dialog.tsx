'use client';

import type { ReactNode } from 'react';
import { Button } from './button';
import { Modal } from './modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, children, confirmLabel = 'Delete', loading, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-slate-600">{children}</div>
    </Modal>
  );
}
