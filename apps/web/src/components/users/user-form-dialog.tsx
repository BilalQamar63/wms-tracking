'use client';

import { useEffect } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  SUB_CONTRACTORS,
  USER_ROLES,
  createUserSchema,
  updateUserSchema,
  type UserDTO,
} from '@wms/shared';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/api-client';

interface FormValues {
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'user';
  assignedSubContractor?: string;
  isActive: boolean;
}

interface Props {
  open: boolean;
  user: UserDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

const schemaFor = (isEdit: boolean) => (isEdit ? updateUserSchema : createUserSchema);

export function UserFormDialog({ open, user, onClose, onSaved }: Props) {
  const toast = useToast();
  const isEdit = !!user;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schemaFor(isEdit)) as unknown as Resolver<FormValues>,
    defaultValues: { name: '', email: '', password: '', role: 'user', isActive: true },
  });
  const role = useWatch({ control, name: 'role' });

  useEffect(() => {
    if (open) {
      reset(
        user
          ? {
              name: user.name,
              email: user.email,
              password: '',
              role: user.role,
              assignedSubContractor: user.assignedSubContractor ?? '',
              isActive: user.isActive,
            }
          : {
              name: '',
              email: '',
              password: '',
              role: 'user',
              assignedSubContractor: '',
              isActive: true,
            },
      );
    }
  }, [open, user, reset]);

  async function onSubmit(values: FormValues) {
    try {
      await apiFetch(isEdit ? `/api/users/${user.id}` : '/api/users', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(values),
      });
      toast.success(isEdit ? 'User updated' : 'User created');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the user');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit user' : 'Add user'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" form="user-form" loading={isSubmitting}>{isEdit ? 'Save changes' : 'Create user'}</Button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Full name" htmlFor="user-name" error={errors.name?.message} required>
          <Input id="user-name" invalid={!!errors.name} {...register('name')} />
        </FormField>
        <FormField label="Email" htmlFor="user-email" error={errors.email?.message} required>
          <Input id="user-email" type="email" invalid={!!errors.email} {...register('email')} />
        </FormField>
        <FormField label={isEdit ? 'New password (leave blank to keep)' : 'Password'} htmlFor="user-password" error={errors.password?.message} required={!isEdit}>
          <Input id="user-password" type="password" autoComplete="new-password" invalid={!!errors.password} {...register('password')} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Role" htmlFor="user-role" error={errors.role?.message}>
            <Select id="user-role" placeholder="Role" options={USER_ROLES} {...register('role')} />
          </FormField>
          <label className="mt-6 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('isActive')} /> Active
          </label>
        </div>
        {role === 'user' && (
          <FormField
            label="Assigned sub contractor"
            htmlFor="user-sub-contractor"
            error={errors.assignedSubContractor?.message}
            required
          >
            <Select
              id="user-sub-contractor"
              placeholder="Select a sub contractor"
              options={SUB_CONTRACTORS}
              invalid={!!errors.assignedSubContractor}
              {...register('assignedSubContractor')}
            />
          </FormField>
        )}
      </form>
    </Modal>
  );
}
