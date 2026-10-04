import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { getAuthEnvironment } from "@/lib/env";

export function lifecycleKey(identity: string, kind: string) {
  return `auth-lifecycle:${kind}:${createHmac("sha256", getAuthEnvironment().AUTH_SECRET).update(identity).digest("hex")}`;
}
async function consume(identity: string, kind: string, windowMs: number, max: number) {
  const key = lifecycleKey(identity, kind), now = Date.now();
  const rows = await getDb().$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("id", "key", "count", "lastRequest") VALUES (${randomUUID()}, ${key}, 1, ${BigInt(now)})
    ON CONFLICT ("key") DO UPDATE SET
    "count" = CASE WHEN "RateLimit"."lastRequest" <= ${BigInt(now - windowMs)} THEN 1 ELSE "RateLimit"."count" + 1 END,
    "lastRequest" = CASE WHEN "RateLimit"."lastRequest" <= ${BigInt(now - windowMs)} THEN ${BigInt(now)} ELSE "RateLimit"."lastRequest" END
    RETURNING "count"`;
  return rows[0].count <= max;
}
export async function allowLifecycleRequest(email: string, ip: string, kind: "verification" | "forgot" | "signup") {
  // Evaluate every bucket, including for nonexistent accounts, atomically per bucket.
  const allowed = await Promise.all([
    consume(email, `${kind}-cooldown`, 60000, 1), consume(email, `${kind}-hour`, 3600000, 5),
    consume(ip, "email-ip", 3600000, 20),
  ]);
  return allowed.every(Boolean);
}
/** Better Auth's reset callback includes the token in its PATH. Use an IP-only
 * bucket instead of allowing the built-in limiter to persist that bearer path. */
export async function allowResetCallback(ip: string) {
  return consume(ip, "reset-callback", 60000, 30);
}
