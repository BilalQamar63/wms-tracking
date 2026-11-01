import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/session';
import { ok, route } from '@/lib/http/response';
import { savePermitDropdownValues } from '@/services/dropdown-values.service';

const valuesSchema = z.object({
  values: z.array(z.string().trim().min(1).max(1000)).max(500),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = route(async (req, { params }: { params: { fieldKey: string } }) => {
  await requireAdmin();
  const { values } = valuesSchema.parse(await req.json());
  return ok({
    fieldKey: params.fieldKey,
    values: await savePermitDropdownValues(params.fieldKey, values),
  });
});
