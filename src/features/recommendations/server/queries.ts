import "server-only";
import { cache } from "react";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { getAuthorizedUser } from "@/features/auth/server/session";
import { mapPublicEvent, publicEventSelect } from "@/features/events/server/public-event-mapper";
import type { PublicEvent } from "@/features/events/types";
import { RECOMMENDATION_HORIZON_DAYS, RECOMMENDATION_LIMIT, RECOMMENDATION_CANDIDATE_CAP, selectRecommendationCandidates, type RecommendationCandidate } from "./scoring";

export type RecommendedEvents = { mode: "personalized" | "upcoming"; results: { event: PublicEvent; reason: string }[]; unavailable?: boolean };
/** Private SQL fragments: no history arrays or counts are loaded or returned. */
export function getRecommendationSignals(userId: string) {
  return {
    followedOrganization: Prisma.sql`EXISTS (SELECT 1 FROM "OrganizationFollower" f WHERE f."userId" = ${userId} AND f."organizationId" = e."organizationId")`,
    attendedCategory: Prisma.sql`e.category IS NOT NULL AND EXISTS (SELECT 1 FROM "EventRegistration" r JOIN "Event" h ON h.id = r."eventId" WHERE r."userId" = ${userId} AND r.status = 'ATTENDED' AND h.status IN ('PUBLISHED','COMPLETED') AND h.category = e.category)`,
    joinedCategory: Prisma.sql`e.category IS NOT NULL AND EXISTS (SELECT 1 FROM "EventRegistration" r JOIN "Event" h ON h.id = r."eventId" WHERE r."userId" = ${userId} AND r.status = 'REGISTERED' AND h.status IN ('PUBLISHED','COMPLETED') AND h.category = e.category)`,
    savedCategory: Prisma.sql`e.category IS NOT NULL AND EXISTS (SELECT 1 FROM "EventBookmark" b JOIN "Event" h ON h.id = b."eventId" WHERE b."userId" = ${userId} AND h.status IN ('PUBLISHED','COMPLETED') AND h.category = e.category)`,
    previousOrganization: Prisma.sql`EXISTS (SELECT 1 FROM "EventRegistration" r JOIN "Event" h ON h.id = r."eventId" WHERE r."userId" = ${userId} AND r.status IN ('REGISTERED','ATTENDED') AND h.status IN ('PUBLISHED','COMPLETED') AND h."organizationId" = e."organizationId")`,
  };
}
function candidatePoolQuery(userId: string, now: Date, extended: boolean) {
  const horizon = new Date(now.getTime() + RECOMMENDATION_HORIZON_DAYS * 86400000);
  const signals = getRecommendationSignals(userId);
  // Independent bounded pools prevent general upcoming events crowding out a
  // followed organization or matching category beyond the first chronological page.
  const pools = [
    { match: signals.followedOrganization, cap: 60 }, { match: signals.attendedCategory, cap: 60 },
    { match: signals.joinedCategory, cap: 50 }, { match: signals.savedCategory, cap: 50 },
    { match: signals.previousOrganization, cap: 40 }, { match: Prisma.sql`TRUE`, cap: 40 },
  ];
  const branches = pools.map(({ match, cap }) => Prisma.sql`(SELECT e.id FROM eligible e WHERE ${match} ORDER BY e."startAt", e.slug LIMIT ${cap})`);
  return Prisma.sql`WITH eligible AS NOT MATERIALIZED (
    SELECT e.id, e.slug, e."startAt", e.category, e."organizationId", e."creatorId" FROM "Event" e
    WHERE e.status = 'PUBLISHED' AND e."startAt" > ${now} AND e."endAt" > ${now}
      AND ${extended ? Prisma.sql`e."startAt" > ${horizon}` : Prisma.sql`e."startAt" <= ${horizon}`}
      AND (e."registrationDeadline" IS NULL OR e."registrationDeadline" > ${now})
      AND e."creatorId" <> ${userId}
      AND NOT EXISTS (SELECT 1 FROM "EventRegistration" r WHERE r."userId" = ${userId} AND r."eventId" = e.id)
      AND NOT EXISTS (SELECT 1 FROM "EventBookmark" b WHERE b."userId" = ${userId} AND b."eventId" = e.id)
      AND NOT EXISTS (SELECT 1 FROM "OrganizationMember" m WHERE m."userId" = ${userId} AND m."organizationId" = e."organizationId" AND m.role IN ('OWNER','ADMIN','EDITOR'))
      AND (e.capacity IS NULL OR e.capacity > (SELECT count(*) FROM "EventRegistration" r WHERE r."eventId" = e.id AND r.status IN ('REGISTERED','ATTENDED')))
  ), pool AS (${Prisma.join(branches, " UNION ")})
  SELECT e.slug, e."startAt", e.category, o.name AS "organizationName",
    CASE WHEN e."organizationId" IS NOT NULL THEN 'organization:' || e."organizationId" ELSE 'creator:' || e."creatorId" END AS "groupKey",
    (${signals.followedOrganization}) AS "followedOrganization", (${signals.attendedCategory}) AS "attendedCategory",
    (${signals.joinedCategory}) AS "joinedCategory", (${signals.savedCategory}) AS "savedCategory", (${signals.previousOrganization}) AS "previousOrganization"
  FROM pool JOIN "Event" e ON e.id = pool.id LEFT JOIN "Organization" o ON o.id = e."organizationId"
  ORDER BY e."startAt", e.slug LIMIT ${RECOMMENDATION_CANDIDATE_CAP}`;
}
/** Trusted server primitive. Callers must obtain viewerId from authentication. */
export async function loadRecommendedEventsForViewer(db: PrismaClient, viewerId: string, now = new Date()): Promise<RecommendedEvents> {
  if (!viewerId || viewerId.length > 200 || !Number.isFinite(now.getTime())) throw new Error("Invalid recommendation context");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL statement_timeout = '2500ms'`;
    const candidates = await tx.$queryRaw<RecommendationCandidate[]>(candidatePoolQuery(viewerId, now, false));
    let selected = selectRecommendationCandidates(candidates, now, false);
    if (selected.length < RECOMMENDATION_LIMIT) {
      const extended = await tx.$queryRaw<RecommendationCandidate[]>(candidatePoolQuery(viewerId, now, true));
      selected = selectRecommendationCandidates([...candidates, ...extended], now);
    }
    const records = await tx.event.findMany({ where: { slug: { in: selected.map((candidate) => candidate.slug) }, status: "PUBLISHED", startAt: { gt: now } }, select: publicEventSelect, take: RECOMMENDATION_LIMIT });
    const bySlug = new Map(records.map((record) => [record.slug, mapPublicEvent(record, now)]));
    return {
      mode: selected.some((candidate) => candidate.personalized) ? "personalized" : "upcoming",
      results: selected.flatMap((candidate) => bySlug.has(candidate.slug) ? [{ event: bySlug.get(candidate.slug)!, reason: candidate.reason }] : []),
    };
  }, { isolationLevel: "RepeatableRead", timeout: 15000 });
}
/** No client identity or public endpoint. React caching is request-scoped only. */
export const getRecommendedEventsForUser = cache(async (): Promise<RecommendedEvents | null> => {
  const user = await getAuthorizedUser();
  if (!user) return null;
  try { return await loadRecommendedEventsForViewer(getDb(), user.id); }
  catch (error) {
    console.error("Recommendations unavailable", { name: error instanceof Error ? error.name : "UnknownError" });
    return { mode: "upcoming", results: [], unavailable: true };
  }
});
