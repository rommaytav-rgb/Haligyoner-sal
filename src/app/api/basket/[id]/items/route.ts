import { z } from 'zod';
import { parseBasketText } from '@/lib/ai/basket-parser';
import { addItems, BasketNotFoundError, getBasket } from '@/lib/services/baskets';
import { clientKey, fail, notFound, ok, rateLimit, readJson, tooManyRequests, unauthorized } from '@/lib/server/api';
import { getContext } from '@/lib/server/context';

const Body = z.object({
  /** Free text the user typed; parsed into lines before it is stored. */
  text: z.string().max(8000).optional(),
  /** Or an explicit list, when the UI already has structure. */
  items: z
    .array(
      z.object({
        rawText: z.string().min(1).max(200),
        quantity: z.number().positive().max(999).optional(),
        preferredBrand: z.string().max(80).nullable().optional(),
        substitutionPolicy: z.enum(['allow', 'same_brand_only', 'never']).optional(),
        isLocked: z.boolean().optional(),
        isOptional: z.boolean().optional(),
      }),
    )
    .max(200)
    .optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();

  // The text path may call the model, so it carries its own limit.
  const limit = rateLimit(clientKey(request, `add-items:${user.id}`), 30, 60_000);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterMs);

  const { id } = await context.params;
  const { data, error } = await readJson(request, Body);
  if (error) return error;
  if (!data.text && !data.items) return fail('nothing_to_add', 422);

  try {
    if (data.items) {
      const result = addItems(db, user.id, id, data.items);
      return ok({ ...result, parsedBy: 'client' }, { status: 201 });
    }
    const parsed = await parseBasketText(data.text as string);
    const result = addItems(db, user.id, id, parsed.items);
    return ok({ ...result, parsedBy: parsed.parsedBy, warnings: parsed.warnings }, { status: 201 });
  } catch (caught) {
    if (caught instanceof BasketNotFoundError) return notFound();
    throw caught;
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();
  const { id } = await context.params;
  const basket = getBasket(db, user.id, id);
  return basket ? ok({ basket }) : notFound();
}
