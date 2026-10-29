import { z } from 'zod';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { route, searchParamsToObject } from '@/lib/http/response';
import { XLSX_MIME } from '@/lib/utils/file-name';
import { exportCompanyPermits } from '@/services/dashboard.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const exportQuerySchema = z.object({
  company: z.string().trim().min(1).max(255),
  status: z.enum(['all', 'active', 'closed']),
});

export const GET = route(async (req) => {
  const user = await requireUser();
  const query = exportQuerySchema.parse(searchParamsToObject(req));
  const result = await exportCompanyPermits(query.company, query.status, user);

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
});
