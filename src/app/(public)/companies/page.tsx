import { OrganizationsDiscovery } from "@/features/organizations/components/organizations-discovery";
import { getPublicOrganizations, getTrendingOrganization } from "@/features/organizations/server/public-organization-queries";
export const dynamic = "force-dynamic";
export const metadata = { title: "Companies & Organizations", description: "Meet the companies, communities, and organizers behind Nexora’s events." };
export default async function CompaniesPage() {
  let data: [Awaited<ReturnType<typeof getPublicOrganizations>>, Awaited<ReturnType<typeof getTrendingOrganization>>];
  try {
    data = await Promise.all([getPublicOrganizations(), getTrendingOrganization()]);
  } catch {
    return <OrganizationsDiscovery allOrganizations={[]} trending={null} unavailable />;
  }
  const [allOrganizations, trending] = data;
  return <OrganizationsDiscovery allOrganizations={allOrganizations} trending={trending} />;
}
