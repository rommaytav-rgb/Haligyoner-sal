import { z } from 'zod';
import { createAlert, listAlerts } from '@/lib/services/alerts';
import { ok, readJson, unauthorized } from '@/lib/server/api';
import { getContext } from '@/lib/server/context';

export async function GET(): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();
  return ok({ alerts: listAlerts(db, user.id) });
}

const Body = z.object({
  kind: z.enum([
    'price_below',
    'price_increase_percent',
    'price_decrease_percent',
    'promotion_appears',
    'promotion_ends',
    'historical_low',
    'basket_increase_above',
    'basket_decrease_below',
  ]),
  productId: z.string().max(60).nullable().optional(),
  basketId: z.string().max(60).nullable().optional(),
  thresholdValue: z.number().min(0).max(1_000_000),
  label: z.string().min(1).max(120),
});

export async function POST(request: Request): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();
  const { data, error } = await readJson(request, Body);
  if (error) return error;
  return ok({ alert: createAlert(db, user.id, data) }, { status: 201 });
}
