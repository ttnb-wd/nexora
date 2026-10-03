import type { PublicOrganization, OrganizationFiltersState, OrganizationSort } from "./types";
export const initialOrganizationFilters: OrganizationFiltersState = { query: "", industry: "All industries", location: "Anywhere" };
export function filterOrganizations(organizations: PublicOrganization[], filters: OrganizationFiltersState, sort: OrganizationSort) {
  const query = filters.query.trim().toLowerCase();
  const matches = organizations.filter((organization) => [organization.name, organization.shortName, organization.industry, organization.city, organization.region, organization.description].join(" ").toLowerCase().includes(query)
    && (filters.industry === "All industries" || organization.industry === filters.industry)
    && (filters.location === "Anywhere" || (organization.city || organization.region) === filters.location));
  return sort === "alphabetical" ? matches.sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug)) : matches;
}
