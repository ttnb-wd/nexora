import "server-only";
import { Prisma, type PrismaClient } from "../../../generated/prisma/client";
import { eventWhere } from "../../attendees/server/service";
import { eventManagerRoles } from "../../events/server/authorization-rules";
import { analyticsRange, rangeStart, statusCounts, eventMetrics, type AnalyticsRange } from "../metrics";

type Tx = Prisma.TransactionClient;
type TrendRow = { date: string; registrations: bigint; cumulative: bigint };
const transactionOptions = { isolationLevel: "RepeatableRead", maxWait: 10000, timeout: 20000 } as const;
const validId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128;
const validScope = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9-]{3,64}$/.test(value);
const eventSelect = { id: true, title: true, slug: true, status: true, startAt: true, endAt: true, timezone: true, capacity: true, organization: { select: { slug: true, name: true } } } satisfies Prisma.EventSelect;

/** Called only after parent-event authorization within the same snapshot. No registration rows are loaded. */
async function readTrend(tx: Tx, eventId: string, timezone: string, range: AnalyticsRange, now: Date) {
  const start = rangeStart(range, now);
  const bucket = range === "all" ? "month" : "day";
  // Group in the event timezone. The opening balance makes a filtered cumulative series honest.
  // All values, including timezone/bucket, are bound parameters; no SQL string interpolation.
  const rows = await tx.$queryRaw<TrendRow[]>(Prisma.sql`
    WITH daily AS (
      SELECT date_trunc(${bucket}, "createdAt" AT TIME ZONE ${timezone}) AS date, COUNT(*) AS registrations
      FROM "EventRegistration" WHERE "eventId" = ${eventId} AND "createdAt" <= ${now}
        AND (${start}::timestamptz IS NULL OR "createdAt" >= ${start}::timestamptz)
      GROUP BY 1
    ), opening AS (
      SELECT COUNT(*) AS count FROM "EventRegistration" WHERE "eventId" = ${eventId}
        AND ${start}::timestamptz IS NOT NULL AND "createdAt" < ${start}::timestamptz
    )
    SELECT to_char(date, 'YYYY-MM-DD') AS date, registrations,
      (SUM(registrations) OVER (ORDER BY date) + (SELECT count FROM opening))::bigint AS cumulative
    FROM daily ORDER BY date`);
  return { bucket, timezone, points: rows.map(row => ({ date: row.date, registrations: Number(row.registrations), cumulative: Number(row.cumulative) })) };
}

/** Actor comes exclusively from the authenticated server boundary. Role is checked on every read. */
export async function loadEventAnalytics(db: PrismaClient, actorId: string, eventId: string, scope: string | null, value: unknown = "all", now = new Date(), includeTrend = true) {
  if (!validId(actorId) || !validId(eventId) || (scope !== null && !validScope(scope))) return null;
  const range = analyticsRange(value);
  return db.$transaction(async tx => {
    const event = await tx.event.findFirst({ where: eventWhere(actorId, eventId, scope), select: eventSelect });
    if (!event) return null;
    const [groups, saves, reminders, tickets, checkIns, trend] = await Promise.all([
      tx.eventRegistration.groupBy({ by: ["status"], where: { eventId: event.id }, _count: { _all: true } }),
      tx.eventBookmark.count({ where: { eventId: event.id } }),
      tx.eventReminderPreference.count({ where: { eventId: event.id, enabled: true, user: { registrations: { some: { eventId: event.id, status: "REGISTERED" } } } } }),
      tx.eventRegistration.count({ where: { eventId: event.id, status: { in: ["REGISTERED", "ATTENDED"] }, ticketIssuedAt: { not: null }, ticketTokenHash: { not: null } } }),
      tx.eventRegistration.count({ where: { eventId: event.id, status: "ATTENDED", checkedInAt: { not: null } } }),
      includeTrend ? readTrend(tx,event.id,event.timezone,range,now) : Promise.resolve(null),
    ]);
    return { event, ...eventMetrics(statusCounts(groups),event.capacity), saves, reminders, tickets, checkIns, trend, range, asOf: now };
  }, transactionOptions);
}

export async function loadOrganizationAnalytics(db: PrismaClient, actorId: string, slug: string, value: unknown = "all", now = new Date()) {
  if (!validId(actorId) || !validScope(slug)) return null;
  const range = analyticsRange(value), start = rangeStart(range,now);
  return db.$transaction(async tx => {
    const membership = await tx.organizationMember.findFirst({ where: { userId: actorId, role: { in: [...eventManagerRoles] }, organization: { slug } }, select: { organization: { select: { id: true, slug: true, name: true } } } });
    if (!membership) return null;
    const organization = membership.organization;
    const where: Prisma.EventWhereInput = { organizationId: organization.id, status: { in: ["PUBLISHED", "COMPLETED"] }, ...(start ? { startAt: { gte: start, lte: now } } : {}) };
    const [published, upcoming, completed, groups, saves, followers, average, recentEvents] = await Promise.all([
      tx.event.count({ where }),
      tx.event.count({ where: { AND: [where, { status: "PUBLISHED", startAt: { gt: now } }] } }),
      tx.event.count({ where: { AND: [where, { OR: [{ status: "COMPLETED" }, { endAt: { lte: now } }] }] } }),
      tx.eventRegistration.groupBy({ by: ["status"], where: { event: where }, _count: { _all: true } }),
      tx.eventBookmark.count({ where: { event: where } }),
      tx.organizationFollower.count({ where: { organizationId: organization.id } }),
      // Average per-event rates only for ended/completed events with an eligible denominator.
      // Aggregate in PostgreSQL to avoid loading every event or registration into memory.
      tx.$queryRaw<{ rate: number | null }[]>(Prisma.sql`
        SELECT AVG(rate)::double precision AS rate FROM (
          SELECT 100.0 * COUNT(*) FILTER (WHERE r.status = 'ATTENDED') /
            NULLIF(COUNT(*) FILTER (WHERE r.status IN ('REGISTERED', 'ATTENDED')), 0) AS rate
          FROM "Event" e JOIN "EventRegistration" r ON r."eventId" = e.id
          WHERE e."organizationId" = ${organization.id} AND e.status IN ('PUBLISHED','COMPLETED')
            AND (e.status = 'COMPLETED' OR e."endAt" <= ${now})
            AND (${start}::timestamptz IS NULL OR (e."startAt" >= ${start}::timestamptz AND e."startAt" <= ${now}))
          GROUP BY e.id
        ) event_rates`),
      tx.event.findMany({ where, select: eventSelect, orderBy: [{ startAt: "desc" }, { id: "asc" }], take: 10 }),
    ]);
    const ids = recentEvents.map(event => event.id);
    const [recentGroups, recentFollowerRegistrants] = ids.length ? await Promise.all([
      tx.eventRegistration.groupBy({ by: ["eventId", "status"], where: { eventId: { in: ids } }, _count: { _all: true } }),
      tx.organizationFollower.count({ where: { organizationId: organization.id, user: { registrations: { some: { eventId: { in: ids }, status: { in: ["REGISTERED", "ATTENDED"] } } } } } }),
    ]) : [[],0];
    return { organization: { name: organization.name, slug: organization.slug }, published, upcoming, completed,
      ...eventMetrics(statusCounts(groups),null), saves, followers, averageAttendanceRate: average[0]?.rate ?? null,
      recent: recentEvents.map(event => ({ event, ...eventMetrics(statusCounts(recentGroups.filter(group => group.eventId === event.id)),event.capacity) })),
      recentFollowerRegistrants, range, asOf: now };
  },transactionOptions);
}
