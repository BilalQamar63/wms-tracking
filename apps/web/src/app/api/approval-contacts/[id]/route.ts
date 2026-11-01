import { approvalContactSchema } from '@wms/shared';
import { requireAdmin } from '@/lib/auth/session';
import { ok, route } from '@/lib/http/response';
import {
  deleteApprovalContact,
  updateApprovalContact,
} from '@/services/approval-contact.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = route(async (req, { params }: { params: { id: string } }) => {
  await requireAdmin();
  const input = approvalContactSchema.parse(await req.json());
  return ok(await updateApprovalContact(params.id, input));
});

export const DELETE = route(async (_req, { params }: { params: { id: string } }) => {
  await requireAdmin();
  await deleteApprovalContact(params.id);
  return ok({ deleted: true });
});
