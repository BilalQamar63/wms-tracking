import { loginSchema } from '@wms/shared';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/session';
import { unauthorized } from '@/lib/http/errors';
import { ok, route } from '@/lib/http/response';
import { verifyAdminCredentials } from '@/services/auth.service';
import {
  deleteAllApprovalContacts,
  deleteApprovalContacts,
} from '@/services/approval-contact.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.union([
  z.object({
    ids: z.array(z.string().min(1)).min(1).max(500),
  }),
  z.object({
    deleteAll: z.literal(true),
    credentials: loginSchema,
  }),
]);

export const DELETE = route(async (req) => {
  await requireAdmin();
  const request = requestSchema.parse(await req.json());
  if ('deleteAll' in request) {
    if (!(await verifyAdminCredentials(request.credentials))) {
      throw unauthorized('Invalid administrator email or password');
    }
    return ok({ deleted: await deleteAllApprovalContacts() });
  }
  return ok({ deleted: await deleteApprovalContacts(request.ids) });
});
