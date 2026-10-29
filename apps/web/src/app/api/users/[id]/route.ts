import { deleteUserQuerySchema, updateUserSchema } from '@wms/shared';
import { requireAdmin } from '@/lib/auth/session';
import { ok, route, searchParamsToObject } from '@/lib/http/response';
import { deleteUser, updateUser } from '@/services/user.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

export const PUT = route<Params>(async (req, { params }) => {
  const actor = await requireAdmin();
  const input = updateUserSchema.parse(await req.json());
  return ok(await updateUser(params.id, input, actor));
});

/** `DELETE /api/users/:id?replacementUserId=…` – delete, optionally handing records to another user. */
export const DELETE = route<Params>(async (req, { params }) => {
  const actor = await requireAdmin();
  const { replacementUserId } = deleteUserQuerySchema.parse(searchParamsToObject(req));
  return ok(await deleteUser(params.id, replacementUserId, actor));
});
