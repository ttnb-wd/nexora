import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../../generated/prisma/client";
import { hashInvitationToken } from "./token";
export async function allowTeamRequest(db: PrismaClient, identity: string, kind: "invite" | "respond" | "verify", now = Date.now()) {
  const key = `team:${kind}:${hashInvitationToken(identity)}`;
  const windowMs = kind === "invite" ? 3600000 : 60000;
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("id", "key", "count", "lastRequest")
    VALUES (${randomUUID()}, ${key}, 1, ${BigInt(now)})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."lastRequest" <= ${BigInt(now - windowMs)} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "lastRequest" = CASE WHEN "RateLimit"."lastRequest" <= ${BigInt(now - windowMs)} THEN ${BigInt(now)} ELSE "RateLimit"."lastRequest" END
    RETURNING "count"`;
  return rows[0].count <= (kind === "invite" ? 30 : 60);
}
