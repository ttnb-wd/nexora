import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { mockOrganizations } from "@/features/organizations/data/mock-organizations";
import { getOrganizationBySlug, getRelatedOrganizations } from "@/features/organizations/organization-helpers";
import { getOrganizationEvents } from "@/features/organizations/organization-events";
import { OrganizationProfile } from "@/features/organizations/components/organization-profile";
type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return mockOrganizations.map((organization) => ({ slug: organization.slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const organization = getOrganizationBySlug((await params).slug);
  if (!organization) notFound();
  return { title: organization.name, description: organization.description, openGraph: { title: organization.name, description: organization.description, url: `/companies/${organization.slug}`, type: "website" } };
}
export default async function OrganizationPage({ params }: Props) {
  const organization = getOrganizationBySlug((await params).slug);
  if (!organization) notFound();
  const { upcoming, past } = getOrganizationEvents(organization);
  return <OrganizationProfile key={organization.id} organization={organization} upcoming={upcoming} past={past} related={getRelatedOrganizations(organization)} />;
}
