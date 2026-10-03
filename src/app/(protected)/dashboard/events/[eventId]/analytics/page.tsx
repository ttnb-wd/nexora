import { EventAnalyticsPage } from "@/features/analytics/components/event-analytics-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Event analytics", robots: { index: false, follow: false } };
export default async function Page({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams: Promise<{ range?: string | string[] }> }) {
  return <EventAnalyticsPage eventId={(await params).eventId} scope={null} range={(await searchParams).range} />;
}
