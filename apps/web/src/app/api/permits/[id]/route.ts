import { permitInputSchema } from '@wms/shared';
import { requireAdmin, requireUser } from '@/lib/auth/session';
import { ok, route } from '@/lib/http/response';
import { deletePermit, getPermit, updatePermit } from '@/services/permit.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

export const GET = route<Params>(async (_req, { params }) => {
  await requireUser();
  return ok(await getPermit(params.id));
});

/** Full replacement – fields that are omitted / empty are cleared. */
export const PUT = route<Params>(async (req, { params }) => {
  const user = await requireAdmin();
  const input = permitInputSchema.parse(await req.json());
  return ok(await updatePermit(params.id, input, user.id));
});

export const DELETE = route<Params>(async (_req, { params }) => {
  await requireAdmin();
  await deletePermit(params.id);
  return ok({ deleted: true });
});
