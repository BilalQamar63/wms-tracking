import { createUserSchema } from '@wms/shared';
import { requireAdmin } from '@/lib/auth/session';
import { created, ok, route } from '@/lib/http/response';
import { createUser, listUsers } from '@/services/user.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireAdmin();
  return ok(await listUsers());
});

export const POST = route(async (req) => {
  await requireAdmin();
  return created(await createUser(createUserSchema.parse(await req.json())));
});
