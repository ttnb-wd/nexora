import { FeedbackPage } from "@/features/post-event/feedback-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Event feedback", robots: { index: false, follow: false } };
export default async function Page({ params, searchParams }: { params: Promise<{ eventId: string; organizationSlug: string }>; searchParams: Promise<{ page?: string }> }) {
  const { eventId, organizationSlug } = await params;
  return <FeedbackPage eventId={eventId} scope={organizationSlug} page={(await searchParams).page} />;
}
