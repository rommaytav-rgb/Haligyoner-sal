import { NextResponse } from "next/server";
import { z } from "zod";
import { emailSchema, passwordSchema } from "@/lib/validation";
import { registerUser, setSessionCookie } from "@/server/auth";
import { errorResponse } from "@/server/http/route";
import { getRequestTranslator } from "@/i18n/server";
import { checkRateLimit, RATE_LIMITS } from "@/server/http/rate-limit";
import { clientKey } from "@/server/http/client-key";

const schema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().max(80).optional(),
});

export async function POST(request: Request) {
  try {
    const { allowed } = checkRateLimit(`signup:${clientKey(request)}`, RATE_LIMITS.auth);
    if (!allowed) {
      const t = await getRequestTranslator();
      return NextResponse.json({ error: t("errors.authThrottled") }, { status: 429 });
    }

    const body = schema.parse(await request.json());
    const user = await registerUser(body.email, body.password, body.displayName);
    await setSessionCookie(user.id);
    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error, request);
  }
}
