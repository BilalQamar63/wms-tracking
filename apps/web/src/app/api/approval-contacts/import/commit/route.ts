import { z } from 'zod';
import { approvalContactSchema } from '@wms/shared';
import { requireAdmin } from '@/lib/auth/session';
import { badRequest } from '@/lib/http/errors';
import { ok, route } from '@/lib/http/response';
import { MAX_IMPORT_ROWS } from '@/lib/excel/constants';
import { commitApprovalContactImport } from '@/services/approval-contact-import.service';

const commitSchema = z.object({
  records: z
    .array(
      z.object({
        rowNumber: z.number().int().positive(),
        data: approvalContactSchema,
        expectedContactId: z.string().regex(/^[a-f\d]{24}$/i).nullable(),
        expectedUpdatedAt: z.string().datetime().nullable(),
      }),
    )
    .max(MAX_IMPORT_ROWS),
  updateExisting: z.boolean(),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = route(async (req) => {
  await requireAdmin();
  const parsed = commitSchema.safeParse(await req.json());
  if (!parsed.success) throw badRequest('Invalid contact import confirmation');
  return ok(
    await commitApprovalContactImport(parsed.data.records, parsed.data.updateExisting),
  );
});
