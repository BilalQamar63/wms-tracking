import { requireUser } from '@/lib/auth/session';
import { ok, route } from '@/lib/http/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => ok(await requireUser()));
