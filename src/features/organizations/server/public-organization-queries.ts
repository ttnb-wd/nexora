import "server-only";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { mapPublicEvent, publicEventSelect } from "@/features/events/server/public-event-mapper";
import { mapPublicOrganization, publicOrganizationSelect } from "./public-organization-mapper";
import type { PublicOrganization } from "../types";

export async function getPublicOrganizations() {
  const records = await getDb().organization.findMany({ select: publicOrganizationSelect, orderBy: [{ name: "asc" }, { slug: "asc" }] });
  return records.map(mapPublicOrganization);
}
// Share metadata/page reads within one render, without caching across requests.
export const getPublicOrganizationBySlug = cache(async (slug: string) => {
  const record = await getDb().organization.findUnique({ where: { slug }, select: publicOrganizationSelect });
  return record ? mapPublicOrganization(record) : null;
});
export async function getOrganizationUpcomingEvents(slug: string, now = new Date()) {
  const records = await getDb().event.findMany({ where: { organization: { slug }, status: "PUBLISHED", startAt: { gte: now } }, select: publicEventSelect, orderBy: [{ startAt: "asc" }, { slug: "asc" }] });
  return records.map((record) => mapPublicEvent(record, now));
}
export async function getOrganizationPastEvents(slug: string, now = new Date()) {
  const records = await getDb().event.findMany({ where: { organization: { slug }, OR: [{ status: "COMPLETED" }, { status: "PUBLISHED", startAt: { lt: now } }] }, select: publicEventSelect, orderBy: [{ startAt: "desc" }, { slug: "asc" }] });
  return records.map((record) => mapPublicEvent(record, now));
}
/** Upcoming published count, total published count, nearest date, then stable slug. */
export async function getTrendingOrganization(now = new Date()) {
  const records = await getDb().organization.findMany({
    select: { ...publicOrganizationSelect,
      _count: { select: { events: { where: { status: "PUBLISHED" } } } },
      events: { where: { status: "PUBLISHED", startAt: { gte: now } }, select: { startAt: true }, orderBy: { startAt: "asc" } },
    },
  });
  records.sort((a, b) => b.events.length - a.events.length || b._count.events - a._count.events
    || (a.events[0]?.startAt.getTime() ?? Infinity) - (b.events[0]?.startAt.getTime() ?? Infinity)
    || a.slug.localeCompare(b.slug));
  const winner = records[0];
  if (!winner) return null;
  const [nextEvent] = await getDb().event.findMany({ where: { organization: { slug: winner.slug }, status: "PUBLISHED", startAt: { gte: now } }, select: publicEventSelect, orderBy: [{ startAt: "asc" }, { slug: "asc" }], take: 1 });
  return { organization: mapPublicOrganization(winner), upcomingCount: winner.events.length, nextEvent: nextEvent ? mapPublicEvent(nextEvent, now) : null };
}
export async function getRelatedOrganizations(organization: PublicOrganization) {
  if (!organization.industry) return [];
  const records = await getDb().organization.findMany({ where: { slug: { not: organization.slug }, industry: organization.industry }, select: publicOrganizationSelect, orderBy: [{ name: "asc" }, { slug: "asc" }], take: 3 });
  return records.map(mapPublicOrganization);
}
