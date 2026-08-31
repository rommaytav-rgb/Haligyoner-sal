import { z } from 'zod';
import { BasketNotFoundError, removeItem, updateItem } from '@/lib/services/baskets';
import { notFound, ok, readJson, unauthorized } from '@/lib/server/api';
import { getContext } from '@/lib/server/context';

const Patch = z.object({
  displayName: z.string().min(1).max(200).optional(),
  quantity: z.number().positive().max(999).optional(),
  preferredBrand: z.string().max(80).nullable().optional(),
  substitutionPolicy: z.enum(['allow', 'same_brand_only', 'never']).optional(),
  isLocked: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  isOptional: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();
  const { id, itemId } = await context.params;
  const { data, error } = await readJson(request, Patch);
  if (error) return error;
  try {
    const item = updateItem(db, user.id, id, itemId, data);
    return item ? ok({ item }) : notFound();
  } catch (caught) {
    if (caught instanceof BasketNotFoundError) return notFound();
    throw caught;
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();
  const { id, itemId } = await context.params;
  try {
    return removeItem(db, user.id, id, itemId) ? ok({ removed: true }) : notFound();
  } catch (caught) {
    if (caught instanceof BasketNotFoundError) return notFound();
    throw caught;
  }
}
