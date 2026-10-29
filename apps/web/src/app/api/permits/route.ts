import { z } from 'zod';
import { permitInputSchema, permitQuerySchema } from '@wms/shared';
import { requireUser } from '@/lib/auth/session';
import { created, ok, route, searchParamsToObject } from '@/lib/http/response';
import { createPermit, listPermits } from '@/services/permit.service';

const createPermitRequestSchema = z
  .object({
    importBatchId: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .optional(),
  })
  .passthrough();

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  await requireUser();
  const query = permitQuerySchema.parse(searchParamsToObject(req));
  return ok(await listPermits(query));
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = createPermitRequestSchema.parse(await req.json());
  const input = permitInputSchema.parse(body);
  return created(await createPermit(input, user.id, body.importBatchId));
});
