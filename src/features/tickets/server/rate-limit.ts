import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { hashTicketToken } from "../token";

/** Atomic, database-backed fixed window shared by every application instance. */
export async function allowTicketRequest(db: PrismaClient, userId: string, kind: "scan" | "issue", now = Date.now()) {
  const key = `tickets:${kind}:${hashTicketToken(userId)}`;
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("id", "key", "count", "lastRequest")
    VALUES (${randomUUID()}, ${key}, 1, ${BigInt(now)})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."lastRequest" <= ${BigInt(now - 60000)} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "lastRequest" = CASE WHEN "RateLimit"."lastRequest" <= ${BigInt(now - 60000)} THEN ${BigInt(now)} ELSE "RateLimit"."lastRequest" END
    RETURNING "count"`;
  return rows[0].count <= (kind === "scan" ? 60 : 20);
}
