import { COLLECTIONS, getStore } from "@/server/db";
import { newId, now } from "@/domain/ids";
import type { User } from "@/domain/types";
import { hashPassword, verifyPassword } from "./password";
import { readSessionUserId } from "./session";
import { AppError, invalid, unauthenticated } from "@/lib/errors";
import { log } from "@/lib/logger";

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName?: string;
}

function publicUser(user: User): AuthenticatedUser {
  return { id: user.id, email: user.email, displayName: user.displayName };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const [user] = await getStore().query<User>(COLLECTIONS.users, [{ field: "email", op: "==", value: email }], {
    limit: 1,
  });
  return user ?? null;
}

export async function registerUser(email: string, password: string, displayName?: string): Promise<AuthenticatedUser> {
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new AppError("CONFLICT", "errors.emailTaken");
  }
  const user: User = {
    id: newId("usr"),
    email,
    displayName: displayName?.trim() || undefined,
    passwordHash: await hashPassword(password),
    createdAt: now(),
  };
  await getStore().put(COLLECTIONS.users, user);
  log.info({ event: "auth.register", userId: user.id });
  return publicUser(user);
}

export async function authenticate(email: string, password: string): Promise<AuthenticatedUser> {
  const user = await findUserByEmail(email);
  const ok = await verifyPassword(password, user?.passwordHash);
  if (!user || !ok) {
    // The same message for both cases, so the endpoint can't be used to
    // enumerate which addresses have accounts.
    log.warn({ event: "auth.failure", outcome: "invalid_credentials" });
    throw invalid("errors.badCredentials");
  }
  return publicUser(user);
}

/** Resolves the signed-in user, or null. Never trusts a client-provided id. */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const userId = await readSessionUserId();
  if (!userId) return null;
  const user = await getStore().get<User>(COLLECTIONS.users, userId);
  return user ? publicUser(user) : null;
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthenticated();
  return user;
}

export { setSessionCookie, clearSessionCookie, readSessionUserId, SESSION_COOKIE } from "./session";
