import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/session';
import { ok, route } from '@/lib/http/response';
import { deleteApprovalContacts } from '@/services/approval-contact.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

export const DELETE = route(async (req) => {
  await requireAdmin();
  const { ids } = requestSchema.parse(await req.json());
  return ok({ deleted: await deleteApprovalContacts(ids) });
});
