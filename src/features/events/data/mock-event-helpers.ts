/** Development/design helpers. Production discovery uses server/public-event-queries. */
import type { Event } from "../types";
import { mockEvents } from "./mock-events";
export function getMockEventBySlug(slug: string) { return mockEvents.find((event) => event.slug === slug); }
export function getMockRelatedEvents(event: Event, limit = 3) {
  const relevance = (candidate: Event) => (candidate.category === event.category ? 10 : 0) + candidate.tags.filter((tag) => event.tags.includes(tag)).length;
  return mockEvents.filter((candidate) => candidate.id !== event.id && relevance(candidate) > 0)
    .sort((a, b) => relevance(b) - relevance(a) || a.date.localeCompare(b.date)).slice(0, limit);
}
