import { EditEventPage } from "@/features/events/components/edit-event-page";
export const metadata = { title: "Edit event" };
export default async function Page({ params }: { params: Promise<{ organizationSlug: string; eventId: string }> }) {
  const { organizationSlug, eventId } = await params;
  return <EditEventPage eventId={eventId} scope={organizationSlug} />;
}
