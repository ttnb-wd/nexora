import { mockOrganizations } from "./data/mock-organizations";
import type { Organization, OrganizationFiltersState, OrganizationSort } from "./types";
export const initialOrganizationFilters: OrganizationFiltersState = { query: "", industry: "All industries", location: "Anywhere" };
export function getOrganizationById(id: string) { return mockOrganizations.find((organization) => organization.id === id); }
export function getOrganizationBySlug(slug: string) { return mockOrganizations.find((organization) => organization.slug === slug); }
/** Only genuine category/topic matches, with stable ordering and at most three results. */
export function getRelatedOrganizations(organization: Organization): Organization[] {
  const score = (candidate: Organization) => Number(candidate.industry === organization.industry) * 2
    + candidate.topics.filter((topic) => organization.topics.includes(topic)).length;
  return mockOrganizations.filter((candidate) => candidate.id !== organization.id && score(candidate) > 0)
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name)).slice(0, 3);
}
export function filterOrganizations(organizations: Organization[], filters: OrganizationFiltersState, sort: OrganizationSort) {
  const query = filters.query.trim().toLowerCase();
  return organizations.filter((organization) => [organization.name, organization.shortName, organization.industry, organization.location.city, organization.description].join(" ").toLowerCase().includes(query)
    && (filters.industry === "All industries" || organization.industry === filters.industry)
    && (filters.location === "Anywhere" || organization.location.city === filters.location))
    .sort((a, b) => sort === "alphabetical" ? a.name.localeCompare(b.name) : Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
}
