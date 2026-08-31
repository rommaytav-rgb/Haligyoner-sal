import { cookies } from 'next/headers';
import { z } from 'zod';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { run } from '@/lib/db/client';
import { deleteUser } from '@/lib/services/users';
import { fail, ok, readJson, unauthorized } from '@/lib/server/api';
import { getContext } from '@/lib/server/context';

const Body = z.object({
  /** 'account' deletes everything; 'history' keeps the account and its baskets. */
  scope: z.enum(['account', 'history', 'receipts']),
});

export async function DELETE(request: Request): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();
  const { data, error } = await readJson(request, Body);
  if (error) return error;

  if (data.scope === 'account') {
    deleteUser(db, user.id);
    (await cookies()).delete(SESSION_COOKIE);
    return ok({ deleted: 'account' });
  }
  if (data.scope === 'receipts') {
    run(db, 'DELETE FROM receipts WHERE user_id = ?', [user.id]);
    return ok({ deleted: 'receipts' });
  }
  if (data.scope === 'history') {
    run(
      db,
      'DELETE FROM basket_snapshots WHERE basket_id IN (SELECT id FROM baskets WHERE user_id = ?)',
      [user.id],
    );
    run(db, 'DELETE FROM optimization_results WHERE user_id = ?', [user.id]);
    run(db, 'DELETE FROM savings_events WHERE user_id = ?', [user.id]);
    return ok({ deleted: 'history' });
  }
  return fail('unsupported_scope', 422);
}
