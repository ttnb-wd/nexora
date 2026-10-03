import { EventAnalyticsPage } from "@/features/analytics/components/event-analytics-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Event analytics", robots: { index: false, follow: false } };
export default async function Page({ params, searchParams }: { params: Promise<{ organizationSlug: string; eventId: string }>; searchParams: Promise<{ range?: string | string[] }> }) {
  const { organizationSlug, eventId } = await params;
  return <EventAnalyticsPage eventId={eventId} scope={organizationSlug} range={(await searchParams).range} />;
}
