import { z } from 'zod';
import { createBasket, listBaskets } from '@/lib/services/baskets';
import { ok, readJson, unauthorized } from '@/lib/server/api';
import { getContext } from '@/lib/server/context';

export async function GET(): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();
  return ok({ baskets: listBaskets(db, user.id) });
}

const Body = z.object({ name: z.string().min(1).max(80) });

export async function POST(request: Request): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();
  const { data, error } = await readJson(request, Body);
  if (error) return error;
  return ok({ basket: createBasket(db, user.id, data.name) }, { status: 201 });
}
