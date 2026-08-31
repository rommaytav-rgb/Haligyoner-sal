import { z } from 'zod';
import { getPreferences, updatePreferences } from '@/lib/services/users';
import { ok, readJson, unauthorized } from '@/lib/server/api';
import { getContext } from '@/lib/server/context';

export async function GET(): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();
  return ok({ preferences: getPreferences(db, user.id) });
}

const Body = z.object({
  optimizationMode: z.enum(['cheapest', 'best_value', 'most_convenient', 'closest', 'one_store']).optional(),
  maxStores: z.number().int().min(1).max(4).optional(),
  maxDistanceKm: z.number().min(0).max(500).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  homeLatitude: z.number().min(-90).max(90).nullable().optional(),
  homeLongitude: z.number().min(-180).max(180).nullable().optional(),
  householdSize: z.number().int().min(1).max(20).nullable().optional(),
  weeklyBudgetAgorot: z.number().int().min(0).nullable().optional(),
  wantsDelivery: z.boolean().optional(),
  allowSubstitutions: z.boolean().optional(),
  minSubstitutionScore: z.number().min(0).max(1).optional(),
  excludedChainIds: z.array(z.string().max(60)).max(60).optional(),
  preferredChainIds: z.array(z.string().max(60)).max(60).optional(),
  dislikedBrands: z.array(z.string().max(80)).max(100).optional(),
  favoriteBrands: z.array(z.string().max(80)).max(100).optional(),
});

export async function PATCH(request: Request): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();
  const { data, error } = await readJson(request, Body);
  if (error) return error;
  // Only the keys sent are changed; everything else the user set is left alone.
  return ok({ preferences: updatePreferences(db, user.id, data) });
}
