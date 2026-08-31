import { z } from 'zod';
import { importReceiptText, listReceipts } from '@/lib/services/receipts';
import { clientKey, ok, rateLimit, readJson, tooManyRequests, unauthorized } from '@/lib/server/api';
import { getContext } from '@/lib/server/context';

export async function GET(): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();
  return ok({ receipts: listReceipts(db, user.id) });
}

const Body = z.object({
  text: z.string().min(1).max(50_000),
  chainId: z.string().max(60).nullable().optional(),
  originalFilename: z.string().max(200).nullable().optional(),
});

export async function POST(request: Request): Promise<Response> {
  const { db, user } = await getContext();
  if (!user) return unauthorized();
  const limit = rateLimit(clientKey(request, `receipts:${user.id}`), 20, 60_000);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterMs);

  const { data, error } = await readJson(request, Body);
  if (error) return error;
  const receipt = importReceiptText(db, user.id, data);
  // Status reports what extraction actually achieved, including failure.
  return ok({ receipt }, { status: receipt.status === 'failed' ? 200 : 201 });
}
