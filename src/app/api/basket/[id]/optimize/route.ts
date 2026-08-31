import { z } from 'zod';
import { getBasket } from '@/lib/services/baskets';
import { optimizeBasket, recordSavingsEvent } from '@/lib/services/pricing';
import { notFound, ok, readJson, unauthorized } from '@/lib/server/api';
import { getContext } from '@/lib/server/context';

const Body = z.object({
  mode: z.enum(['cheapest', 'best_value', 'most_convenient', 'closest', 'one_store']).optional(),
  maxStores: z.number().int().min(1).max(4).optional(),
  wantsDelivery: z.boolean().optional(),
  budgetAgorot: z.number().int().min(0).nullable().optional(),
  /** Persisting writes a basket snapshot; previews do not. */
  persist: z.boolean().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();
  const { id } = await context.params;
  const basket = getBasket(db, user.id, id);
  if (!basket) return notFound();

  const { data, error } = await readJson(request, Body);
  if (error) return error;

  const summary = optimizeBasket(db, user.id, basket, data);
  if (data.persist !== false) {
    // A zero saving is not an event worth recording; it would inflate the count
    // in the savings rollup without representing anything the user could act on.
    for (const saving of summary.savings) {
      if (saving.savingAgorot !== 0) recordSavingsEvent(db, user.id, basket.id, saving);
    }
  }

  return ok({
    snapshotId: summary.snapshotId,
    recommended: summary.outcome.recommended,
    byStoreCount: summary.outcome.byStoreCount,
    hasCoverageGap: summary.outcome.hasCoverageGap,
    savings: summary.savings,
    dataFreshness: summary.dataFreshness,
  });
}
