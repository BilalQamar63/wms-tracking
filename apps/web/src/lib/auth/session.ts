import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { SessionUser } from '@wms/shared';
import { connectDb } from '@/lib/db/mongoose';
import { getEnv } from '@/lib/env';
import { forbidden, unauthorized } from '@/lib/http/errors';
import { UserModel } from '@/models/User';
import { SESSION_COOKIE, signSession, verifySession } from './jwt';

export async function createSession(userId: string, role: SessionUser['role']): Promise<void> {
  const days = getEnv().SESSION_DAYS;
  const token = await signSession({ sub: userId, role }, days);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: days * 24 * 60 * 60,
  });
}

export function destroySession(): void {
  cookies().delete(SESSION_COOKIE);
}

/**
 * Resolves the signed-in user from the cookie *and* the database, so deleted or
 * deactivated users lose access immediately even if their token is still valid.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const payload = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!payload) return null;

  await connectDb();
  const user = await UserModel.findOne({ _id: payload.sub, isDeleted: false, isActive: true })
    .select('name email role assignedSubContractor')
    .lean();
  if (!user) return null;

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    assignedSubContractor: user.assignedSubContractor,
  };
});

/** For route handlers: throws 401 when not signed in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

/** For route handlers: throws 401 / 403 unless the user is an admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'admin') throw forbidden('Administrator access required');
  return user;
}

/** For server components / layouts: redirects to the login page when signed out. */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}
