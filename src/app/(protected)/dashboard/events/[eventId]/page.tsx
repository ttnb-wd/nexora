import { EventManagementPage } from "@/features/events/components/event-management-page";
export const metadata = { title: "Manage event" };
export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <EventManagementPage eventId={eventId} scope={null} />;
}
