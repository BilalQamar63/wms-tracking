import { z } from 'zod';
import { permitInputSchema, permitQuerySchema } from '@wms/shared';
import { requireUser } from '@/lib/auth/session';
import { forbidden } from '@/lib/http/errors';
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
  const user = await requireUser();
  const query = permitQuerySchema.parse(searchParamsToObject(req));
  if (user.role !== 'admin' && query.batchId) {
    throw forbidden('Administrator access required');
  }
  return ok(await listPermits(query, user));
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = createPermitRequestSchema.parse(await req.json());
  if (user.role !== 'admin' && body.importBatchId) {
    throw forbidden('Administrator access required');
  }
  const input = permitInputSchema.parse(body);
  return created(await createPermit(input, user, body.importBatchId));
});
