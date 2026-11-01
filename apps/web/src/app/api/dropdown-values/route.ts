import { z } from 'zod';
import { requireAdmin, requireUser } from '@/lib/auth/session';
import { created, ok, route } from '@/lib/http/response';
import {
  listDropdownValuesForUser,
  PERMIT_DROPDOWN_FIELDS,
  savePermitDropdownValues,
} from '@/services/dropdown-values.service';

const fieldKeySchema = z.string().refine(
  (key) => PERMIT_DROPDOWN_FIELDS.some((field) => field.key === key),
  'Unknown dropdown field',
);
const valuesSchema = z.object({
  values: z.array(z.string().trim().min(1).max(1000)).max(500),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await requireUser();
  return ok(await listDropdownValuesForUser(user));
});

export const POST = route(async (req) => {
  await requireAdmin();
  const body = z.object({ fieldKey: fieldKeySchema }).merge(valuesSchema).parse(await req.json());
  return created({
    fieldKey: body.fieldKey,
    values: await savePermitDropdownValues(body.fieldKey, body.values),
  });
});
