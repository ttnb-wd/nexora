import type { Event } from "./types";
import { mockEvents } from "./data/mock-events";
export function getEventBySlug(slug: string) { return mockEvents.find((event) => event.slug === slug); }
export function getRelatedEvents(event: Event, limit = 3) {
  const relevance = (candidate: Event) => (candidate.category === event.category ? 10 : 0) + candidate.tags.filter((tag) => event.tags.includes(tag)).length;
  return mockEvents.filter((candidate) => candidate.id !== event.id && relevance(candidate) > 0)
    .sort((a, b) => relevance(b) - relevance(a) || a.date.localeCompare(b.date)).slice(0, limit);
}
export function formatEventDate(date: string) { return new Date(`${date}T12:00:00Z`).toLocaleDateString("en", { weekday: "short", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }); }
