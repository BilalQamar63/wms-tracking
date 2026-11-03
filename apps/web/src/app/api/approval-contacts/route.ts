import { z } from 'zod';
import { approvalContactSchema } from '@wms/shared';
import { requireAdmin } from '@/lib/auth/session';
import { created, ok, route, searchParamsToObject } from '@/lib/http/response';
import { createApprovalContact, listApprovalContacts } from '@/services/approval-contact.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(20),
  search: z.string().trim().max(200).default(''),
  position: z.string().trim().max(200).default(''),
  wmsRole: z.string().trim().max(200).default(''),
});

export const GET = route(async (req) => {
  await requireAdmin();
  const query = listQuerySchema.parse(searchParamsToObject(req));
  return ok(await listApprovalContacts(query));
});

export const POST = route(async (req) => {
  await requireAdmin();
  const input = approvalContactSchema.parse(await req.json());
  return created(await createApprovalContact(input));
});
