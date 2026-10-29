import { loginSchema } from '@wms/shared';
import { createSession } from '@/lib/auth/session';
import { ok, route } from '@/lib/http/response';
import { authenticate } from '@/services/auth.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const input = loginSchema.parse(await req.json());
  const user = await authenticate(input);
  await createSession(user.id, user.role);
  return ok(user);
});
