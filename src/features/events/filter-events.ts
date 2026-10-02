import type { Event, EventFiltersState } from "./types";

export const initialFilters: EventFiltersState = { query: "", category: "All categories", type: "All types", location: "Anywhere", date: "Any date" };
export type EventSort = "recommended" | "soonest" | "title";

export function filterEvents(events: Event[], filters: EventFiltersState, sort: EventSort, now = new Date()) {
  const query = filters.query.trim().toLowerCase();
  // Server-provided time is the anchor. Filter windows use UTC; display uses the event's timezone.
  const weekEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + (7 - now.getUTCDay()) % 7 + 1);
  const monthEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return events.filter((event) => {
    const searchable = [event.title, event.category, event.organizer?.name, event.location.city, event.location.venue, event.description].join(" ").toLowerCase();
    const start = new Date(event.startAt ?? `${event.date}T12:00:00Z`).getTime();
    const dateMatches = filters.date === "Any date" || (filters.date === "This week" && start >= now.getTime() && start < weekEnd) || (filters.date === "This month" && start >= now.getTime() && start < monthEnd) || (filters.date === "Later" && start >= monthEnd);
    return searchable.includes(query) && (filters.category === "All categories" || event.category === filters.category) && (filters.type === "All types" || event.type === filters.type) && (filters.location === "Anywhere" || event.location.city === filters.location) && dateMatches;
  }).sort((a, b) => {
    const dateOrder = new Date(a.startAt ?? `${a.date}T12:00:00Z`).getTime() - new Date(b.startAt ?? `${b.date}T12:00:00Z`).getTime();
    return sort === "title" ? a.title.localeCompare(b.title) : sort === "soonest" ? dateOrder : Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || Number(a.status === "completed") - Number(b.status === "completed") || dateOrder;
  });
}
