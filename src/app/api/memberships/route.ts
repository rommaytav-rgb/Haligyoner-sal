import { z } from 'zod';
import { listMemberships, setMembership } from '@/lib/services/users';
import { ok, readJson, unauthorized } from '@/lib/server/api';
import { getContext } from '@/lib/server/context';

export async function GET(): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();
  return ok({ memberships: listMemberships(db, user.id) });
}

const Body = z.object({ chainId: z.string().min(1).max(60), active: z.boolean() });

export async function POST(request: Request): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();
  const { data, error } = await readJson(request, Body);
  if (error) return error;
  setMembership(db, user.id, data.chainId, data.active);
  return ok({ memberships: listMemberships(db, user.id) });
}
