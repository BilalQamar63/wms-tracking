import { createUserSchema } from '@wms/shared';
import { requireAdmin, requireUser } from '@/lib/auth/session';
import { created, ok, route } from '@/lib/http/response';
import { createUser, listUsers } from '@/services/user.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Any signed-in user may list users (needed to pick a replacement); only admins can create. */
export const GET = route(async () => {
  await requireUser();
  return ok(await listUsers());
});

export const POST = route(async (req) => {
  await requireAdmin();
  return created(await createUser(createUserSchema.parse(await req.json())));
});
