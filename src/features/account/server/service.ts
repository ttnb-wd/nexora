import "server-only";
import { getAuth } from "@/features/auth/server/auth";
import { getDb } from "@/lib/db";
import { withAccountLock } from "./security-lock";
import { consumeAccountLimit } from "@/features/auth/server/lifecycle-rate-limit";
import { deviceSummary } from "../session-display";
import type { AccountMutation } from "../schemas";
import type { AccountSettings } from "../types";

export class AccountError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
async function accountSession(headers: Headers) {
  const session = await getAuth().api.getSession({ headers, query: { disableCookieCache: true } });
  if (!session) throw new AccountError(401, "Please sign in again to manage your account.");
  return session;
}
export async function getAccountSettings(headers: Headers): Promise<AccountSettings> {
  const current = await accountSession(headers);
  const user = await getDb().user.findUniqueOrThrow({ where: { id: current.user.id }, select: { name: true, email: true, emailVerified: true, timezone: true } });
  let sessionsAvailable = true;
  const sessions = await getAuth().api.listSessions({ headers }).catch(() => { sessionsAvailable = false; return []; });
  return { ...user, sessionsAvailable, sessions: sessions.map(session => ({ id: session.id, current: session.token === current.session.token, createdAt: session.createdAt.toISOString(), updatedAt: session.updatedAt.toISOString(), expiresAt: session.expiresAt.toISOString(), device: deviceSummary(session.userAgent) })).sort((a, b) => Number(b.current) - Number(a.current) || b.createdAt.localeCompare(a.createdAt)) };
}
export async function mutateAccount(headers: Headers, input: AccountMutation, ip: string): Promise<Response | null> {
  const current = await accountSession(headers);
  if (input.action === "profile") return getAuth().api.updateUser({ headers, body: { name: input.name }, asResponse: true });
  if (input.action === "preferences") {
    await getDb().user.update({ where: { id: current.user.id }, data: { timezone: input.timezone || null } });
    return null;
  }
  if (!await consumeAccountLimit(current.user.id, ip, input.action === "password" ? "password" : "sessions")) throw new AccountError(429, "Too many attempts. Please try again later.");
  // Serialize our credential/session mutations across Render instances, then
  // re-read authorization. Better Auth remains the credential/session owner.
  return withAccountLock(current.user.id, async () => {
    const authorized = await accountSession(headers);
    if (authorized.user.id !== current.user.id) throw new AccountError(401, "Please sign in again.");
    if (input.action === "password") return getAuth().api.changePassword({ headers, body: { currentPassword: input.currentPassword, newPassword: input.newPassword, revokeOtherSessions: true }, asResponse: true });
    if (input.action === "revokeOthers") return getAuth().api.revokeOtherSessions({ headers, asResponse: true });
    const target = await getDb().session.findFirst({ where: { id: input.sessionId, userId: authorized.user.id, expiresAt: { gt: new Date() } }, select: { token: true } });
    if (!target) return null; // Own missing/revoked and foreign IDs share an idempotent response.
    if (target.token === authorized.session.token) throw new AccountError(400, "Use Sign out to end your current session.");
    return getAuth().api.revokeSession({ headers, body: { token: target.token }, asResponse: true });
  });
}
