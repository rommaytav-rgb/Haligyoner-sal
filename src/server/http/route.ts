import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError, statusFor, userMessageFor } from "@/lib/errors";
import { firstIssue } from "@/lib/validation";
import { log } from "@/lib/logger";
import { requireUser, type AuthenticatedUser } from "@/server/auth";
import { checkRateLimit, sweepRateLimits, type RateLimitRule } from "./rate-limit";

export interface HandlerContext<P = Record<string, string>> {
  user: AuthenticatedUser;
  params: P;
  request: Request;
}

interface RouteOptions {
  rateLimit?: { key: string; rule: RateLimitRule };
}

/**
 * Wraps a route handler with authentication, rate limiting and error shaping.
 * Errors reaching the client are always plain sentences; the stack stays in the
 * logs (section 39).
 */
export function authedRoute<P = Record<string, string>>(
  handler: (context: HandlerContext<P>) => Promise<unknown>,
  options: RouteOptions = {},
) {
  return async (request: Request, routeContext: { params: Promise<P> }) => {
    try {
      const user = await requireUser();

      if (options.rateLimit) {
        sweepRateLimits();
        const { allowed, retryAfterSeconds } = checkRateLimit(
          `${options.rateLimit.key}:${user.id}`,
          options.rateLimit.rule,
        );
        if (!allowed) {
          return NextResponse.json(
            { error: "You've done that a lot in a short time. Give it a minute and try again." },
            { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
          );
        }
      }

      const params = routeContext?.params ? await routeContext.params : ({} as P);
      const data = await handler({ user, params, request });
      return NextResponse.json(data ?? { ok: true });
    } catch (error) {
      return errorResponse(error, request);
    }
  };
}

export function errorResponse(error: unknown, request?: Request): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: firstIssue(error) }, { status: 400 });
  }
  if (!(error instanceof AppError)) {
    log.error({ event: "route.unhandled", path: request ? new URL(request.url).pathname : undefined, error });
  }
  return NextResponse.json({ error: userMessageFor(error) }, { status: statusFor(error) });
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new AppError("INVALID_INPUT", "We couldn't read that request.");
  }
  return schema.parse(raw);
}
