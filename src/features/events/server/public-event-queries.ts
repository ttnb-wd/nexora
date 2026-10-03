import "server-only";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { mapPublicEvent, publicEventSelect, publicEventDetailSelect } from "./public-event-mapper";
import { getCalendarLinks } from "../calendar/server";

const discoveryLimit = 100;

/** Public discovery deliberately excludes past and all unpublished statuses. */
export async function getPublishedEvents(now = new Date()) {
  const records = await getDb().event.findMany({ where: { status: "PUBLISHED", startAt: { gte: now } }, select: publicEventSelect, orderBy: [{ startAt: "asc" }, { id: "asc" }], take: discoveryLimit });
  return records.map((record) => mapPublicEvent(record, now));
}

export async function getUpcomingPublishedEvents(limit = 3, now = new Date()) {
  const records = await getDb().event.findMany({ where: { status: "PUBLISHED", startAt: { gte: now } }, select: publicEventSelect, orderBy: [{ startAt: "asc" }, { id: "asc" }], take: limit });
  return records.map((record) => mapPublicEvent(record, now));
}

export async function getCompletedPublishedEvents(limit = 20, now = new Date()) {
  const records = await getDb().event.findMany({ where: { OR: [{ status: "COMPLETED" }, { status: "PUBLISHED", startAt: { lt: now } }] }, select: publicEventSelect, orderBy: [{ startAt: "desc" }, { id: "asc" }], take: limit });
  return records.map((record) => mapPublicEvent(record, now));
}

// React memoizes only within the server render/request. A default Date is created
// inside the cached function so metadata and page calls share the same slug key.
export const getPublishedEventBySlug = cache(async (slug: string, now = new Date()) => {
  const record = await getDb().event.findFirst({ where: { slug, status: { in: ["PUBLISHED", "COMPLETED"] } }, select: publicEventDetailSelect });
  return record ? { ...mapPublicEvent(record, now), calendar: getCalendarLinks(record) } : null;
});

/** No featured field exists yet, so the nearest upcoming published event is the pick. */
export async function getFeaturedPublishedEvents(now = new Date()) {
  return (await getUpcomingPublishedEvents(1, now))[0] ?? null;
}

export async function getRelatedPublishedEvents(event: { id: string; category: string; organizer?: { slug?: string }; startAt?: string }, limit = 3, now = new Date()) {
  const records = await getDb().event.findMany({ where: { status: "PUBLISHED", id: { not: event.id }, startAt: { gte: now } }, select: publicEventSelect, orderBy: [{ startAt: "asc" }, { id: "asc" }], take: discoveryLimit });
  const anchor = event.startAt ? new Date(event.startAt).getTime() : now.getTime();
  return records.sort((a, b) => {
    const score = (candidate: typeof a) => [Number(candidate.category === event.category), Number(Boolean(event.organizer?.slug && candidate.organization?.slug === event.organizer.slug)), -Math.abs(candidate.startAt.getTime() - anchor)];
    const left = score(a), right = score(b);
    return right[0] - left[0] || right[1] - left[1] || right[2] - left[2] || a.id.localeCompare(b.id);
  }).slice(0, limit).map((record) => mapPublicEvent(record, now));
}
