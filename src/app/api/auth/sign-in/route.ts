import { NextResponse } from "next/server";
import { z } from "zod";
import { emailSchema } from "@/lib/validation";
import { authenticate, setSessionCookie } from "@/server/auth";
import { errorResponse } from "@/server/http/route";
import { checkRateLimit, RATE_LIMITS } from "@/server/http/rate-limit";
import { clientKey } from "@/server/http/client-key";
import { audit } from "@/server/services/audit";

const schema = z.object({ email: emailSchema, password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    // Throttled per client rather than per account, so a failing password
    // cannot be used to lock a real user out of their own case file.
    const { allowed } = checkRateLimit(`signin:${clientKey(request)}`, RATE_LIMITS.auth);
    if (!allowed) {
      await audit("AUTH_FAILURE", "rate limited");
      return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
    }

    const body = schema.parse(await request.json());
    const user = await authenticate(body.email, body.password);
    await setSessionCookie(user.id);
    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error, request);
  }
}
