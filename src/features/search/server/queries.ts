import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { mapPublicEvent, publicEventSelect } from "@/features/events/server/public-event-mapper";
import { mapPublicOrganization, publicOrganizationSelect } from "@/features/organizations/server/public-organization-mapper";
import { parseSearchParams, searchPattern, SEARCH_PAGE_SIZE, SEARCH_MAX_PAGE, SearchInputError, type SearchParams } from "../params";

export type SearchPage<T> = { results: T[]; total: number; page: number; pageSize: number; pages: number };
export type PublicSpeakerResult = { name: string; role: string | null; company: string | null; eventTitle: string; eventSlug: string; position: number };
export type SearchSuggestion = { label: string; context: string; href: string; type: "Event" | "Organization" | "Speaker" };

// Expressions are identical to the migration's immutable GIN index expressions.
const eventText = Prisma.sql`lower(coalesce(e.title,'') || ' ' || coalesce(e."shortDescription",'') || ' ' || coalesce(e.description,'') || ' ' || coalesce(e.category,'') || ' ' || coalesce(e."locationName",'') || ' ' || coalesce(e.city,'') || ' ' || coalesce(e.region,''))`;
const organizationText = Prisma.sql`lower(coalesce(o.name,'') || ' ' || coalesce(o."shortName",'') || ' ' || coalesce(o.description,'') || ' ' || coalesce(o.industry,'') || ' ' || coalesce(o.city,'') || ' ' || coalesce(o.region,''))`;
const speakerText = Prisma.sql`lower(coalesce(s.name,'') || ' ' || coalesce(s.role,'') || ' ' || coalesce(s.company,'') || ' ' || coalesce(s.bio,''))`;

function checked(input: SearchParams, limit: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > SEARCH_PAGE_SIZE) throw new SearchInputError("Unsupported result size.");
  return parseSearchParams({ ...input, page: String(input.page) });
}
function eventScope(params: SearchParams, now: Date) {
  const clauses = [params.date === "all" ? Prisma.sql`e.status IN ('PUBLISHED','COMPLETED')` : Prisma.sql`e.status = 'PUBLISHED' AND e."startAt" >= ${now}`];
  if (params.category) clauses.push(Prisma.sql`e.category = ${params.category}`);
  if (params.eventType) clauses.push(Prisma.sql`e."eventType"::text = ${params.eventType}`);
  if (params.location) clauses.push(Prisma.sql`lower(coalesce(e.city,'') || ' ' || coalesce(e.region,'') || ' ' || coalesce(e."locationName",'')) LIKE ${searchPattern(params.location)}`);
  return Prisma.join(clauses, " AND ");
}
function nameRank(name: Prisma.Sql, params: SearchParams) {
  const pattern = searchPattern(params.q), prefix = pattern.slice(1), exact = params.q.toLowerCase();
  return Prisma.sql`CASE WHEN lower(${name}) = ${exact} THEN 0 WHEN lower(${name}) LIKE ${prefix} THEN 1 WHEN lower(${name}) LIKE ${pattern} THEN 2 ELSE 3 END`;
}
async function boundedPage<T, R>(params: SearchParams, limit: number, from: Prisma.Sql, where: Prisma.Sql, selection: Prisma.Sql, order: Prisma.Sql, map: (rows: R[], tx: Prisma.TransactionClient) => Promise<T[]>, count: boolean): Promise<SearchPage<T>> {
  return getDb().$transaction(async (tx) => {
    // Bound even index-poor two-character searches and arbitrary filter combinations.
    await tx.$executeRaw`SET LOCAL statement_timeout = '2500ms'`;
    const total = count ? (await tx.$queryRaw<{ total: number }[]>(Prisma.sql`SELECT count(*)::int AS total FROM ${from} WHERE ${where}`))[0].total : 0;
    const records = await tx.$queryRaw<R[]>(Prisma.sql`SELECT ${selection} FROM ${from} WHERE ${where} ORDER BY ${order} LIMIT ${limit} OFFSET ${(params.page - 1) * limit}`);
    return { results: await map(records, tx), total: count ? total : records.length, page: params.page, pageSize: limit, pages: Math.min(SEARCH_MAX_PAGE, Math.ceil(total / limit)) };
  }, { isolationLevel: "RepeatableRead", timeout: 15000 });
}

