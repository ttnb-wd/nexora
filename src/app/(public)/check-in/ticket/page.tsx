import Link from "next/link";
import { getTicketLandingContext } from "@/features/tickets/server/landing";
export const dynamic = "force-dynamic";
export const metadata = { title: "Nexora ticket", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
// The credential fragment never reaches the server. GET never validates or mutates a ticket.
export default async function Page({ searchParams }: { searchParams: Promise<{ event?: string | string[] }> }) {
  const { event } = await searchParams;
  let context: Awaited<ReturnType<typeof getTicketLandingContext>> = null;
  try { context = await getTicketLandingContext(event); } catch { /* Keep legacy and unavailable QR links usable. */ }
  return <main id="main-content" tabIndex={-1} style={{ padding: "8rem 1.5rem", maxWidth: 680, margin: "auto" }}>
    <p>NEXORA · ORGANIZER CHECK-IN TICKET</p><h1>{context?.title ?? "Nexora event ticket"}</h1>
    <p><strong>Ticket status: awaiting organizer verification.</strong></p>
    <p>Opening this page does not validate your registration or check you in. Present the original QR to an authorized organizer. Only the event’s check-in page can confirm whether a ticket is valid, cancelled, or already checked in.</p>
    {context && <p><Link href={`/events/${context.slug}`}>Back to event</Link></p>}
    <p><Link href="/dashboard/joined">View your own tickets in Joined events</Link></p>
    {context?.checkInPath && <p><Link href={context.checkInPath}>Open organizer check-in</Link> · Paste the full original QR URL there to verify this ticket.</p>}
    <p><Link href="/explore">Back to Explore</Link></p>
  </main>;
}
