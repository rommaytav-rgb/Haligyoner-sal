import { cookies } from 'next/headers';
import { z } from 'zod';
import { LOCALE_COOKIE } from '@/lib/i18n';
import { ok, readJson } from '@/lib/server/api';

const Body = z.object({ locale: z.enum(['he', 'en']) });

export async function POST(request: Request): Promise<Response> {
  const { data, error } = await readJson(request, Body);
  if (error) return error;
  (await cookies()).set(LOCALE_COOKIE, data.locale, {
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return ok({ locale: data.locale });
}
