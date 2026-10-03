import { OrganizationAnalyticsPage } from "@/features/analytics/components/organization-analytics-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Organization analytics", robots: { index: false, follow: false } };
export default async function Page({ params, searchParams }: { params: Promise<{ organizationSlug: string }>; searchParams: Promise<{ range?: string | string[] }> }) {
  return <OrganizationAnalyticsPage slug={(await params).organizationSlug} range={(await searchParams).range} />;
}
