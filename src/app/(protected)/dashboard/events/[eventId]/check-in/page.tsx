import { ScannerPage } from "@/features/tickets/components/scanner-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Ticket check-in", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  return <ScannerPage eventId={(await params).eventId} scope={null} />;
}
