import { NextResponse } from "next/server";
import { z } from "zod";
import { LOCALES, LOCALE_COOKIE } from "@/i18n/config";
import { config } from "@/lib/config";

const schema = z.object({ locale: z.enum(LOCALES) });

/**
 * Records the visitor's language choice. Deliberately a cookie rather than a
 * user setting: it applies before sign-in, survives sign-out, and never touches
 * stored case content (requirement 9).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "unsupported_locale" }, { status: 400 });
  }

  const response = NextResponse.json({ locale: parsed.data.locale });
  response.cookies.set(LOCALE_COOKIE, parsed.data.locale, {
    httpOnly: false,
    sameSite: "lax",
    secure: config.env === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
