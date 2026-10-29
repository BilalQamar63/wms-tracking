import { requireAdmin, requireUser } from '@/lib/auth/session';
import { ok, route } from '@/lib/http/response';
import { deleteFile, getFileDetails } from '@/services/file.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

/** Full record including the stored per-row import errors. */
export const GET = route<Params>(async (_req, { params }) => {
  await requireUser();
  return ok(await getFileDetails(params.id));
});

export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireAdmin();
  await deleteFile(params.id, user);
  return ok({ deleted: true });
});
