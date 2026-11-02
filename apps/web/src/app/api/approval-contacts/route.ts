import { approvalContactSchema } from '@wms/shared';
import { requireAdmin } from '@/lib/auth/session';
import { created, ok, route } from '@/lib/http/response';
import {
  createApprovalContact,
  listApprovalContacts,
} from '@/services/approval-contact.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireAdmin();
  return ok(await listApprovalContacts());
});

export const POST = route(async (req) => {
  await requireAdmin();
  const input = approvalContactSchema.parse(await req.json());
  return created(await createApprovalContact(input));
});
