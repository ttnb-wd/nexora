import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicOrganizationBySlug, getRelatedOrganizations, getOrganizationUpcomingEvents, getOrganizationPastEvents } from "@/features/organizations/server/public-organization-queries";
import { OrganizationProfile } from "@/features/organizations/components/organization-profile";
import { Container } from "@/components/layout/container";
import styles from "@/features/organizations/components/organizations.module.css";
type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const organization = await getPublicOrganizationBySlug((await params).slug);
    return organization ? { title: organization.name, description: organization.description || undefined, openGraph: { title: organization.name, url: `/companies/${organization.slug}`, type: "website" } } : { title: "Organization not found", robots: { index: false, follow: false } };
  } catch { return { title: "Organization unavailable", robots: { index: false, follow: false } }; }
}
export default async function OrganizationPage({ params }: Props) {
  const { slug } = await params;
  let organization;
  let data;
  try {
    organization = await getPublicOrganizationBySlug(slug);
    if (organization) {
      const now = new Date();
      data = await Promise.all([getOrganizationUpcomingEvents(slug, now), getOrganizationPastEvents(slug, now), getRelatedOrganizations(organization)]);
    }
  } catch {
    return <main id="main-content" tabIndex={-1} className={styles.profile}><Container><div className={styles.empty}><h1>Organization temporarily unavailable.</h1><p>Please try again shortly.</p></div></Container></main>;
  }
  if (!organization || !data) notFound();
  const [upcoming, past, related] = data;
  return <OrganizationProfile key={organization.slug} organization={organization} upcoming={upcoming} past={past} related={related} />;
}
