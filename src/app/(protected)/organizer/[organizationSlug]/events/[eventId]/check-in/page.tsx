import { ScannerPage } from "@/features/tickets/components/scanner-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Ticket check-in", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function Page({ params }: { params: Promise<{ organizationSlug: string; eventId: string }> }) {
  const { organizationSlug, eventId } = await params;
  return <ScannerPage eventId={eventId} scope={organizationSlug} />;
}
