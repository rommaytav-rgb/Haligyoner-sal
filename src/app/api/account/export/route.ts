import { exportUserData } from '@/lib/services/users';
import { unauthorized } from '@/lib/server/api';
import { getContext } from '@/lib/server/context';

/** Full export of everything the account owns, for the privacy requirement. */
export async function GET(): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();
  const payload = exportUserData(db, user.id);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="my-shopping-data.json"',
    },
  });
}
