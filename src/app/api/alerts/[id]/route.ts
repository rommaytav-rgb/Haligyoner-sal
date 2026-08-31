import { z } from 'zod';
import { deleteAlert, setAlertEnabled } from '@/lib/services/alerts';
import { notFound, ok, readJson, unauthorized } from '@/lib/server/api';
import { getContext } from '@/lib/server/context';

const Patch = z.object({ enabled: z.boolean() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();
  const { id } = await context.params;
  const { data, error } = await readJson(request, Patch);
  if (error) return error;
  return setAlertEnabled(db, user.id, id, data.enabled) ? ok({ updated: true }) : notFound();
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();
  const { id } = await context.params;
  return deleteAlert(db, user.id, id) ? ok({ deleted: true }) : notFound();
}
