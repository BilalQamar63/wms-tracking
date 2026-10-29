import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '@wms/shared';

/** Edge-safe (used by middleware) – depends only on `jose`. */
export const SESSION_COOKIE = 'wms_session';

export interface SessionPayload {
  sub: string;
  role: Role;
}

const secretKey = (): Uint8Array => new TextEncoder().encode(process.env.JWT_SECRET ?? '');

export async function signSession(payload: SessionPayload, days: number): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (!payload.sub) return null;
    return { sub: payload.sub, role: payload.role as Role };
  } catch {
    return null;
  }
}
