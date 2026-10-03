import { AttendeesPage, type AttendeeSearchParams } from "@/features/attendees/components/attendees-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Manage attendees", robots: { index: false, follow: false } };
export default async function Page({ params, searchParams }: { params: Promise<{ organizationSlug: string; eventId: string }>; searchParams: Promise<AttendeeSearchParams> }) {
  const { organizationSlug, eventId } = await params;
  return <AttendeesPage eventId={eventId} scope={organizationSlug} searchParams={await searchParams} />;
}
