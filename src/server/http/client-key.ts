import { createHash } from "node:crypto";

/**
 * A stable, non-identifying key for an unauthenticated caller. The address is
 * hashed so rate-limit state never holds a raw IP (section 59).
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const source = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(source).digest("base64url").slice(0, 22);
}
