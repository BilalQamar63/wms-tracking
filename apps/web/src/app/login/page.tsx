import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">W</div>
          <h1 className="text-lg font-semibold text-slate-900">WMS Tracking</h1>
          <p className="text-sm text-slate-500">Master PTW Tracking Register</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
