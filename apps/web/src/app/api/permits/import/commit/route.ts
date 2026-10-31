import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { badRequest } from '@/lib/http/errors';
import { created, route } from '@/lib/http/response';
import { commitPermitFile } from '@/services/file.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const fieldValueSchema = z.union([z.string(), z.array(z.string()), z.null()]);
const approvalsSchema = z.array(
  z.object({
    rowNumber: z.number().int().positive(),
    fields: z.array(
      z.object({
        key: z.string().min(1),
        expectedOldValue: fieldValueSchema,
      }),
    ),
  }),
);
const addRowsSchema = z.array(z.number().int().positive()).max(5000);

export const POST = route(async (req) => {
  const user = await requireUser();
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('Attach an Excel file in the "file" field');

  let rawApprovals: unknown;
  let rawAddRows: unknown;
  try {
    rawApprovals = JSON.parse(String(form.get('approvals') ?? '[]'));
    rawAddRows = JSON.parse(String(form.get('addRows') ?? '[]'));
  } catch {
    throw badRequest('Import review selections are invalid');
  }

  const approvals = approvalsSchema.parse(rawApprovals);
  const addRows = addRowsSchema.parse(rawAddRows);
  return created(await commitPermitFile(file, user, approvals, addRows));
});
