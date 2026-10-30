import { loginSchema } from '@wms/shared';
import { requireAdmin } from '@/lib/auth/session';
import { unauthorized } from '@/lib/http/errors';
import { ok, route } from '@/lib/http/response';
import { verifyAdminCredentials } from '@/services/auth.service';
import { deleteCurrentRegister } from '@/services/permit.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = route(async (req) => {
  await requireAdmin();
  const credentials = loginSchema.parse(await req.json());
  if (!(await verifyAdminCredentials(credentials))) {
    throw unauthorized('Invalid administrator email or password');
  }
  return ok({ deletedCount: await deleteCurrentRegister() });
});
