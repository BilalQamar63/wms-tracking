'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@wms/shared';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-client';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) as Resolver<LoginInput> });

  async function onSubmit(values: LoginInput) {
    setError(null);
    try {
      await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify(values) });
      const next = params.get('next');
      router.replace(next && next.startsWith('/') ? next : '/permits');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormField label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...register('email')} />
      </FormField>
      <FormField label="Password" htmlFor="password" error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" invalid={!!errors.password} {...register('password')} />
      </FormField>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}
