import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError, statusFor, userMessageFor } from "@/lib/errors";
import { firstIssueKey } from "@/lib/validation";
import { log } from "@/lib/logger";
import { getRequestTranslator } from "@/i18n/server";
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
          const t = await getRequestTranslator();
          return NextResponse.json(
            { error: t("errors.rateLimited") },
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

/** Shapes an error for the client, in the language of the current request. */
export async function errorResponse(error: unknown, request?: Request): Promise<NextResponse> {
  const t = await getRequestTranslator();

  if (error instanceof ZodError) {
    return NextResponse.json({ error: t(firstIssueKey(error)) }, { status: 400 });
  }
  if (!(error instanceof AppError)) {
    log.error({ event: "route.unhandled", path: request ? new URL(request.url).pathname : undefined, error });
  }
  return NextResponse.json({ error: userMessageFor(error, t) }, { status: statusFor(error) });
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new AppError("INVALID_INPUT", "errors.unreadableRequest");
  }
  return schema.parse(raw);
}
