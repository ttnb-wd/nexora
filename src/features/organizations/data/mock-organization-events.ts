import { mockEvents } from "@/features/events/data/mock-events";
import type { Organization } from "../types";
import { mockOrganizations } from "./mock-organizations";
/** Event ownership lives only on Event.organizationId. Status uses the fixed demo calendar. */
export function getEventsByOrganization(organizationId: string) {
  return mockEvents.filter((event) => event.organizationId === organizationId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
export function getUpcomingEventsByOrganization(organizationId: string) {
  return getEventsByOrganization(organizationId).filter((event) => event.status === "upcoming");
}
export function getPastEventsByOrganization(organizationId: string) {
  return getEventsByOrganization(organizationId).filter((event) => event.status === "completed")
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
export function getOrganizationEvents(organization: Organization) {
  return {
    upcoming: getUpcomingEventsByOrganization(organization.id),
    past: getPastEventsByOrganization(organization.id),
  };
}

/** Activity is based on linked mock events, never invented engagement metrics. */
export function getTrendingOrganization(organizations: readonly Organization[] = mockOrganizations) {
  return organizations.map((organization) => ({ organization, events: getOrganizationEvents(organization) }))
    .sort((a, b) => b.events.upcoming.length - a.events.upcoming.length
      || (b.events.upcoming.length + b.events.past.length) - (a.events.upcoming.length + a.events.past.length)
      || Number(b.organization.featured) - Number(a.organization.featured)
      || a.organization.name.localeCompare(b.organization.name))[0]?.organization;
}
