import type { Event } from "../types";
import { getOrganizationById } from "@/features/organizations/organization-helpers";
import { OrganizationCard } from "@/features/organizations/components/organization-card";
export function EventOrganizer({ event }: { event: Event }) {
  const organization = getOrganizationById(event.organizationId);
  if (!organization) return <p>Organizer details are coming soon.</p>;
  return <OrganizationCard organization={organization} variant="compact" actionLabel="View organization" />;
}
