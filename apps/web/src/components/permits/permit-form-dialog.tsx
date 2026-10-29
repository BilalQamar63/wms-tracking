'use client';

import { useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  DEFAULT_PTWC_APPROVER,
  PERMIT_FIELD_LIST,
  permitInputSchema,
  toDateInputValue,
  type PermitDTO,
  type PermitInput,
} from '@wms/shared';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/api-client';
import { PermitFormFields } from './permit-form-fields';

interface Props {
  open: boolean;
  permit: PermitDTO | null;
  importBatchId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function toFormValues(permit: PermitDTO | null): PermitInput {
  const values: Record<string, string | string[] | undefined> = {};
  for (const field of PERMIT_FIELD_LIST) {
    let raw = permit?.[field.key as keyof PermitDTO] as string | string[] | undefined;
    if (field.type === 'multiselect' && typeof raw === 'string') {
      raw = raw
        .split(/[;|,\r\n]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
    values[field.key] =
      field.type === 'date'
        ? toDateInputValue(raw as string | undefined)
        : field.type === 'multiselect'
          ? Array.isArray(raw)
            ? raw
            : []
          : typeof raw === 'string'
            ? raw
            : '';
  }
  if (!permit) {
    values.status = 'Not Start Yet';
    values.approvedByPtwc = DEFAULT_PTWC_APPROVER;
  }
  return values as PermitInput;
}

export function PermitFormDialog({ open, permit, importBatchId, onClose, onSaved }: Props) {
  const toast = useToast();
  const isEdit = !!permit;

  const {
    register,
    setValue,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PermitInput>({
    resolver: zodResolver(permitInputSchema) as unknown as Resolver<PermitInput>,
    defaultValues: toFormValues(permit),
  });

  useEffect(() => {
    if (open) reset(toFormValues(permit));
  }, [open, permit, reset]);

  async function onSubmit(values: PermitInput) {
    try {
      await apiFetch(isEdit ? `/api/permits/${permit.id}` : '/api/permits', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...values,
          ...(!isEdit && importBatchId ? { importBatchId } : {}),
        }),
      });
      toast.success(isEdit ? 'Permit updated' : 'Permit added');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the permit');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Edit permit · Sr No ${permit.srNo}` : 'Add permit'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="permit-form" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Add permit'}
          </Button>
        </>
      }
    >
      <form id="permit-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="mb-5 rounded-lg border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-900">
          Plan validity is 14 calendar days. Choosing a start date fills the read-only end date
          automatically.
        </div>
        <PermitFormFields register={register} setValue={setValue} errors={errors} />
      </form>
    </Modal>
  );
}
