import { z } from 'zod';
import { PERMIT_FIELD_LIST } from '@wms/shared';
import { requireUser } from '@/lib/auth/session';
import { connectDb } from '@/lib/db/mongoose';
import { badRequest, notFound } from '@/lib/http/errors';
import { ok, route } from '@/lib/http/response';
import { UserModel } from '@/models/User';

const permitTableFields = new Set(
  PERMIT_FIELD_LIST.filter((field) => field.inTable).map((field) => field.key),
);

const preferencesSchema = z.object({
  permitTableFields: z
    .array(z.string())
    .max(permitTableFields.size)
    .superRefine((fields, ctx) => {
      if (new Set(fields).size !== fields.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Table fields must be unique' });
      }
      for (const field of fields) {
        if (!permitTableFields.has(field)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown table field "${field}"` });
        }
      }
    }),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await requireUser();
  await connectDb();
  const record = await UserModel.findById(user.id)
    .select('permitTableFields')
    .lean<{ permitTableFields?: string[] } | null>();
  if (!record) throw notFound('User');
  return ok({ permitTableFields: record.permitTableFields ?? null });
});

export const PUT = route(async (req) => {
  const user = await requireUser();
  const parsed = preferencesSchema.safeParse(await req.json());
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid table fields');

  await connectDb();
  const record = await UserModel.findByIdAndUpdate(
    user.id,
    { $set: { permitTableFields: parsed.data.permitTableFields } },
    { new: true },
  )
    .select('permitTableFields')
    .lean<{ permitTableFields?: string[] } | null>();
  if (!record) throw notFound('User');
  return ok({ permitTableFields: record.permitTableFields ?? [] });
});
