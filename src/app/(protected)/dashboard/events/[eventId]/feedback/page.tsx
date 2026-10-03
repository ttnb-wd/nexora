import { FeedbackPage } from "@/features/post-event/feedback-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Event feedback", robots: { index: false, follow: false } };
export default async function Page({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams: Promise<{ page?: string }> }) {
  const { eventId } = await params;
  return <FeedbackPage eventId={eventId} scope={null} page={(await searchParams).page} />;
}
