import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { route } from '@/lib/http/response';
import { XLSX_MIME } from '@/lib/utils/file-name';
import { timestampForFileName } from '@/lib/utils/file-name';
import { exportApprovalContacts } from '@/services/approval-contact-import.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = route(async () => {
  const user = await requireAdmin();
  const fileName = `Approval-Contacts-${timestampForFileName()}.xlsx`;
  const buffer = await exportApprovalContacts(user.id, fileName);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
});
