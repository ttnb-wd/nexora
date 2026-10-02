import { getOrganizationById } from "@/features/organizations/organization-helpers";
import { demoToday } from "./data/mock-events";
import type { Event, EventFiltersState } from "./types";

export const initialFilters: EventFiltersState = { query: "", category: "All categories", type: "All types", location: "Anywhere", date: "Any date" };
export type EventSort = "recommended" | "soonest" | "title";

export function filterEvents(events: Event[], filters: EventFiltersState, sort: EventSort) {
  const query = filters.query.trim().toLowerCase();
  return events.filter((event) => {
    const searchable = [event.title, event.category, getOrganizationById(event.organizationId)?.name, event.location.city, event.location.venue, event.description].join(" ").toLowerCase();
    const dateMatches = filters.date === "Any date" || (filters.date === "This week" && event.date >= demoToday && event.date <= "2026-10-04") || (filters.date === "This month" && event.date >= demoToday && event.date < "2026-11-01") || (filters.date === "Later" && event.date >= "2026-11-01");
    return searchable.includes(query) && (filters.category === "All categories" || event.category === filters.category) && (filters.type === "All types" || event.type === filters.type) && (filters.location === "Anywhere" || event.location.city === filters.location) && dateMatches;
  }).sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : sort === "soonest" ? a.date.localeCompare(b.date) : Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || Number(a.status === "completed") - Number(b.status === "completed") || a.date.localeCompare(b.date));
}
