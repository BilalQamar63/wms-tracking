import { destroySession } from '@/lib/auth/session';
import { ok, route } from '@/lib/http/response';

export const dynamic = 'force-dynamic';

export const POST = route(async () => {
  destroySession();
  return ok({ loggedOut: true });
});