export async function searchEvents(input: SearchParams, now = new Date(), limit = SEARCH_PAGE_SIZE, count = true) {
  const params = checked(input, limit), pattern = searchPattern(params.q);
  // UNION keeps each text/name branch indexable. A cross-table OR with a hashed
  // subquery can force a full Event scan even when the text GIN index exists.
  const match = params.q.length >= 2 ? Prisma.sql`e.id IN (
    SELECT e.id FROM "Event" e WHERE e.status IN ('PUBLISHED','COMPLETED') AND ${eventText} LIKE ${pattern}
    UNION
    SELECT e.id FROM "Organization" o JOIN "Event" e ON e."organizationId" = o.id
      WHERE e.status IN ('PUBLISHED','COMPLETED') AND lower(o.name) LIKE ${pattern}
  )` : params.q ? Prisma.sql`FALSE` : Prisma.sql`TRUE`;
  const where = Prisma.sql`${eventScope(params, now)} AND ${match}`;
  const rank = Prisma.sql`CASE WHEN lower(e.title) = ${params.q.toLowerCase()} THEN 0 WHEN lower(e.title) LIKE ${pattern.slice(1)} THEN 1 WHEN lower(e.title) LIKE ${pattern} THEN 2 WHEN lower(e.category) LIKE ${pattern} THEN 3 WHEN e."organizationId" IN (SELECT o.id FROM "Organization" o WHERE lower(o.name) LIKE ${pattern}) THEN 4 ELSE 5 END`;
  const dateOrder = Prisma.sql`CASE WHEN e."startAt" >= ${now} THEN 0 ELSE 1 END, e."startAt" ASC, e.slug ASC`;
  const order = params.sort === "newest" ? Prisma.sql`e."createdAt" DESC, e.slug ASC` : params.sort === "soonest" ? Prisma.sql`e."startAt" ASC, e.slug ASC` : Prisma.sql`${rank}, ${dateOrder}`;
  const page = await boundedPage(params, limit, Prisma.sql`"Event" e`, where, Prisma.sql`e.slug`, order, async (rows: { slug: string }[], tx) => {
    const records = await tx.event.findMany({ where: { slug: { in: rows.map((row) => row.slug) }, status: { in: ["PUBLISHED", "COMPLETED"] } }, select: publicEventSelect, take: limit });
    const bySlug = new Map(records.map((record) => [record.slug, mapPublicEvent(record, now)]));
    return rows.flatMap((row) => bySlug.has(row.slug) ? [bySlug.get(row.slug)!] : []);
  }, count);
  return page;
}
export async function searchOrganizations(input: SearchParams, limit = SEARCH_PAGE_SIZE, count = true) {
  const params = checked(input, limit), where = params.q.length >= 2 ? Prisma.sql`${organizationText} LIKE ${searchPattern(params.q)}` : Prisma.sql`FALSE`;
  return boundedPage(params, limit, Prisma.sql`"Organization" o`, where, Prisma.sql`o.slug`, Prisma.sql`${nameRank(Prisma.sql`o.name`, params)}, lower(o.name), o.slug`, async (rows: { slug: string }[], tx) => {
    const records = await tx.organization.findMany({ where: { slug: { in: rows.map((row) => row.slug) } }, select: publicOrganizationSelect, take: limit });
    const bySlug = new Map(records.map((record) => [record.slug, mapPublicOrganization(record)]));
    return rows.flatMap((row) => bySlug.has(row.slug) ? [bySlug.get(row.slug)!] : []);
  }, count);
}
export async function searchSpeakers(input: SearchParams, now = new Date(), limit = SEARCH_PAGE_SIZE, count = true): Promise<SearchPage<PublicSpeakerResult>> {
  const params = checked(input, limit), match = params.q.length >= 2 ? Prisma.sql`${speakerText} LIKE ${searchPattern(params.q)}` : Prisma.sql`FALSE`;
  return boundedPage(params, limit, Prisma.sql`"EventSpeaker" s JOIN "Event" e ON e.id = s."eventId"`, Prisma.sql`${eventScope(params, now)} AND ${match}`, Prisma.sql`s.name, s.role, s.company, e.title AS "eventTitle", e.slug AS "eventSlug", s."sortOrder" AS position`, Prisma.sql`${nameRank(Prisma.sql`s.name`, params)}, lower(s.name), e."startAt", e.slug, s."sortOrder"`, async (rows: PublicSpeakerResult[]) => rows, count);
}
export async function getPopularTopics(now = new Date(), query = "") {
  const params = parseSearchParams({ q: query });
  return getDb().$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL statement_timeout = '2500ms'`;
    const match = params.q ? Prisma.sql`AND lower(category) LIKE ${searchPattern(params.q)}` : Prisma.empty;
    return tx.$queryRaw<{ category: string; count: number }[]>(Prisma.sql`SELECT category, count(*)::int AS count FROM "Event" WHERE status = 'PUBLISHED' AND "startAt" >= ${now} AND category IS NOT NULL AND trim(category) <> '' ${match} GROUP BY category ORDER BY count(*) DESC, category ASC LIMIT 8`);
  });
}
export async function getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
  const params = parseSearchParams({ q: query });
  if (params.q.length < 2) return [];
  const now = new Date();
  const [events, organizations, speakers] = await Promise.all([searchEvents(params, now, 3, false), searchOrganizations(params, 2, false), searchSpeakers(params, now, 2, false)]);
  return [
    ...events.results.map((event) => ({ label: event.title, context: event.category, href: `/events/${encodeURIComponent(event.slug)}`, type: "Event" as const })),
    ...organizations.results.map((organization) => ({ label: organization.name, context: organization.industry, href: `/companies/${encodeURIComponent(organization.slug)}`, type: "Organization" as const })),
    ...speakers.results.map((speaker) => ({ label: speaker.name, context: speaker.eventTitle, href: `/events/${encodeURIComponent(speaker.eventSlug)}#speakers`, type: "Speaker" as const })),
  ];
}
