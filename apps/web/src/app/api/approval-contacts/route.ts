import { z } from 'zod';
import { approvalContactSchema } from '@wms/shared';
import { requireAdmin, requireUser } from '@/lib/auth/session';
import { created, ok, route } from '@/lib/http/response';
import {
  createApprovalContact,
  listApprovalContacts,
} from '@/services/approval-contact.service';

const querySchema = z.object({
  subContractor: z.string().trim().min(1).optional(),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const user = await requireUser();
  const query = querySchema.parse({
    subContractor: req.nextUrl.searchParams.get('subContractor') ?? undefined,
  });
  return ok(await listApprovalContacts(user, query.subContractor));
});

export const POST = route(async (req) => {
  await requireAdmin();
  const input = approvalContactSchema.parse(await req.json());
  return created(await createApprovalContact(input));
});
